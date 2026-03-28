"""
PayPal Payment Integration
Sử dụng PayPal REST API để thanh toán
"""

import requests
import os
from datetime import datetime
from flask import current_app

# PayPal API URLs
PAYPAL_SANDBOX_URL = "https://api-m.sandbox.paypal.com"
PAYPAL_LIVE_URL = "https://api-m.paypal.com"

# VND/USD rate cache (tỷ giá thị trường)
VND_USD_RATE_CACHE = {'rate': 25000, 'updated_at': None}
RATE_UPDATE_INTERVAL = 3600  # 1 giờ


def get_vnd_usd_rate(force=False):
    """
    Lấy tỷ giá VND/USD chuẩn thị trường.
    Ưu tiên: Admin settings > API open.er-api.com > fallback 25000
    """
    from db_helper import get_setting
    
    # Kiểm tra override từ Admin
    override = get_setting('vnd_usd_rate', '')
    if override:
        try:
            return float(override)
        except (ValueError, TypeError):
            pass
    
    global VND_USD_RATE_CACHE
    
    cache_age = 0
    if VND_USD_RATE_CACHE.get('updated_at'):
        last_update = datetime.fromisoformat(VND_USD_RATE_CACHE['updated_at'])
        cache_age = (datetime.now() - last_update).total_seconds()
    
    if not force and cache_age < RATE_UPDATE_INTERVAL and cache_age > 0:
        return float(VND_USD_RATE_CACHE['rate'])
    
    try:
        resp = requests.get(
            'https://open.er-api.com/v6/latest/USD',
            timeout=5
        )
        if resp.status_code == 200:
            data = resp.json()
            vnd_rate = float(data.get('rates', {}).get('VND', 25000))
            VND_USD_RATE_CACHE['rate'] = vnd_rate
            VND_USD_RATE_CACHE['updated_at'] = datetime.now().isoformat()
            return vnd_rate
    except Exception as e:
        try:
            print(f"⚠️ PayPal: Không lấy được tỷ giá VND/USD: {e}")
        except Exception:
            pass
    
    return float(VND_USD_RATE_CACHE.get('rate', 25000))


def get_amount_usd_from_vnd(amount_vnd):
    """Chuyển VND sang USD theo tỷ giá thị trường"""
    rate = get_vnd_usd_rate()
    return round(float(amount_vnd) / rate, 2)


def get_paypal_config():
    """Lấy cấu hình PayPal từ environment hoặc settings"""
    from db_helper import get_setting
    
    client_id = os.environ.get('PAYPAL_CLIENT_ID') or get_setting('paypal_client_id', '')
    client_secret = os.environ.get('PAYPAL_CLIENT_SECRET') or get_setting('paypal_client_secret', '')
    sandbox_val = os.environ.get('PAYPAL_SANDBOX') or get_setting('paypal_sandbox', '1')
    sandbox = str(sandbox_val).lower() in ('1', 'true', 'yes', 'on')
    
    base_url = PAYPAL_SANDBOX_URL if sandbox else PAYPAL_LIVE_URL
    
    return {
        'client_id': client_id,
        'client_secret': client_secret,
        'base_url': base_url,
        'sandbox': sandbox
    }


def get_paypal_access_token():
    """Lấy PayPal OAuth access token"""
    config = get_paypal_config()
    if not config['client_id'] or not config['client_secret']:
        return None, "Chưa cấu hình PayPal. Vui lòng thêm Client ID và Secret trong Admin Settings."
    
    url = f"{config['base_url']}/v1/oauth2/token"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "grant_type": "client_credentials"
    }
    
    try:
        response = requests.post(
            url,
            headers=headers,
            data=data,
            auth=(config['client_id'], config['client_secret']),
            timeout=30
        )
        
        if response.status_code == 200:
            token_data = response.json()
            return token_data.get('access_token'), None
        else:
            error = response.json() if response.text else {}
            msg = error.get('error_description', error.get('error', f"Lỗi {response.status_code}"))
            # Hướng dẫn khi auth fail
            if response.status_code == 401:
                msg += ". Kiểm tra: 1) Credentials từ tab Sandbox phải BẬT 'Chế độ Sandbox'. 2) Credentials từ tab Live phải TẮT 'Chế độ Sandbox'. 3) Không có khoảng trắng thừa khi copy."
            return None, msg
    except Exception as e:
        return None, str(e)


def create_paypal_order(order_id, amount, currency='USD', return_url='', cancel_url=''):
    """
    Tạo PayPal order
    
    Args:
        order_id: Mã đơn hàng của chúng ta
        amount: Số tiền (float)
        currency: Mã tiền tệ (USD, EUR, VND không được hỗ trợ trực tiếp - dùng USD)
        return_url: URL khi thanh toán thành công
        cancel_url: URL khi user hủy
    
    Returns:
        (approval_url, error) - approval_url để redirect user đến PayPal
    """
    access_token, error = get_paypal_access_token()
    if error:
        return None, error
    
    config = get_paypal_config()
    url = f"{config['base_url']}/v2/checkout/orders"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}"
    }
    
    # PayPal không hỗ trợ VND trực tiếp, chuyển sang USD theo tỷ giá thị trường
    if currency == 'VND':
        rate = get_vnd_usd_rate()
        amount_usd = round(amount / rate, 2)
        currency = 'USD'
    else:
        amount_usd = float(amount)
    
    # PayPal yêu cầu số tiền tối thiểu 0.01 USD
    if amount_usd < 0.01:
        amount_usd = 0.01
    
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": order_id,
                "description": f"Đơn hàng {order_id}",
                "amount": {
                    "currency_code": currency,
                    "value": f"{amount_usd:.2f}"
                }
            }
        ],
        "application_context": {
            "return_url": return_url,
            "cancel_url": cancel_url,
            "brand_name": "Nội Thất Sang Trọng",
            "landing_page": "LOGIN",
            "user_action": "PAY_NOW"
        }
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code in (200, 201):
            order_data = response.json()
            # Tìm approval link
            for link in order_data.get('links', []):
                if link.get('rel') == 'approve':
                    return link.get('href'), None
            
            return None, "Không tìm thấy link thanh toán PayPal"
        else:
            error_data = response.json() if response.text else {}
            details = error_data.get('details', [{}])
            msg = details[0].get('message', error_data.get('message', str(response.status_code))) if details else str(response.status_code)
            # Log chi tiết để debug
            try:
                print(f"PayPal API Error {response.status_code}: {error_data}")
            except Exception:
                pass
            return None, f"Lỗi PayPal: {msg}"
    except Exception as e:
        return None, str(e)


def capture_paypal_order(paypal_order_id):
    """
    Capture PayPal order sau khi user đã approve
    
    Args:
        paypal_order_id: PayPal order ID (từ query param token khi return)
    
    Returns:
        (success, error_message)
    """
    access_token, error = get_paypal_access_token()
    if error:
        return False, error
    
    config = get_paypal_config()
    url = f"{config['base_url']}/v2/checkout/orders/{paypal_order_id}/capture"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}"
    }
    
    try:
        response = requests.post(url, headers=headers, json={}, timeout=30)
        
        if response.status_code in (200, 201):
            return True, None
        else:
            error_data = response.json() if response.text else {}
            details = error_data.get('details', [{}])
            msg = details[0].get('message', error_data.get('message', str(response.status_code))) if details else str(response.status_code)
            return False, f"Lỗi capture: {msg}"
    except Exception as e:
        return False, str(e)
