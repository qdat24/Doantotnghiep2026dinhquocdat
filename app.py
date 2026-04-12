"""
DQD Nội Thất — Flask Application
=================================
FIX 1:  Secret key & credentials từ env vars, không hardcode
FIX 2:  SMTP context manager — tránh resource leak khi exception
FIX 3:  IP spoofing — validate X-Forwarded-For whitelist
FIX 4:  Remove debug print statements trong production
FIX 5:  Duplicate route get_order_history_route — xóa orphan decorator
FIX 6:  Hardcoded localhost:5000 trong email → dùng request.url_root
FIX 7:  Brand name hardcoded "Nội Thất ABC" → dùng site_settings
FIX 8:  sync_cart_route gọi sai hàm add_to_cart (route fn vs db fn)
FIX 9:  app.permanent_session_lifetime đặt trong request handler → startup
FIX 10: context_processor gọi get_settings_dict() mọi request → cache
FIX 11: calculate_shipping_fee gọi get_settings_dict() mọi lần → cache
FIX 12: Password reset token trong session → không an toàn, thêm DB fallback
"""

import os
import random
import string
import hashlib
import time
from datetime import datetime, timedelta
from functools import wraps
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import contextlib

from flask import (
    Flask, render_template, request, jsonify,
    session, redirect, url_for, flash, Response
)

from db_helper import *
from web3_payment import init_web3_payment
from paypal_payment import create_paypal_order, capture_paypal_order, get_amount_usd_from_vnd
from rate_limiter import rate_limiter

try:
    from nft_certificate import mint_certificate_nft, get_nft_config
    NFT_AVAILABLE = True
except ImportError:
    NFT_AVAILABLE = False

# ──────────────────────────────────────────
# FIX 1: Tất cả secrets từ environment variables
# ──────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY') or os.urandom(32)

if not os.environ.get('SECRET_KEY'):
    import warnings
    warnings.warn(
        'SECRET_KEY not set in environment. Using random key — sessions will not persist across restarts.',
        RuntimeWarning
    )

# FIX 9: permanent_session_lifetime đặt ở startup, không trong request handler
app.permanent_session_lifetime = timedelta(days=30)

init_web3_payment(app)


# ──────────────────────────────────────────
# Configuration (FIX 1)
# ──────────────────────────────────────────

BANK_INFO = {
    'bank_code':      os.environ.get('BANK_CODE',   'TECHCOMBANK'),
    'bank_name':      os.environ.get('BANK_NAME',   'TECHCOMBANK'),
    'account_number': os.environ.get('BANK_ACCOUNT', '988833'),
    'account_name':   os.environ.get('BANK_OWNER',  'DINH QUOC DAT'),
}

EMAIL_CONFIG = {
    'smtp_server':    os.environ.get('SMTP_SERVER',   'smtp.gmail.com'),
    'smtp_port':      int(os.environ.get('SMTP_PORT', 587)),
    'sender_email':   os.environ.get('SENDER_EMAIL',  ''),
    'sender_password':os.environ.get('SENDER_PASSWORD', ''),
    'enabled':        os.environ.get('EMAIL_ENABLED', 'true').lower() == 'true',
}


# ──────────────────────────────────────────
# Settings cache (FIX 10, FIX 11)
# ──────────────────────────────────────────
_settings_cache: dict = {}
_settings_cache_time: float = 0.0
_SETTINGS_TTL = 60  # seconds


def get_cached_settings() -> dict:
    """Return settings dict, refresh cache every TTL seconds."""
    global _settings_cache, _settings_cache_time
    if time.time() - _settings_cache_time > _SETTINGS_TTL:
        _settings_cache = get_settings_dict()
        _settings_cache_time = time.time()
    return _settings_cache


def invalidate_settings_cache():
    """Call after saving settings to force refresh."""
    global _settings_cache_time
    _settings_cache_time = 0.0


# ──────────────────────────────────────────
# SMTP helper (FIX 2)
# ──────────────────────────────────────────

@contextlib.contextmanager
def _smtp_connection():
    """Context manager — guarantees server.quit() even on exception."""
    server = smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port'])
    try:
        server.starttls()
        server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
        yield server
    finally:
        try:
            server.quit()
        except Exception:
            pass


def _send_email(msg: MIMEMultipart) -> bool:
    """Send a pre-built MIME message. Returns True on success."""
    if not EMAIL_CONFIG['enabled']:
        app.logger.debug('Email sending disabled.')
        return False
    if not EMAIL_CONFIG['sender_email'] or not EMAIL_CONFIG['sender_password']:
        app.logger.warning('Email credentials not configured.')
        return False
    try:
        with _smtp_connection() as server:
            server.send_message(msg)
        return True
    except Exception as exc:
        app.logger.error('Email send failed: %s', exc)
        return False


# ──────────────────────────────────────────
# IP helper (FIX 3)
# ──────────────────────────────────────────

# FIX 3: Chỉ tin X-Forwarded-For khi request đến từ trusted proxy
_TRUSTED_PROXIES = {
    ip.strip()
    for ip in os.environ.get('TRUSTED_PROXIES', '127.0.0.1').split(',')
    if ip.strip()
}


def get_client_ip() -> str:
    """Return real client IP. Only trusts XFF header from trusted proxies."""
    remote = request.remote_addr or '0.0.0.0'
    if remote in _TRUSTED_PROXIES:
        xff = request.headers.get('X-Forwarded-For', '')
        if xff:
            return xff.split(',')[0].strip()
        real_ip = request.headers.get('X-Real-IP', '')
        if real_ip:
            return real_ip
    return remote


# ──────────────────────────────────────────
# Context processor (FIX 10)
# ──────────────────────────────────────────

@app.context_processor
def inject_globals():
    cart_count = sum(
        item.get('quantity', 0)
        for item in session.get('cart', [])
    )

    # FIX 10: use cached settings
    site_settings = get_cached_settings()

    show_coupons = bool(
        session.get('show_coupons_after_login') or
        session.get('show_coupons_after_register')
    )
    coupons_list = session.get('coupons_list', []) if show_coupons else []

    return {
        'cart_count':   cart_count,
        'site_settings': site_settings,
        'show_coupons':  show_coupons,
        'coupons_list':  coupons_list,
    }


# ──────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────

def calculate_shipping_fee(subtotal: float) -> int:
    """Return shipping fee based on cached settings."""
    # FIX 11: use cached settings
    settings = get_cached_settings()
    fee       = int(settings.get('shipping_fee', '30000') or 30000)
    threshold = int(settings.get('free_shipping_threshold', '5000000') or 5000000)
    if threshold > 0 and subtotal >= threshold:
        return 0
    return fee


@app.template_filter('format_currency')
def format_currency(value):
    try:
        return '{:,.0f}'.format(float(value))
    except (ValueError, TypeError):
        return value


def _base_url() -> str:
    """Return site base URL from settings or request context. (FIX 6)"""
    # FIX 6: never hardcode localhost:5000
    settings = get_cached_settings()
    configured = settings.get('site_url', '').rstrip('/')
    if configured and not configured.startswith('http://localhost'):
        return configured
    return request.url_root.rstrip('/')


def _site_name() -> str:
    """Return brand name from settings. (FIX 7)"""
    return get_cached_settings().get('site_name', 'DQD Nội Thất')


# ──────────────────────────────────────────
# Decorators
# ──────────────────────────────────────────

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'admin_logged_in' not in session:
            flash('Vui lòng đăng nhập để truy cập trang này', 'error')
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'customer_logged_in' not in session:
            flash('Vui lòng đăng nhập để tiếp tục', 'error')
            return redirect(url_for('customer_login'))
        return f(*args, **kwargs)
    return decorated


def verify_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('ddos_verified'):
            return redirect(url_for('landing_page'))
        return f(*args, **kwargs)
    return decorated


# ──────────────────────────────────────────
# Email functions (FIX 2, FIX 6, FIX 7)
# ──────────────────────────────────────────

def send_password_reset_email(recipient_email: str, reset_url: str,
                               recipient_name: str = 'Khách hàng') -> bool:
    brand = _site_name()  # FIX 7
    msg = MIMEMultipart('alternative')
    msg['From']    = EMAIL_CONFIG['sender_email']
    msg['To']      = recipient_email
    msg['Subject'] = 'Yêu cầu đặt lại mật khẩu của bạn'

    html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{{font-family:Arial,sans-serif;color:#333}}
      .wrap{{max-width:600px;margin:0 auto;padding:20px}}
      .head{{background:linear-gradient(135deg,#3d3229,#8b7355);color:#fff;
             padding:36px;text-align:center;border-radius:10px 10px 0 0}}
      .body{{background:#fff;padding:36px;border:1px solid #ddd}}
      .btn{{display:inline-block;background:#9db892;color:#fff;padding:12px 28px;
            text-decoration:none;border-radius:8px;font-weight:700}}
      .foot{{background:#f5f3ef;padding:18px;text-align:center;
             border-radius:0 0 10px 10px;font-size:12px;color:#777}}
    </style></head><body><div class="wrap">
      <div class="head"><h1>Đặt Lại Mật Khẩu — {brand}</h1></div>
      <div class="body">
        <p>Xin chào <strong>{recipient_name}</strong>,</p>
        <p>Nhấp vào nút dưới để đặt lại mật khẩu (hết hạn sau 1 giờ):</p>
        <p style="text-align:center;margin:28px 0">
          <a href="{reset_url}" class="btn">Đặt Lại Mật Khẩu</a>
        </p>
        <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      </div>
      <div class="foot">&copy; {datetime.now().year} {brand}. Email tự động.</div>
    </div></body></html>"""

    msg.attach(MIMEText(html, 'html'))
    ok = _send_email(msg)  # FIX 2
    if ok:
        app.logger.info('Password reset email sent to %s', recipient_email)
    return ok


def send_order_confirmation_email(order: dict) -> bool:
    """Send order confirmation. Uses dynamic brand name and base URL."""
    brand    = _site_name()        # FIX 7
    base_url = _base_url()         # FIX 6

    recipient = order.get('email', '')
    if not recipient:
        return False

    # Build items table rows
    items_rows = ''
    for item in order.get('items', []):
        name     = item.get('name') or item.get('product_name', 'Sản phẩm')
        qty      = item.get('quantity', 0)
        price    = float(item.get('price', 0) or 0)
        subtotal = float(item.get('subtotal', 0) or price * qty)
        items_rows += f"""<tr>
          <td style="padding:12px;border-bottom:1px solid #eee">{name}</td>
          <td style="padding:12px;border-bottom:1px solid #eee;text-align:center">{qty}</td>
          <td style="padding:12px;border-bottom:1px solid #eee;text-align:right">{price:,.0f}₫</td>
          <td style="padding:12px;border-bottom:1px solid #eee;text-align:right"><b>{subtotal:,.0f}₫</b></td>
        </tr>"""

    pm = str(order.get('payment_method', 'cod')).lower()
    pm_label = {
        'cod':           '💵 Thanh toán khi nhận hàng (COD)',
        'bank_transfer': '🏦 Chuyển khoản ngân hàng',
        'paypal':        '💳 PayPal',
        'usdt':          '🪙 USDT Crypto',
        'credit_card':   '💳 Thẻ tín dụng/ghi nợ',
    }.get(pm, pm)

    subtotal_val = order.get('subtotal', order.get('total', 0))
    shipping_val = order.get('shipping_fee', 0)
    total_val    = order.get('total', 0)

    html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{{font-family:Arial,sans-serif;color:#333;margin:0}}
      .wrap{{max-width:650px;margin:0 auto;padding:20px}}
      .head{{background:linear-gradient(135deg,#3d3229,#8b7355);color:#fff;
             padding:36px 20px;text-align:center;border-radius:10px 10px 0 0}}
      .body{{background:#fff;padding:28px;border:1px solid #ddd}}
      table{{width:100%;border-collapse:collapse;margin:16px 0}}
      th{{background:#f5f3ef;padding:12px;text-align:left;
          font-weight:700;border-bottom:2px solid #e8e4dd}}
      .info{{background:#f5f3ef;padding:16px;border-radius:8px;margin:16px 0}}
      .info p{{margin:8px 0}}
      .lbl{{font-weight:600;color:#6b5644;display:inline-block;width:150px}}
      .total-box{{background:#f5f3ef;padding:16px;border-radius:8px;margin:16px 0}}
      .tr{{display:flex;justify-content:space-between;padding:8px 0}}
      .grand{{border-top:2px solid #9db892;margin-top:8px;padding-top:12px;
              font-size:1.125rem;font-weight:700;color:#5a7a51}}
      .btn{{display:inline-block;background:#9db892;color:#fff;padding:11px 28px;
            text-decoration:none;border-radius:8px;font-weight:700;margin:6px}}
      .btn2{{background:#6b5644}}
      .warn{{background:#fff8e1;padding:16px;border-radius:8px;
             border-left:4px solid #d4af37;margin:16px 0}}
      .foot{{background:#3d3229;color:#fff;padding:24px;text-align:center;
             border-radius:0 0 10px 10px}}
    </style></head><body><div class="wrap">
      <div class="head">
        <h1>✅ ĐẶT HÀNG THÀNH CÔNG</h1>
        <div style="background:rgba(255,255,255,.2);padding:8px 18px;border-radius:20px;
                    display:inline-block;margin-top:12px;font-weight:700;font-size:1.125rem">
          Mã đơn: #{order['order_id']}
        </div>
      </div>
      <div class="body">
        <p>🎉 Cảm ơn bạn đã đặt hàng tại <strong>{brand}</strong>!
           Nhân viên sẽ liên hệ sớm nhất để xác nhận.</p>
        <h3 style="border-bottom:2px solid #9db892;padding-bottom:8px">📦 Chi Tiết Đơn Hàng</h3>
        <table>
          <thead><tr>
            <th>Sản phẩm</th>
            <th style="text-align:center;width:80px">SL</th>
            <th style="text-align:right;width:120px">Đơn giá</th>
            <th style="text-align:right;width:130px">Thành tiền</th>
          </tr></thead>
          <tbody>{items_rows}</tbody>
        </table>
        <div class="total-box">
          <div class="tr"><span>Tạm tính:</span><span>{subtotal_val:,.0f}₫</span></div>
          <div class="tr"><span>Phí vận chuyển:</span><span>{shipping_val:,.0f}₫</span></div>
          <div class="tr grand"><span>Tổng cộng:</span><span>{total_val:,.0f}₫</span></div>
        </div>
        <h3 style="border-bottom:2px solid #6b5644;padding-bottom:8px">📋 Thông Tin Giao Hàng</h3>
        <div class="info">
          <p><span class="lbl">👤 Người nhận:</span>{order.get('customer_name','')}</p>
          <p><span class="lbl">📱 Điện thoại:</span>{order.get('phone','')}</p>
          <p><span class="lbl">📧 Email:</span>{order.get('email','')}</p>
          <p><span class="lbl">🏠 Địa chỉ:</span>{order.get('address','')}</p>
          {'<p><span class="lbl">📝 Ghi chú:</span>' + order['note'] + '</p>' if order.get('note') else ''}
        </div>
        <p>💳 Phương thức: <strong>{pm_label}</strong></p>
        <div class="warn">
          <b>⚠️ Cần hỗ trợ?</b><br>
          Hotline: <b>0345211386</b> | Email: <b>quocdat30075@gmail.com</b>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="{base_url}/account" class="btn">Xem Chi Tiết Đơn Hàng</a>
          <a href="{base_url}/products" class="btn btn2">Tiếp Tục Mua Sắm</a>
        </div>
      </div>
      <div class="foot">
        <h3 style="margin:0 0 8px">🛋️ {brand}</h3>
        <p>📞 0345211386 | 📧 quocdat30075@gmail.com | 🏠 Hà Đông, Hà Nội</p>
        <p style="font-size:11px;opacity:.7;margin-top:12px">Email tự động — vui lòng không reply.</p>
      </div>
    </div></body></html>"""

    msg = MIMEMultipart('alternative')
    msg['From']    = EMAIL_CONFIG['sender_email']
    msg['To']      = recipient
    msg['Subject'] = f"✅ Xác nhận đơn hàng #{order['order_id']} — {brand}"
    msg.attach(MIMEText(html, 'html'))

    ok = _send_email(msg)  # FIX 2
    if ok:
        app.logger.info('Order confirmation sent to %s', recipient)
    return ok


def send_contact_email(contact_data: dict) -> bool:
    brand    = _site_name()
    base_url = _base_url()   # FIX 6

    msg = MIMEMultipart('alternative')
    msg['From']    = EMAIL_CONFIG['sender_email']
    msg['To']      = EMAIL_CONFIG['sender_email']
    msg['Subject'] = f"🔔 Liên hệ mới: {contact_data['subject']}"

    html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{{font-family:Arial,sans-serif;color:#333}}
      .wrap{{max-width:600px;margin:0 auto;padding:20px}}
      .head{{background:linear-gradient(135deg,#3d3229,#8b7355);color:#fff;
             padding:28px;text-align:center;border-radius:10px 10px 0 0}}
      .body{{background:#f9f9f9;padding:28px;border:1px solid #ddd}}
      .row{{margin:12px 0;padding:12px;background:#fff;border-radius:6px}}
      .lbl{{font-weight:700;color:#8b7355;display:inline-block;width:110px}}
      .msg{{background:#fff;padding:16px;border-left:4px solid #9db892;
            margin:16px 0;border-radius:6px}}
      .btn{{display:inline-block;background:#9db892;color:#fff;padding:11px 28px;
            text-decoration:none;border-radius:8px;font-weight:700}}
      .foot{{text-align:center;padding:16px;color:#999;font-size:12px}}
    </style></head><body><div class="wrap">
      <div class="head"><h1>📬 Liên Hệ Mới — {brand}</h1></div>
      <div class="body">
        <div class="row"><span class="lbl">👤 Họ tên:</span>{contact_data['name']}</div>
        <div class="row"><span class="lbl">📧 Email:</span>{contact_data['email']}</div>
        <div class="row"><span class="lbl">📱 ĐT:</span>{contact_data.get('phone','Không có')}</div>
        <div class="row"><span class="lbl">📌 Chủ đề:</span>{contact_data['subject']}</div>
        <div class="msg">
          <p style="margin:0 0 8px;font-weight:700;color:#6b5644">💬 Nội dung:</p>
          <p style="margin:0;white-space:pre-wrap">{contact_data['message']}</p>
        </div>
        <p style="text-align:center">
          <a href="{base_url}/admin/contacts" class="btn">Xem trong Admin</a>
        </p>
      </div>
      <div class="foot">{brand} | {datetime.now().strftime('%d/%m/%Y %H:%M')}</div>
    </div></body></html>"""

    msg.attach(MIMEText(html, 'html'))
    return _send_email(msg)


def send_contact_reply_email(contact_data: dict) -> bool:
    brand    = _site_name()   # FIX 7
    base_url = _base_url()    # FIX 6

    msg = MIMEMultipart('alternative')
    msg['From']    = EMAIL_CONFIG['sender_email']
    msg['To']      = contact_data['email']
    msg['Subject'] = f"Cảm ơn bạn đã liên hệ — {contact_data['subject']}"

    html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{{font-family:Arial,sans-serif;color:#333}}
      .wrap{{max-width:600px;margin:0 auto;padding:20px}}
      .head{{background:linear-gradient(135deg,#3d3229,#8b7355);color:#fff;
             padding:36px;text-align:center;border-radius:10px 10px 0 0}}
      .body{{background:#fff;padding:36px;border:1px solid #ddd}}
      .hl{{background:#f5f3ef;padding:16px;border-radius:6px;
           border-left:4px solid #9db892;margin:16px 0}}
      .btn{{display:inline-block;background:#9db892;color:#fff;padding:13px 36px;
            text-decoration:none;border-radius:8px;margin:16px 0;font-weight:700}}
      .ci{{margin:16px 0;padding:16px;background:#f5f3ef;border-radius:8px}}
      .foot{{background:#f5f3ef;padding:24px;text-align:center;
             border-top:3px solid #9db892;font-size:12px;color:#777}}
    </style></head><body><div class="wrap">
      <div class="head">
        <h1>🛋️ {brand}</h1>
        <p style="margin:8px 0 0;font-size:1rem">Cảm ơn bạn đã liên hệ!</p>
      </div>
      <div class="body">
        <p>Xin chào <strong>{contact_data['name']}</strong>,</p>
        <p>Chúng tôi đã nhận tin nhắn của bạn:</p>
        <div class="hl">
          <p style="margin:0 0 8px"><b>📌 Chủ đề:</b> {contact_data['subject']}</p>
          <p style="margin:0"><b>💬 Nội dung:</b></p>
          <p style="margin:8px 0 0;white-space:pre-wrap">{contact_data['message']}</p>
        </div>
        <p>Đội ngũ chúng tôi sẽ phản hồi trong <strong>24 giờ làm việc</strong>.</p>
        <p style="text-align:center"><a href="{base_url}" class="btn">Ghé Thăm Website</a></p>
        <div class="ci">
          <b>📞 Liên hệ nhanh:</b><br>
          📱 0345211386 &nbsp;|&nbsp; 📧 quocdat30075@gmail.com &nbsp;|&nbsp; 🏠 Hà Đông, Hà Nội
        </div>
        <p>Trân trọng,<br><strong>Đội ngũ {brand}</strong></p>
      </div>
      <div class="foot">Email tự động — vui lòng không reply trực tiếp.</div>
    </div></body></html>"""

    msg.attach(MIMEText(html, 'html'))
    return _send_email(msg)


# ──────────────────────────────────────────
# before_request — maintenance mode
# ──────────────────────────────────────────

@app.before_request
def check_maintenance_mode():
    """Check maintenance mode before every request."""
    # Always allow static files
    if request.endpoint == 'static' or (request.path or '').startswith('/static/'):
        return None

    # Always allow admin routes
    endpoint = str(request.endpoint or '')
    if endpoint.startswith('admin_') or endpoint == 'admin_login':
        return None

    try:
        if get_cached_settings().get('maintenance_mode') == '1':
            if session.get('admin_logged_in'):
                return None
            msg = get_cached_settings().get(
                'maintenance_message',
                'Website đang được bảo trì. Vui lòng quay lại sau!'
            )
            return render_template('maintenance.html', maintenance_message=msg), 503
    except Exception as exc:
        app.logger.error('Maintenance check error: %s', exc)

    return None


# ──────────────────────────────────────────
# DDoS protection
# ──────────────────────────────────────────

@app.route('/landing')
def landing_page():
    client_ip = get_client_ip()
    is_allowed, message = rate_limiter.is_allowed(client_ip)

    # Lấy 1 sản phẩm nổi bật để hiển thị trên landing
    featured = None
    try:
        products = get_all_products(active_only=True)
        # Ưu tiên sản phẩm có ảnh và đánh giá cao
        candidates = [p for p in products if p.get('image')]
        if candidates:
            featured = sorted(candidates, key=lambda p: float(p.get('rating') or 0), reverse=True)[0]
    except Exception:
        featured = None

    return render_template('landing.html',
                           blocked=not is_allowed,
                           error_message=message if not is_allowed else None,
                           featured_product=featured)


@app.route('/api/verify', methods=['POST'])
def verify_challenge():
    client_ip = get_client_ip()
    is_allowed, message = rate_limiter.is_allowed(client_ip)
    if not is_allowed:
        return jsonify({'success': False, 'message': message}), 429

    data = request.json or {}
    if not data.get('simple_verify'):
        return jsonify({'success': False, 'message': 'Yêu cầu không hợp lệ'}), 400

    session['ddos_verified']      = True
    session['ddos_verified_time'] = time.time()

    return jsonify({'success': True, 'message': 'Chào mừng!',
                    'redirect_url': url_for('index')})


@app.route('/api/generate-captcha')
def generate_captcha():
    n1, n2 = random.randint(1, 10), random.randint(1, 10)
    session['captcha_answer'] = str(n1 + n2)
    return jsonify({'question': f'{n1} + {n2} = ?', 'answer': n1 + n2})


@app.route('/api/clear-coupons-session', methods=['POST'])
def clear_coupons_session():
    for k in ('show_coupons_after_login', 'show_coupons_after_register', 'coupons_list'):
        session.pop(k, None)
    return jsonify({'success': True})


# ──────────────────────────────────────────
# Public routes
# ──────────────────────────────────────────

@app.route('/')
def index():
    client_ip = get_client_ip()

    # DDoS session check
    if not session.get('ddos_verified'):
        return redirect(url_for('landing_page'))

    # Re-verify every hour
    if time.time() - session.get('ddos_verified_time', 0) > 3600:
        session.pop('ddos_verified', None)
        session.pop('ddos_verified_time', None)
        return redirect(url_for('landing_page'))

    is_allowed, _ = rate_limiter.is_allowed(client_ip)
    if not is_allowed:
        session.pop('ddos_verified', None)
        return redirect(url_for('landing_page'))

    products   = get_all_products()
    categories = get_category_names()

    seen_ids, unique = set(), []
    for p in products:
        pid = p.get('id')
        if pid and pid not in seen_ids:
            seen_ids.add(pid)
            unique.append(p)

    # Build partners list from site_settings (partner_1_* … partner_6_*)
    _settings = get_cached_settings()
    _partners = []
    for i in range(1, 7):
        _name = _settings.get(f'partner_{i}_name', '').strip()
        _logo = _settings.get(f'partner_{i}_logo', '').strip()
        _url  = _settings.get(f'partner_{i}_url',  '').strip()
        if _name or _logo:
            _partners.append({'name': _name, 'logo': _logo, 'url': _url, 'website': _url})

    return render_template('index.html',
                           featured_products=unique[:6],
                           categories=categories,
                           partners=_partners)


@app.route('/products')
def products():
    try:
        from urllib.parse import unquote
        from db_helper import get_products_filtered

        category    = unquote(request.args.get('category', '').strip())
        search      = unquote(request.args.get('search',   '').strip())
        price_range = request.args.get('price', '').strip()
        sort        = request.args.get('sort',  '').strip()
        page        = request.args.get('page',  1, type=int)

        settings = get_cached_settings()
        per_page = int(settings.get('products_per_page', 12) or 12)
        if per_page < 4:  per_page = 12

        min_price = max_price = None
        if price_range and '-' in price_range:
            parts = price_range.split('-', 1)
            try:
                min_price = float(parts[0]) if parts[0] else None
                max_price = float(parts[1]) if parts[1] else None
            except ValueError:
                pass

        # Lấy toàn bộ để đếm total
        all_products = get_products_filtered(
            category=category or None,
            search=search or None,
            min_price=min_price,
            max_price=max_price,
            sort_by=sort or None,
            active_only=True,
        )
        total        = len(all_products)
        total_pages  = max(1, (total + per_page - 1) // per_page)
        page         = max(1, min(page, total_pages))
        offset       = (page - 1) * per_page
        products_list = all_products[offset : offset + per_page]

        categories = get_category_names()

        return render_template('products.html',
                               products=products_list,
                               categories=categories,
                               selected_category=category,
                               search=search,
                               price_range=price_range,
                               sort=sort,
                               page=page,
                               total_pages=total_pages,
                               total_products=total,
                               per_page=per_page)
    except Exception:
        app.logger.exception('Error in products route')
        return render_template('products.html', products=[], categories=[],
                               selected_category='', search='', price_range='', sort='',
                               page=1, total_pages=1, total_products=0, per_page=12)


@app.route('/categories')
def categories():
    categories_list = get_category_names()
    all_products    = get_all_products()
    cats_with_count = [
        {'name': cat, 'count': sum(1 for p in all_products if p.get('category') == cat)}
        for cat in categories_list
    ]
    return render_template('categories.html', categories=cats_with_count)


@app.route('/product/<int:product_id>')
def product_detail(product_id):
    product = get_product_by_id(product_id)
    if not product:
        return 'Không tìm thấy sản phẩm', 404

    product_images   = get_product_images(product_id)
    related_products = [
        p for p in get_all_products(category=product['category'])
        if p['id'] != product_id
    ][:4]
    rating_stats = get_review_rating_stats(product_id)

    customer_has_purchased = False
    if session.get('customer_id'):
        q = """SELECT COUNT(*) AS cnt FROM orders o
               JOIN order_items oi ON o.order_id = oi.order_id
               WHERE o.customer_id = %s AND oi.product_id = %s AND o.payment_status='paid'"""
        r = execute_query(q, (session['customer_id'], product_id), fetch=True, fetch_one=True)
        customer_has_purchased = bool(r and r.get('cnt', 0) > 0)

    return render_template('product_detail.html',
                           product=product,
                           product_images=product_images,
                           related_products=related_products,
                           rating_stats=rating_stats,
                           customer_has_purchased=customer_has_purchased)


@app.route('/api/product/<int:product_id>/quick-view')
def quick_view_product(product_id):
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'success': False, 'message': 'Sản phẩm không tồn tại'})
    return jsonify({'success': True, 'product': product})


# ──────────────────────────────────────────
# Cart API
# ──────────────────────────────────────────

@app.route('/api/add-to-cart', methods=['POST'])
def add_to_cart():
    data = request.get_json(force=True, silent=True) or {}
    product_id = data.get('product_id')
    quantity   = data.get('quantity', 1)

    try:
        product_id = int(product_id)
        quantity   = max(1, int(quantity))
        if product_id <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': 'ID sản phẩm hoặc số lượng không hợp lệ'}), 400

    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'success': False, 'message': 'Sản phẩm không tồn tại'}), 404

    # variant_info: chuỗi mô tả lựa chọn, VD: "Màu: Đen | Chất liệu: Gỗ sồi"
    variant_info = (data.get('variant_info') or '').strip()[:200]

    cart = session.setdefault('cart', [])
    matched = False
    for item in cart:
        if item.get('product_id') == product_id and item.get('variant_info', '') == variant_info:
            item['quantity'] += quantity
            matched = True
            break
    if not matched:
        cart_item = {'product_id': product_id, 'quantity': quantity}
        if variant_info:
            cart_item['variant_info'] = variant_info
        cart.append(cart_item)

    session.modified = True
    cart_count = sum(i.get('quantity', 0) for i in cart)

    return jsonify({'success': True, 'message': 'Đã thêm vào giỏ hàng',
                    'cart_count': cart_count})


@app.route('/api/update-cart', methods=['POST'])
def update_cart():
    data       = request.json or {}
    product_id = data.get('product_id')
    quantity   = data.get('quantity', 1)

    cart = session.get('cart', [])
    session['cart'] = [
        ({**item, 'quantity': quantity} if item['product_id'] == product_id else item)
        for item in cart
        if not (item['product_id'] == product_id and quantity <= 0)
    ]
    session.modified = True
    return jsonify({'success': True})


@app.route('/api/cart/summary')
def cart_summary():
    """Trả về danh sách items trong giỏ cho mini cart popup."""
    cart_items = []
    total = 0
    for item in session.get('cart', []):
        product = get_product_by_id(item['product_id'])
        if product:
            qty      = item.get('quantity', 1)
            price    = float(product.get('price', 0))
            subtotal = price * qty
            total   += subtotal
            cart_items.append({
                'product_id': product['id'],
                'name':       product['name'],
                'image':      product.get('image', ''),
                'price':      price,
                'quantity':   qty,
                'subtotal':   subtotal,
            })
    return jsonify({'success': True, 'items': cart_items, 'total': total,
                    'count': sum(i['quantity'] for i in cart_items)})



    product_id = (request.json or {}).get('product_id')
    session['cart'] = [i for i in session.get('cart', []) if i['product_id'] != product_id]
    session.modified = True
    return jsonify({'success': True})


@app.route('/cart/update/<int:product_id>', methods=['POST'])
def update_cart_item(product_id):
    try:
        quantity = int((request.get_json() or {}).get('quantity', 1))
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': 'Số lượng không hợp lệ'}), 400

    cart = session.get('cart', [])
    if quantity <= 0:
        session['cart'] = [i for i in cart if i['product_id'] != product_id]
    else:
        found = False
        for item in cart:
            if item['product_id'] == product_id:
                item['quantity'] = quantity
                found = True
                break
        if not found:
            return jsonify({'success': False, 'message': 'Sản phẩm không trong giỏ'}), 404
        session['cart'] = cart
    session.modified = True
    return jsonify({'success': True})


@app.route('/cart/remove/<int:product_id>', methods=['POST'])
def remove_cart_item(product_id):
    session['cart'] = [i for i in session.get('cart', []) if i['product_id'] != product_id]
    session.modified = True
    return jsonify({'success': True})


@app.route('/cart/clear', methods=['POST'])
def clear_cart():
    session['cart'] = []
    session.modified = True
    return jsonify({'success': True, 'message': 'Đã xóa toàn bộ giỏ hàng'})


@app.route('/cart')
def cart():
    # FIX 4: Remove debug print statements
    cart_items, total = [], 0
    for item in session.get('cart', []):
        product = get_product_by_id(item['product_id'])
        if product:
            sub = product['price'] * item['quantity']
            cart_items.append({'product': product, 'quantity': item['quantity'], 'subtotal': sub})
            total += sub

    shipping_fee = calculate_shipping_fee(total)
    threshold    = int(get_cached_settings().get('free_shipping_threshold', 5000000))

    return render_template('cart.html',
                           cart_items=cart_items,
                           subtotal=total,
                           shipping_fee=shipping_fee,
                           total=total + shipping_fee,
                           free_shipping_threshold=threshold)


@app.route('/checkout')
def checkout():
    if 'customer_logged_in' not in session:
        flash('Vui lòng đăng nhập để tiếp tục thanh toán', 'warning')
        return redirect(url_for('customer_login', next=url_for('checkout')))

    if not session.get('cart'):
        flash('Giỏ hàng của bạn đang trống', 'warning')
        return redirect(url_for('cart'))

    cart_items, total = [], 0
    for item in session['cart']:
        product = get_product_by_id(item['product_id'])
        if product:
            sub = product['price'] * item['quantity']
            cart_items.append({
                'product': product,
                'quantity': item['quantity'],
                'subtotal': sub,
                'variant_info': item.get('variant_info', ''),
            })
            total += sub

    if not cart_items:
        flash('Giỏ hàng của bạn đang trống', 'warning')
        return redirect(url_for('cart'))

    shipping_fee = calculate_shipping_fee(total)
    threshold    = int(get_cached_settings().get('free_shipping_threshold', 5000000))

    customer            = get_customer_by_id(session['customer_id'])
    shipping_addresses  = get_shipping_addresses(customer['id']) if customer else []
    default_address     = next((a for a in shipping_addresses if a.get('is_default')),
                                shipping_addresses[0] if shipping_addresses else None)

    session['cart_total']       = total + shipping_fee
    session['pending_order_id'] = None

    # Lấy mã giảm giá đang hoạt động để hiển thị cho khách
    try:
        available_coupons = get_all_coupons(active_only=True, limit=20) or []
        # Chỉ lấy coupon còn hạn và chưa hết lượt
        from datetime import date
        today = date.today()
        valid_coupons = []
        for c in available_coupons:
            if c.get('usage_limit') and int(c.get('usage_count') or 0) >= int(c['usage_limit']):
                continue
            if c.get('end_date') and c['end_date'] < today:
                continue
            valid_coupons.append(c)
    except Exception:
        valid_coupons = []

    return render_template('checkout.html',
                           cart_items=cart_items,
                           subtotal=total,
                           shipping_fee=shipping_fee,
                           total=total + shipping_fee,
                           customer=customer,
                           shipping_addresses=shipping_addresses,
                           default_address=default_address,
                           free_shipping_threshold=threshold,
                           available_coupons=valid_coupons)


@app.route('/api/place-order', methods=['POST'])
def place_order():
    if 'customer_logged_in' not in session:
        return jsonify({
            'success': False,
            'message': 'Vui lòng đăng nhập để đặt hàng',
            'require_login': True,
            'login_url': url_for('customer_login', next=url_for('checkout')),
        }), 401

    data = request.json
    if not data:
        return jsonify({'success': False, 'message': 'Dữ liệu không hợp lệ'}), 400
    if not session.get('cart'):
        return jsonify({'success': False, 'message': 'Giỏ hàng trống'})

    order_items, total = [], 0
    for item in session['cart']:
        product = get_product_by_id(item['product_id'])
        if product:
            price    = float(product['price'] or 0)
            subtotal = price * item['quantity']
            total   += subtotal
            order_items.append({
                'product_id': product['id'],
                'name':       product['name'],
                'price':      product['price'],
                'quantity':   item['quantity'],
                'subtotal':   subtotal,
            })

    # Coupon
    coupon_code = data.get('coupon_code', '').strip().upper()
    discount_amount = 0
    coupon_id = None
    if coupon_code:
        result = apply_coupon(coupon_code, total)
        if result.get('valid'):
            discount_amount = result['discount']
            total           = result['final_amount']
            coupon_id       = result['coupon']['id']
            increment_coupon_usage(coupon_code)

    shipping_fee = calculate_shipping_fee(total)
    final_total  = total + shipping_fee

    order_id = 'ORD' + ''.join(random.choices(string.digits, k=8))
    order_data = {
        'order_id':        order_id,
        'customer_id':     session.get('customer_id'),
        'customer_name':   data.get('fullname'),
        'phone':           data.get('phone'),
        'email':           data.get('email'),
        'address':         ', '.join(filter(None, [
                               data.get('address'), data.get('ward'),
                               data.get('district'), data.get('city'),
                           ])),
        'note':            data.get('note', ''),
        'payment_method':  data.get('payment_method'),
        'items':           order_items,
        'subtotal':        total,
        'shipping_fee':    shipping_fee,
        'total':           final_total,
        'status':          'pending',
        'payment_status':  'pending',
        'coupon_code':     coupon_code or None,
        'discount_amount': discount_amount,
    }

    if not create_order(order_data):
        return jsonify({'success': False, 'message': 'Không thể tạo đơn hàng'})

    pm = data.get('payment_method')
    if pm in ('bank_transfer', 'credit_card', 'usdt', 'paypal'):
        try:
            create_payment_transaction({
                'transaction_id': f"{pm.upper()}_{order_id}",
                'order_id':       order_id,
                'payment_method': pm,
                'amount':         float(final_total),
                'currency':       'VND',
                'status':         'pending',
            })
        except Exception as exc:
            app.logger.warning('Could not create payment transaction: %s', exc)

    session['pending_order_id'] = order_id
    session['cart'] = []

    redirects = {
        'usdt':          'usdt_payment',
        'paypal':        'paypal_payment',
        'bank_transfer': 'bank_transfer',
        'credit_card':   'credit_card',
    }
    redirect_target = redirects.get(pm, 'order_success')

    if redirect_target == 'order_success':
        try:
            send_order_confirmation_email(order_data)
        except Exception as exc:
            app.logger.warning('Order email failed: %s', exc)

    payload = {'success': True, 'order_id': order_id, 'redirect': redirect_target}
    if pm == 'paypal':
        payload['amount'] = final_total
    return jsonify(payload)


@app.route('/order-success')
def order_success():
    order_id = request.args.get('order_id')
    if not order_id:
        return redirect('/')

    order = get_order_by_id(order_id)
    if not order:
        return 'Không tìm thấy đơn hàng', 404

    payment_transaction = get_payment_transaction_by_order(order_id)
    pm = str(
        order.get('payment_method') or
        (payment_transaction.get('payment_method') if payment_transaction else None) or
        'cod'
    ).lower().strip()

    amount_usd = get_amount_usd_from_vnd(order.get('total', 0)) if pm == 'paypal' else None

    nft_certificate = nft_contract_address = None
    nft_explorer_base = 'https://bscscan.com'
    try:
        nft_certificate = get_nft_certificate_by_order(order_id)
        if nft_certificate and NFT_AVAILABLE:
            cfg = get_nft_config(nft_certificate.get('chain_id', 56))
            nft_contract_address = cfg.get('contract_address', '')
            nft_explorer_base    = cfg.get('explorer', 'https://bscscan.com')
    except Exception:
        nft_certificate = None

    return render_template('order_success.html',
                           order_id=order_id, order=order,
                           tx_hash=request.args.get('tx_hash', ''),
                           payment_method=pm,
                           payment_transaction=payment_transaction,
                           amount_usd=amount_usd,
                           nft_certificate=nft_certificate,
                           nft_contract_address=nft_contract_address,
                           nft_explorer_base=nft_explorer_base)


@app.route('/bank-transfer/<order_id>')
def bank_transfer(order_id):
    order = get_order_by_id(order_id)
    if not order:
        return 'Không tìm thấy đơn hàng', 404
    return render_template('bank_transfer.html',
                           order_id=order_id, order=order, total=order['total'],
                           **BANK_INFO)


@app.route('/credit-card/<order_id>')
def credit_card(order_id):
    order = get_order_by_id(order_id)
    if not order:
        return 'Không tìm thấy đơn hàng', 404
    return render_template('credit_card.html',
                           order_id=order_id, order=order, total=order['total'])


# ──────────────────────────────────────────
# PayPal
# ──────────────────────────────────────────

@app.route('/api/paypal/create-order', methods=['POST'])
def paypal_create_order():
    data     = request.get_json(silent=True) or {}
    order_id = data.get('order_id')
    amount   = data.get('amount', 0)

    try:
        amount = float(amount)
        if not order_id or amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': 'Thiếu hoặc sai thông tin'}), 400

    if not get_order_by_id(order_id):
        return jsonify({'success': False, 'message': 'Không tìm thấy đơn hàng'}), 404

    base = _base_url()  # FIX 6
    approval_url, error = create_paypal_order(
        order_id=order_id, amount=amount, currency='VND',
        return_url=f'{base}/paypal/success?order_id={order_id}',
        cancel_url=f'{base}/paypal/cancel?order_id={order_id}',
    )
    if error:
        return jsonify({'success': False, 'message': str(error)}), 400
    return jsonify({'success': True, 'approval_url': approval_url})


@app.route('/paypal/success')
def paypal_success():
    order_id = request.args.get('order_id')
    token    = request.args.get('token')
    if not order_id or not token:
        flash('Thông tin thanh toán không hợp lệ', 'error')
        return redirect(url_for('cart'))

    order = get_order_by_id(order_id)
    if not order:
        flash('Không tìm thấy đơn hàng', 'error')
        return redirect(url_for('index'))

    success, error = capture_paypal_order(token)
    if success:
        update_order_status(order_id, 'confirmed', payment_status='paid')
        update_payment_transaction_by_order(order_id, 'completed',
                                            paid_at=datetime.now(), bank_reference=token)
        try:
            send_order_confirmation_email(get_order_by_id(order_id) or order)
        except Exception as exc:
            app.logger.warning('PayPal email failed: %s', exc)

        usd = get_amount_usd_from_vnd(order.get('total', 0))
        flash(f'Thanh toán PayPal thành công! ${usd:,.2f} USD', 'success')
    else:
        flash(f'Lỗi PayPal: {error}', 'error')

    return redirect(url_for('order_success', order_id=order_id))


@app.route('/paypal/cancel')
def paypal_cancel():
    order_id = request.args.get('order_id')
    flash('Bạn đã hủy thanh toán PayPal. Đơn hàng vẫn được lưu.', 'info')
    return redirect(url_for('order_success', order_id=order_id) if order_id else url_for('cart'))


@app.route('/api/process-card-payment', methods=['POST'])
def process_card_payment():
    order_id = (request.json or {}).get('order_id')
    order    = get_order_by_id(order_id)
    if not order:
        return jsonify({'success': False, 'message': 'Không tìm thấy đơn hàng'})

    txn_id = 'TXN' + ''.join(random.choices(string.digits, k=12))
    try:
        create_payment_transaction({
            'transaction_id': txn_id, 'order_id': order_id,
            'payment_method': 'credit_card', 'amount': float(order['total']),
            'currency': 'VND', 'status': 'completed', 'paid_at': datetime.now(),
        })
    except Exception as exc:
        app.logger.warning('Card transaction record failed: %s', exc)

    update_order_status(order_id, 'confirmed', 'paid')
    try:
        send_order_confirmation_email(order)
    except Exception as exc:
        app.logger.warning('Card email failed: %s', exc)

    return jsonify({'success': True, 'message': 'Thanh toán thành công',
                    'transaction_id': txn_id})


@app.route('/api/check-payment', methods=['POST'])
def check_payment():
    order_id = (request.json or {}).get('order_id')
    if not order_id:
        return jsonify({'paid': False, 'message': 'Thiếu order_id'}), 400

    txn = get_payment_transaction_by_order(order_id)
    if txn:
        paid = txn.get('status') == 'completed'
        return jsonify({
            'paid':           paid,
            'message':        'Đã thanh toán' if paid else f'Trạng thái: {txn.get("status")}',
            'transaction_id': txn.get('transaction_id'),
            'paid_at':        txn['paid_at'].isoformat() if paid and txn.get('paid_at') else None,
        })

    order = get_order_by_id(order_id)
    if order and order.get('payment_status') == 'paid':
        return jsonify({'paid': True, 'message': 'Đã thanh toán', 'transaction_id': None})

    return jsonify({'paid': False, 'message': 'Chưa thanh toán'})


# ──────────────────────────────────────────
# Static pages
# ──────────────────────────────────────────

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/partners')
def partners():
    return render_template('partners.html')

@app.route('/policy')
def policy():
    return render_template('policy.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/guide')
def guide():
    return render_template('guide.html')

@app.route('/return-policy')
def return_policy():
    return render_template('return_policy.html')

@app.route('/warranty')
def warranty():
    return render_template('warranty.html')

@app.route('/faq')
def faq():
    return render_template('faq.html')


# ──────────────────────────────────────────
# Sitemap & Robots.txt
# ──────────────────────────────────────────

@app.route('/sitemap.xml')
@app.route('/sitemap')
def sitemap():
    """XML Sitemap cho SEO — tự động bao gồm tất cả sản phẩm đang bán."""
    base = _base_url()
    now  = datetime.now().strftime('%Y-%m-%d')

    static_urls = [
        ('/',              '1.0', 'daily'),
        ('/products',      '0.9', 'daily'),
        ('/about',         '0.7', 'monthly'),
        ('/contact',       '0.6', 'monthly'),
        ('/partners',      '0.5', 'monthly'),
        ('/policy',        '0.4', 'yearly'),
        ('/terms',         '0.4', 'yearly'),
        ('/privacy',       '0.4', 'yearly'),
        ('/faq',           '0.5', 'monthly'),
        ('/warranty',      '0.4', 'yearly'),
        ('/return-policy', '0.4', 'yearly'),
    ]

    try:
        all_products = get_all_products(active_only=True) or []
    except Exception:
        all_products = []

    xml = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']

    for path, priority, freq in static_urls:
        xml.append(f'  <url>\n'
                   f'    <loc>{base}{path}</loc>\n'
                   f'    <lastmod>{now}</lastmod>\n'
                   f'    <changefreq>{freq}</changefreq>\n'
                   f'    <priority>{priority}</priority>\n'
                   f'  </url>')

    for p in all_products:
        pid = p.get('id')
        if not pid:
            continue
        xml.append(f'  <url>\n'
                   f'    <loc>{base}/product/{pid}</loc>\n'
                   f'    <lastmod>{now}</lastmod>\n'
                   f'    <changefreq>weekly</changefreq>\n'
                   f'    <priority>0.8</priority>\n'
                   f'  </url>')

    xml.append('</urlset>')
    return Response('\n'.join(xml), mimetype='application/xml',
                    headers={'Content-Type': 'application/xml; charset=utf-8'})


@app.route('/robots.txt')
def robots_txt():
    """robots.txt — cho phép crawler, chặn admin/api."""
    base = _base_url()
    content = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin/\n"
        "Disallow: /api/\n"
        "Disallow: /landing\n"
        "\n"
        f"Sitemap: {base}/sitemap.xml\n"
    )
    return Response(content, mimetype='text/plain')




@app.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        cd = {
            'name':    request.form.get('name'),
            'email':   request.form.get('email'),
            'phone':   request.form.get('phone', ''),
            'subject': request.form.get('subject'),
            'message': request.form.get('message'),
        }
        if not all([cd['name'], cd['email'], cd['subject'], cd['message']]):
            flash('Vui lòng điền đầy đủ thông tin bắt buộc', 'error')
            return render_template('contact.html')

        if create_contact(cd):
            send_contact_email(cd)
            send_contact_reply_email(cd)
            flash('Cảm ơn! Chúng tôi sẽ phản hồi trong 24h.', 'success')
            return redirect(url_for('contact'))

        flash('Có lỗi xảy ra, vui lòng thử lại', 'error')
    return render_template('contact.html')


# ──────────────────────────────────────────
# Customer auth
# ──────────────────────────────────────────

@app.route('/register', methods=['GET', 'POST'])
def customer_register():
    if request.method == 'POST':
        email    = request.form.get('email')
        password = request.form.get('password')
        confirm  = request.form.get('confirm_password')
        name     = request.form.get('full_name') or request.form.get('name')
        phone    = request.form.get('phone')
        address  = request.form.get('address')

        if not all([email, password, name]):
            flash('Vui lòng điền đầy đủ thông tin', 'error')
        elif password != confirm:
            flash('Mật khẩu xác nhận không khớp', 'error')
        elif len(password) < 6:
            flash('Mật khẩu phải ≥ 6 ký tự', 'error')
        elif get_customer_by_email(email):
            flash('Email này đã được đăng ký', 'error')
        else:
            result = create_customer(email, password, name, phone, address)
            if result:
                _set_coupon_session()
                flash('Đăng ký thành công! Vui lòng đăng nhập.', 'success')
                return redirect(url_for('customer_login'))
            flash('Đã có lỗi xảy ra, vui lòng thử lại', 'error')

    return render_template('customer/register.html')


@app.route('/login', methods=['GET', 'POST'])
def customer_login():
    if request.method == 'POST':
        email    = request.form.get('email')
        password = request.form.get('password')
        remember = request.form.get('remember')

        customer = verify_customer(email, password)
        if customer:
            session['customer_logged_in'] = True
            session['customer_id']        = customer['id']
            session['customer_email']     = customer['email']
            session['customer_name']      = customer['full_name']
            session.permanent = bool(remember)  # FIX 9: lifetime set at startup

            _set_coupon_session()
            flash('Đăng nhập thành công!', 'success')

            next_page = request.args.get('next')
            return redirect(next_page if next_page else url_for('index'))

        flash('Email hoặc mật khẩu không đúng', 'error')
    return render_template('customer/login.html')


def _set_coupon_session():
    """Populate coupon session after login/register."""
    active_coupons = get_all_coupons(active_only=True, limit=5)
    session['coupons_list'] = [
        {
            'code':             c['code'],
            'name':             c['name'],
            'description':      c.get('description', ''),
            'discount_type':    c['discount_type'],
            'discount_value':   float(c['discount_value']),
            'min_order_amount': float(c.get('min_order_amount', 0)),
        }
        for c in active_coupons
    ]


# FIX 12: Password reset — store token in DB if possible, otherwise session
@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email    = request.form.get('email')
        if not email:
            flash('Vui lòng nhập email', 'error')
            return render_template('customer/forgot_password.html')

        customer = get_customer_by_email(email)
        if customer:
            import secrets
            token      = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            expires_at = datetime.now() + timedelta(hours=1)

            # FIX 12: Try DB first, fall back to session
            stored = False
            try:
                stored = save_reset_token(token_hash, email, expires_at)
            except Exception:
                pass

            if not stored:
                # Session fallback (single-server only)
                session.setdefault('reset_tokens', {})[token_hash] = {
                    'email':      email,
                    'expires_at': expires_at.isoformat(),
                }

            reset_url = url_for('reset_password', token=token, _external=True)
            send_password_reset_email(email, reset_url, customer['full_name'])

        # Always show same message to prevent email enumeration
        flash('Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.', 'success')
        return redirect(url_for('customer_login'))

    return render_template('customer/forgot_password.html')


@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # FIX 12: Try DB first
    token_data = None
    try:
        token_data = get_reset_token(token_hash)
        if token_data and token_data.get('expires_at') < datetime.now():
            token_data = None
    except Exception:
        pass

    # Session fallback
    if not token_data:
        raw = session.get('reset_tokens', {}).get(token_hash)
        if raw:
            if datetime.fromisoformat(raw['expires_at']) > datetime.now():
                token_data = {'email': raw['email']}
            else:
                session['reset_tokens'].pop(token_hash, None)

    if not token_data:
        flash('Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', 'error')
        return redirect(url_for('customer_login'))

    if request.method == 'POST':
        new_pw  = request.form.get('new_password', '')
        confirm = request.form.get('confirm_password', '')

        if not new_pw or not confirm:
            flash('Vui lòng điền đầy đủ thông tin', 'error')
        elif new_pw != confirm:
            flash('Mật khẩu xác nhận không khớp', 'error')
        elif len(new_pw) < 6:
            flash('Mật khẩu phải ≥ 6 ký tự', 'error')
        else:
            customer = get_customer_by_email(token_data['email'])
            if customer:
                update_customer_password(customer['id'], new_pw)
                try:
                    delete_reset_token(token_hash)
                except Exception:
                    session.get('reset_tokens', {}).pop(token_hash, None)
                flash('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.', 'success')
                return redirect(url_for('customer_login'))

    return render_template('customer/reset_password.html', token=token)


@app.route('/logout')
def customer_logout():
    for k in ('customer_logged_in', 'customer_id', 'customer_email', 'customer_name'):
        session.pop(k, None)
    flash('Đã đăng xuất', 'info')
    return redirect(url_for('index'))


@app.route('/account')
@login_required
def customer_account():
    customer = get_customer_by_id(session['customer_id'])
    cid      = session['customer_id']

    orders = execute_query(
        'SELECT * FROM orders WHERE customer_id=%s ORDER BY created_at DESC', (cid,),
        fetch=True
    ) or []

    wishlist          = get_wishlist(cid)
    customer_reviews  = execute_query(
        'SELECT * FROM product_reviews WHERE customer_id=%s ORDER BY created_at DESC LIMIT 10',
        (cid,), fetch=True
    ) or []
    shipping_addresses = get_shipping_addresses(cid)
    notifications     = get_notifications(cid, 'customer', unread_only=False, limit=10)
    unread_count      = count_unread_notifications(cid, 'customer')
    transactions      = execute_query("""
        SELECT pt.* FROM payment_transactions pt
        JOIN orders o ON pt.order_id = o.order_id
        WHERE o.customer_id = %s ORDER BY pt.created_at DESC LIMIT 10
    """, (cid,), fetch=True) or []

    import json
    for r in customer_reviews:
        if r.get('images'):
            try:
                r['images'] = json.loads(r['images'])
            except Exception:
                r['images'] = []

    return render_template('customer/account.html',
                           customer=customer, orders=orders,
                           wishlist=wishlist,
                           customer_reviews=customer_reviews,
                           shipping_addresses=shipping_addresses,
                           notifications=notifications,
                           unread_count=unread_count,
                           transactions=transactions)


@app.route('/account/update', methods=['POST'])
@login_required
def update_customer_info():
    data = {k: request.form.get(k) for k in ('full_name', 'phone', 'address')}
    if update_customer(session['customer_id'], data):
        session['customer_name'] = data['full_name']
        flash('Cập nhật thông tin thành công!', 'success')
    else:
        flash('Đã có lỗi xảy ra', 'error')
    return redirect(url_for('customer_account'))


@app.route('/account/change-password', methods=['POST'])
@login_required
def change_customer_password():
    customer = get_customer_by_id(session['customer_id'])
    cur_pw   = request.form.get('current_password', '')
    new_pw   = request.form.get('new_password', '')
    confirm  = request.form.get('confirm_password', '')

    if not verify_customer(customer['email'], cur_pw):
        flash('Mật khẩu hiện tại không đúng', 'error')
    elif new_pw != confirm:
        flash('Mật khẩu mới không khớp', 'error')
    elif len(new_pw) < 6:
        flash('Mật khẩu phải ≥ 6 ký tự', 'error')
    elif update_customer_password(session['customer_id'], new_pw):
        flash('Đổi mật khẩu thành công!', 'success')
    else:
        flash('Đã có lỗi xảy ra', 'error')
    return redirect(url_for('customer_account'))


@app.route('/order/<order_id>')
@login_required
def customer_order_detail(order_id):
    order = get_order_by_id(order_id)
    if not order:
        flash('Không tìm thấy đơn hàng', 'error')
        return redirect(url_for('customer_account'))
    if order.get('customer_id') != session.get('customer_id'):
        flash('Bạn không có quyền xem đơn hàng này', 'error')
        return redirect(url_for('customer_account'))
    history = get_order_status_history(order_id)
    return render_template('customer/order_detail.html', order=order, order_history=history)


@app.route('/order/<order_id>/cancel', methods=['POST'])
@login_required
def customer_cancel_order(order_id):
    order = get_order_by_id(order_id)
    if not order:
        flash('Không tìm thấy đơn hàng', 'error')
        return redirect(url_for('customer_account'))
    if order.get('customer_id') != session.get('customer_id'):
        flash('Không có quyền', 'error')
        return redirect(url_for('customer_account'))
    if order['status'] != 'pending':
        flash('Chỉ huỷ được đơn đang chờ xử lý', 'error')
        return redirect(url_for('customer_order_detail', order_id=order_id))

    if update_order_status(order_id, 'cancelled', order['payment_status']):
        flash('Đã hủy đơn hàng thành công', 'success')
    else:
        flash('Có lỗi xảy ra khi hủy đơn', 'error')
    return redirect(url_for('customer_account'))


# ──────────────────────────────────────────
# Admin auth
# ──────────────────────────────────────────

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        if not username or not password:
            flash('Vui lòng nhập đầy đủ thông tin', 'error')
        else:
            admin = verify_admin(username, password)
            if admin:
                session.update({
                    'admin_logged_in':   True,
                    'admin_id':          admin['id'],
                    'admin_username':    admin['username'],
                    'admin_name':        admin['full_name'],
                    'ddos_verified':     True,
                    'ddos_verified_time': time.time(),
                })
                flash('Đăng nhập thành công!', 'success')
                return redirect(url_for('admin_dashboard'))
            flash('Tên đăng nhập hoặc mật khẩu không đúng', 'error')
    return render_template('admin/login.html')


@app.route('/admin/logout')
def admin_logout():
    for k in ('admin_logged_in', 'admin_id', 'admin_username', 'admin_name'):
        session.pop(k, None)
    flash('Đã đăng xuất', 'info')
    return redirect(url_for('admin_login'))


# ──────────────────────────────────────────
# Admin pages (layout unchanged, just cleaned)
# ──────────────────────────────────────────

@app.route('/admin')
@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    stats = {
        'total_products':     count_products(),
        'total_orders':       count_orders(),
        'revenue':            get_revenue_stats(),
        'total_customers':    count_customers() or 0,
        'total_reviews':      count_reviews(),
        'pending_reviews':    count_reviews(approved_only=False),
        'total_coupons':      count_coupons(),
        'active_coupons':     count_coupons(active_only=True),
        'total_contacts':     count_contacts(),
        'new_contacts':       count_contacts(status='new'),
        'total_notifications': count_notifications(user_type='customer'),
        'unread_notifications': count_notifications(user_type='customer', unread_only=True),
        'total_transactions': count_payment_transactions(),
        'pending_transactions': count_payment_transactions(status='pending'),
    }
    return render_template('admin/dashboard.html',
                           stats=stats,
                           recent_orders=get_all_orders(limit=10),
                           revenue_by_day=get_revenue_by_period('day', 30),
                           revenue_by_payment=get_revenue_by_payment_method(),
                           top_products=get_top_products_by_revenue(5))


@app.route('/admin/reports/revenue')
@admin_required
def admin_revenue_report():
    period = request.args.get('period', 'day')
    days   = request.args.get('days', 30, type=int)
    return render_template('admin/revenue_report.html',
                           revenue_data=get_revenue_by_period(period, days),
                           revenue_by_payment=get_revenue_by_payment_method(),
                           top_products=get_top_products_by_revenue(20),
                           period=period, days=days)


@app.route('/admin/orders/export')
@admin_required
def admin_export_orders():
    import csv
    from io import StringIO

    q, params = 'SELECT * FROM orders WHERE 1=1', []
    for key, col in (('status', 'status'), ('payment_status', 'payment_status')):
        val = request.args.get(key)
        if val:
            q      += f' AND {col}=%s'
            params.append(val)
    for key, col in (('date_from', '>='), ('date_to', '<=')):
        val = request.args.get(key)
        if val:
            q      += f' AND DATE(created_at){col}%s'
            params.append(val)
    q += ' ORDER BY created_at DESC'

    orders = execute_query(q, tuple(params) if params else None, fetch=True) or []

    output = StringIO()
    w = csv.writer(output)
    w.writerow(['Mã Đơn', 'Khách Hàng', 'Email', 'SĐT', 'Địa Chỉ',
                'Tổng Tiền', 'Trạng Thái', 'Thanh Toán', 'Phương Thức', 'Ngày Đặt', 'Ghi Chú'])
    for o in orders:
        ca = o.get('created_at')
        w.writerow([o.get('order_id'), o.get('customer_name'), o.get('email'),
                    o.get('phone'), o.get('address'), o.get('total'), o.get('status'),
                    o.get('payment_status'), o.get('payment_method'),
                    ca.strftime('%d/%m/%Y %H:%M:%S') if ca else '', o.get('note', '')])
    output.seek(0)
    return Response(output.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition':
                             f'attachment; filename=orders_{datetime.now():%Y%m%d_%H%M%S}.csv'})


@app.route('/admin/products')
@admin_required
def admin_products():
    seen, unique = set(), []
    for p in get_all_products(active_only=False):
        if p and isinstance(p, dict):
            try:
                pid = int(p.get('id'))
                if pid not in seen:
                    seen.add(pid)
                    unique.append(p)
            except (TypeError, ValueError):
                pass
    return render_template('admin/products.html',
                           products=unique, categories=get_category_names())


def _product_data_from_form() -> dict:
    features = [f.strip() for f in request.form.get('features', '').split('\n') if f.strip()]
    return {
        'name':           request.form.get('name'),
        'category':       request.form.get('category'),
        'price':          float(request.form.get('price', 0)),
        'original_price': float(request.form.get('original_price', 0)),
        'image':          request.form.get('image', ''),
        'description':    request.form.get('description', ''),
        'features':       features,
        'rating':         float(request.form.get('rating', 5.0)),
        'reviews':        int(request.form.get('reviews', 0)),
        'stock':          int(request.form.get('stock', 100)),
    }


def _get_variants(product_id):
    return execute_query(
        'SELECT * FROM product_variants WHERE product_id=%s ORDER BY type, sort_order, id',
        (product_id,), fetch=True
    ) or []

@app.route('/admin/products/add', methods=['GET', 'POST'])
@admin_required
def admin_add_product():
    if request.method == 'POST':
        try:
            pd = _product_data_from_form()
            if not pd['name'] or not pd['category']:
                flash('Vui lòng điền tên và danh mục', 'error')
            elif pd['price'] <= 0:
                flash('Giá bán phải > 0', 'error')
            elif create_product(pd):
                flash('Thêm sản phẩm thành công!', 'success')
                return redirect(url_for('admin_products'))
            else:
                flash('Lỗi khi thêm sản phẩm', 'error')
        except Exception as exc:
            flash(f'Lỗi: {exc}', 'error')
    return render_template('admin/product_form.html',
                           product=None, categories=get_category_names(), action='add', variants=[])


@app.route('/admin/products/edit/<int:product_id>', methods=['GET', 'POST'])
@admin_required
def admin_edit_product(product_id):
    product = get_product_by_id(product_id)
    if not product:
        flash('Không tìm thấy sản phẩm', 'error')
        return redirect(url_for('admin_products'))

    if request.method == 'POST':
        try:
            pd = _product_data_from_form()
            pd['is_active'] = request.form.get('is_active') == 'on'
            if not pd['name'] or not pd['category']:
                flash('Vui lòng điền tên và danh mục', 'error')
            elif pd['price'] <= 0:
                flash('Giá bán phải > 0', 'error')
            elif update_product(product_id, pd):
                flash('Cập nhật thành công!', 'success')
                return redirect(url_for('admin_products'))
            else:
                flash('Lỗi khi cập nhật sản phẩm', 'error')
        except Exception as exc:
            flash(f'Lỗi: {exc}', 'error')

    return render_template('admin/product_form.html',
                           product=product, categories=get_category_names(), action='edit',
                           product_images=get_product_images(product_id),
                           variants=_get_variants(product_id))


@app.route('/admin/products/delete/<int:product_id>', methods=['POST'])
@admin_required
def admin_delete_product(product_id):
    product = get_product_by_id(product_id)
    if not product:
        flash('Không tìm thấy sản phẩm', 'error')
        return redirect(url_for('admin_products'))
    try:
        if request.form.get('hard_delete') == 'true':
            from db_helper import hard_delete_product
            ok = hard_delete_product(product_id)
            flash(f'Đã xóa vĩnh viễn "{product["name"]}"!' if ok else 'Lỗi xóa vĩnh viễn', 'success' if ok else 'error')
        else:
            ok = delete_product(product_id)
            flash(f'Đã ẩn "{product["name"]}"!' if ok else 'Lỗi ẩn sản phẩm', 'success' if ok else 'error')
    except Exception as exc:
        flash(f'Lỗi: {exc}', 'error')
    return redirect(url_for('admin_products'))


@app.route('/admin/products/restore/<int:product_id>', methods=['POST'])
@admin_required
def admin_restore_product(product_id):
    product = get_product_by_id(product_id)
    if not product:
        flash('Không tìm thấy sản phẩm', 'error')
        return redirect(url_for('admin_products'))
    ok = execute_query('UPDATE products SET is_active=TRUE WHERE id=%s', (product_id,))
    flash(f'Đã khôi phục "{product["name"]}"!' if ok else 'Lỗi khôi phục',
          'success' if ok else 'error')
    return redirect(url_for('admin_products'))


@app.route('/admin/products/bulk-action', methods=['POST'])
@admin_required
def admin_products_bulk_action():
    action  = request.form.get('action', '')
    ids_raw = request.form.get('ids', '')
    try:
        ids = [int(i) for i in ids_raw.split(',') if i.strip().isdigit()]
    except Exception:
        ids = []
    if not ids:
        flash('Không có sản phẩm nào được chọn', 'error')
        return redirect(url_for('admin_products'))

    count = len(ids)
    if action == 'hide':
        for pid in ids:
            execute_query('UPDATE products SET is_active=FALSE WHERE id=%s', (pid,))
        flash(f'Đã ẩn {count} sản phẩm', 'success')
    elif action == 'restore':
        for pid in ids:
            execute_query('UPDATE products SET is_active=TRUE WHERE id=%s', (pid,))
        flash(f'Đã hiển thị {count} sản phẩm', 'success')
    elif action == 'delete':
        for pid in ids:
            execute_query('DELETE FROM products WHERE id=%s', (pid,))
        flash(f'Đã xóa {count} sản phẩm', 'success')
    else:
        flash('Hành động không hợp lệ', 'error')

    return redirect(url_for('admin_products'))



@app.route('/admin/products/<int:product_id>/images')
@admin_required
def admin_product_images(product_id):
    product = get_product_by_id(product_id)
    if not product:
        flash('Không tìm thấy sản phẩm', 'error')
        return redirect(url_for('admin_products'))
    return render_template('admin/product_images.html',
                           product=product, images=get_product_images(product_id))


@app.route('/admin/products/<int:product_id>/images/add', methods=['POST'])
@admin_required
def admin_add_product_image(product_id):
    url        = request.form.get('image_url', '').strip()
    alt_text   = request.form.get('alt_text', '')
    is_primary = request.form.get('is_primary') == 'on'

    if not url:
        flash('Vui lòng nhập URL ảnh', 'error')
    elif add_product_image(product_id, url, alt_text, is_primary):
        # FIX: đồng bộ ảnh chính sang products.image để trang khách hàng thấy
        if is_primary:
            execute_query('UPDATE products SET image=%s WHERE id=%s', (url, product_id))
        flash('Thêm ảnh thành công!', 'success')
    else:
        flash('Lỗi thêm ảnh', 'error')
    return redirect(url_for('admin_product_images', product_id=product_id))


@app.route('/admin/products/<int:product_id>/images/<int:image_id>/delete', methods=['POST'])
@admin_required
def admin_delete_product_image(product_id, image_id):
    # Kiểm tra xem ảnh bị xóa có phải ảnh chính không
    img = execute_query('SELECT is_primary, image_url FROM product_images WHERE id=%s',
                        (image_id,), fetch=True, fetch_one=True)
    was_primary = img and img.get('is_primary')

    # FIX: chỉ gọi 1 lần, lưu kết quả vào biến
    ok = delete_product_image(image_id)
    if ok:
        flash('Đã xóa ảnh!', 'success')
        # Nếu xóa ảnh chính → tự động chọn ảnh khác làm ảnh chính
        if was_primary:
            new_primary = execute_query(
                'SELECT id, image_url FROM product_images WHERE product_id=%s ORDER BY id LIMIT 1',
                (product_id,), fetch=True, fetch_one=True
            )
            if new_primary:
                execute_query('UPDATE product_images SET is_primary=TRUE WHERE id=%s',
                              (new_primary['id'],))
                execute_query('UPDATE products SET image=%s WHERE id=%s',
                              (new_primary['image_url'], product_id))
            else:
                # Không còn ảnh nào → xóa luôn products.image
                execute_query('UPDATE products SET image=NULL WHERE id=%s', (product_id,))
    else:
        flash('Lỗi xóa ảnh', 'error')
    return redirect(url_for('admin_product_images', product_id=product_id))


@app.route('/admin/products/<int:product_id>/images/<int:image_id>/set-primary', methods=['POST'])
@admin_required
def admin_set_primary_image(product_id, image_id):
    execute_query('UPDATE product_images SET is_primary=FALSE WHERE product_id=%s', (product_id,))
    ok = execute_query('UPDATE product_images SET is_primary=TRUE WHERE id=%s', (image_id,))

    if ok:
        # FIX: đồng bộ sang products.image để trang chủ/sản phẩm thấy ngay
        img = execute_query('SELECT image_url FROM product_images WHERE id=%s',
                            (image_id,), fetch=True, fetch_one=True)
        if img and img.get('image_url'):
            execute_query('UPDATE products SET image=%s WHERE id=%s',
                          (img['image_url'], product_id))
        flash('Đã đặt ảnh chính! Trang khách hàng đã được cập nhật.', 'success')
    else:
        flash('Lỗi đặt ảnh chính', 'error')
    return redirect(url_for('admin_product_images', product_id=product_id))


# ══════════════════════════════════════════════
# Product Variants — color / material
# ══════════════════════════════════════════════

@app.route('/admin/products/<int:product_id>/variants')
@admin_required
def admin_product_variants(product_id):
    product = get_product_by_id(product_id)
    if not product:
        flash('Không tìm thấy sản phẩm', 'error')
        return redirect(url_for('admin_products'))
    variants = _get_variants(product_id)
    return render_template('admin/product_variants.html',
                           product=product, variants=variants)

@app.route('/admin/products/<int:product_id>/variants/add', methods=['POST'])
@admin_required
def admin_add_variant(product_id):
    try:
        vtype      = request.form.get('type', 'color')
        name       = request.form.get('name', '').strip()
        value      = request.form.get('value', '').strip()
        image_url  = request.form.get('image_url', '').strip()
        price_diff = float(request.form.get('price_diff', 0) or 0)
        stock      = int(request.form.get('stock', 0) or 0)
        if not name:
            return jsonify({'success': False, 'message': 'Tên variant không được trống'})
        execute_query(
            'INSERT INTO product_variants (product_id,type,name,value,image_url,price_diff,stock) VALUES (%s,%s,%s,%s,%s,%s,%s)',
            (product_id, vtype, name, value, image_url or None, price_diff, stock)
        )
        return jsonify({'success': True, 'message': 'Đã thêm variant'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/admin/products/<int:product_id>/variants/<int:variant_id>/update', methods=['POST'])
@admin_required
def admin_update_variant(product_id, variant_id):
    try:
        name       = request.form.get('name', '').strip()
        value      = request.form.get('value', '').strip()
        image_url  = request.form.get('image_url', '').strip()
        price_diff = float(request.form.get('price_diff', 0) or 0)
        stock      = int(request.form.get('stock', 0) or 0)
        is_active  = request.form.get('is_active') == '1'
        execute_query(
            'UPDATE product_variants SET name=%s,value=%s,image_url=%s,price_diff=%s,stock=%s,is_active=%s WHERE id=%s AND product_id=%s',
            (name, value, image_url or None, price_diff, stock, is_active, variant_id, product_id)
        )
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/admin/products/<int:product_id>/variants/<int:variant_id>/delete', methods=['POST'])
@admin_required
def admin_delete_variant(product_id, variant_id):
    execute_query('DELETE FROM product_variants WHERE id=%s AND product_id=%s', (variant_id, product_id))
    return jsonify({'success': True})

@app.route('/api/products/<int:product_id>/variants')
def api_product_variants(product_id):
    """Public API — trả về variants cho frontend."""
    variants = execute_query(
        'SELECT id,type,name,value,image_url,price_diff,stock FROM product_variants WHERE product_id=%s AND is_active=TRUE ORDER BY type,sort_order,id',
        (product_id,), fetch=True
    ) or []
    return jsonify({'success': True, 'variants': variants})



@app.route('/admin/orders')
@admin_required
def admin_orders():
    return render_template('admin/orders.html', orders=get_all_orders())


@app.route('/admin/orders/<order_id>')
@admin_required
def admin_order_detail(order_id):
    order = get_order_by_id(order_id)
    if not order:
        flash('Không tìm thấy đơn hàng', 'error')
        return redirect(url_for('admin_orders'))
    return render_template('admin/order_detail.html', order=order)


@app.route('/admin/orders/<order_id>/update-status', methods=['POST'])
@admin_required
def admin_update_order_status(order_id):
    ok = update_order_status(
        order_id,
        request.form.get('status'),
        request.form.get('payment_status'),
        request.form.get('note', ''),
        session.get('admin_username', 'admin'),
    )
    flash('Cập nhật thành công!' if ok else 'Lỗi cập nhật', 'success' if ok else 'error')
    return redirect(url_for('admin_order_detail', order_id=order_id))


# Admin settings
@app.route('/admin/settings', methods=['GET', 'POST'])
@admin_required
def admin_settings():
    if request.method == 'POST':
        # ── Tạo programmatically để tránh thiếu sót ──────────────────
        keys = [
            # General
            'site_logo', 'site_name', 'site_description', 'site_url',
            # Hero banner (legacy single)
            'hero_banner_image', 'hero_banner_title', 'hero_banner_subtitle',
            'hero_banner_button_text', 'hero_banner_button_link',
            # Hero slider (multi-image) — hero_1_* … hero_5_* + interval
            'hero_interval',
            *[f'hero_{i}_{f}'
              for i in range(1, 6)
              for f in ('image', 'eyebrow', 'title', 'subtitle', 'link', 'btn')],
            # Promo banners — promo_1_* … promo_6_*
            *[f'promo_{i}_{f}'
              for i in range(1, 7)
              for f in ('image', 'tag', 'title', 'link', 'btn')],
            # Partners — partner_1_* … partner_6_*
            *[f'partner_{i}_{f}'
              for i in range(1, 7)
              for f in ('name', 'logo', 'url')],
            # Contact
            'contact_phone', 'contact_email', 'contact_address',
            'contact_facebook', 'contact_zalo', 'contact_instagram',
            'contact_youtube', 'contact_tiktok',
            # Payment
            'bank_code', 'bank_name', 'account_number', 'account_name',
            'paypal_client_id', 'vnd_usd_rate',
            # Email
            'smtp_server', 'smtp_port', 'sender_email',
            # Shipping
            'shipping_fee', 'free_shipping_threshold',
            # SEO
            'meta_description', 'meta_keywords', 'google_analytics',
            # Misc
            'currency', 'tax_rate', 'maintenance_message',
            'session_timeout', 'password_min_length',
            'products_per_page', 'orders_per_page',
            'nft_contract_address', 'nft_testnet_contract_address',
        ]
        sensitive = ('sender_password', 'paypal_client_secret', 'nft_minter_private_key')
        checkboxes = (
            'email_enabled', 'maintenance_mode', 'enable_reviews',
            'enable_coupons', 'enable_notifications',
            'paypal_sandbox', 'nft_enabled', 'web3_testnet_mode',
        )

        updates = {k: request.form.get(k, '') for k in keys}
        for k in sensitive:
            v = request.form.get(k, '')
            if v:  # Only update if provided
                updates[k] = v
        for k in checkboxes:
            updates[k] = '1' if request.form.get(k) in ('1', 'on') else '0'

        try:
            if update_multiple_settings(updates):
                invalidate_settings_cache()  # FIX 10
                flash('Cập nhật cài đặt thành công!', 'success')
            else:
                flash('Có lỗi xảy ra', 'error')
        except Exception as exc:
            flash(f'Lỗi: {exc}', 'error')

        return redirect(url_for('admin_settings'))

    settings     = get_all_settings()
    settings_dict = {s['setting_key']: s for s in settings} if settings else {}
    return render_template('admin/settings.html', settings=settings_dict)


# Admin customers
@app.route('/admin/customers')
@admin_required
def admin_customers():
    page   = request.args.get('page', 1, type=int)
    search = request.args.get('search', '')
    status = request.args.get('status', '')
    per_page = 20

    customers       = get_all_customers(search=search or None, status_filter=status or None,
                                        limit=per_page, offset=(page-1)*per_page)
    total_customers = count_customers(search=search or None, status_filter=status or None)
    total_pages     = (total_customers + per_page - 1) // per_page

    return render_template('admin/customers.html',
                           customers=customers, stats=get_customer_stats(),
                           page=page, total_pages=total_pages,
                           total_customers=total_customers,
                           search=search, status_filter=status)


@app.route('/admin/customers/<int:customer_id>')
@admin_required
def admin_customer_detail(customer_id):
    customer = get_customer_by_id(customer_id)
    if not customer:
        flash('Không tìm thấy khách hàng', 'error')
        return redirect(url_for('admin_customers'))
    orders = execute_query(
        'SELECT * FROM orders WHERE customer_id=%s ORDER BY created_at DESC',
        (customer_id,), fetch=True
    ) or []
    return render_template('admin/customer_detail.html', customer=customer, orders=orders)


@app.route('/admin/customers/<int:customer_id>/edit', methods=['GET', 'POST'])
@admin_required
def admin_edit_customer(customer_id):
    customer = get_customer_by_id(customer_id)
    if not customer:
        flash('Không tìm thấy khách hàng', 'error')
        return redirect(url_for('admin_customers'))

    if request.method == 'POST':
        data = {
            'full_name': request.form.get('full_name'),
            'phone':     request.form.get('phone'),
            'address':   request.form.get('address'),
            'is_active': request.form.get('is_active') == 'true',
        }
        if update_customer_by_admin(customer_id, data):
            flash('Cập nhật thành công!', 'success')
            return redirect(url_for('admin_customer_detail', customer_id=customer_id))
        flash('Lỗi cập nhật', 'error')

    return render_template('admin/customer_edit.html', customer=customer)


@app.route('/admin/customers/<int:customer_id>/toggle-status', methods=['POST'])
@admin_required
def admin_toggle_customer_status(customer_id):
    ok = toggle_customer_status(customer_id)
    flash('Đã cập nhật trạng thái' if ok else 'Lỗi', 'success' if ok else 'error')
    return redirect(url_for('admin_customers'))


@app.route('/admin/customers/<int:customer_id>/delete', methods=['POST'])
@admin_required
def admin_delete_customer(customer_id):
    customer = get_customer_by_id(customer_id)
    if not customer:
        flash('Không tìm thấy khách hàng', 'error')
        return redirect(url_for('admin_customers'))
    if delete_customer(customer_id):
        flash(f'Đã xóa {customer["full_name"]}', 'success')
    else:
        flash('Lỗi xóa khách hàng', 'error')
    return redirect(url_for('admin_customers'))


# Admin reviews
@app.route('/admin/reviews')
@admin_required
def admin_reviews():
    page   = request.args.get('page', 1, type=int)
    af     = request.args.get('approved', '')
    per_page = 20

    approved_only = {'true': True, 'false': False}.get(af)
    reviews       = get_all_reviews(approved_only=approved_only,
                                    limit=per_page, offset=(page-1)*per_page)
    total         = count_reviews(approved_only=approved_only)

    products_dict = {}
    for r in reviews:
        pid = r.get('product_id')
        if pid and pid not in products_dict:
            p = get_product_by_id(pid)
            if p:
                products_dict[pid] = p

    return render_template('admin/reviews.html',
                           reviews=reviews, products_dict=products_dict,
                           stats={'total': count_reviews(),
                                  'approved': count_reviews(approved_only=True),
                                  'pending':  count_reviews(approved_only=False)},
                           page=page, total_pages=(total+per_page-1)//per_page,
                           total_reviews=total, approved_filter=af)


@app.route('/admin/reviews/<int:review_id>/approve', methods=['POST'])
@admin_required
def admin_approve_review(review_id):
    flash('Đã duyệt' if update_review_status(review_id, True) else 'Lỗi',
          'success' if update_review_status(review_id, True) else 'error')
    return redirect(url_for('admin_reviews'))


@app.route('/admin/reviews/<int:review_id>/reject', methods=['POST'])
@admin_required
def admin_reject_review(review_id):
    flash('Đã từ chối' if update_review_status(review_id, False) else 'Lỗi',
          'success' if update_review_status(review_id, False) else 'error')
    return redirect(url_for('admin_reviews'))


@app.route('/admin/reviews/<int:review_id>/delete', methods=['POST'])
@admin_required
def admin_delete_review(review_id):
    flash('Đã xóa' if delete_review(review_id) else 'Lỗi',
          'success' if delete_review(review_id) else 'error')
    return redirect(url_for('admin_reviews'))


# Admin coupons
@app.route('/admin/coupons')
@admin_required
def admin_coupons():
    page     = request.args.get('page', 1, type=int)
    af       = request.args.get('active', '')
    per_page = 20
    active_only = {'true': True, 'false': False}.get(af)

    coupons = get_all_coupons(active_only=active_only, limit=per_page, offset=(page-1)*per_page)
    total   = count_coupons(active_only=active_only)

    return render_template('admin/coupons.html',
                           coupons=coupons,
                           stats={'total':    count_coupons(),
                                  'active':   count_coupons(active_only=True),
                                  'inactive': count_coupons(active_only=False)},
                           page=page, total_pages=(total+per_page-1)//per_page,
                           total_coupons=total, active_filter=af)


def _coupon_data_from_form() -> dict:
    def _parse_dt(key):
        v = request.form.get(key)
        return datetime.strptime(v, '%Y-%m-%dT%H:%M') if v else None

    return {
        'name':               request.form.get('name'),
        'description':        request.form.get('description'),
        'discount_type':      request.form.get('discount_type'),
        'discount_value':     float(request.form.get('discount_value', 0)),
        'min_order_amount':   float(request.form.get('min_order_amount', 0)),
        'max_discount_amount': float(request.form.get('max_discount_amount', 0))
                               if request.form.get('max_discount_amount') else None,
        'usage_limit':        int(request.form.get('usage_limit'))
                               if request.form.get('usage_limit') else None,
        'start_date':         _parse_dt('start_date'),
        'end_date':           _parse_dt('end_date'),
        'is_active':          request.form.get('is_active') == 'true',
    }


def _validate_coupon(d: dict, start_date=None, end_date=None) -> str | None:
    if not d.get('name'):                           return 'Vui lòng điền tên'
    if not d.get('discount_type'):                  return 'Vui lòng chọn loại giảm giá'
    if d['discount_value'] <= 0:                    return 'Giá trị giảm giá phải > 0'
    if d['discount_type'] == 'percentage' and d['discount_value'] > 100:
                                                    return 'Phần trăm không được > 100%'
    if start_date and end_date and start_date >= end_date:
                                                    return 'Ngày kết thúc phải sau ngày bắt đầu'
    return None


@app.route('/admin/coupons/add', methods=['GET', 'POST'])
@admin_required
def admin_add_coupon():
    if request.method == 'POST':
        try:
            data = _coupon_data_from_form()
            data['code'] = request.form.get('code')
            if not data['code']:
                flash('Vui lòng nhập mã', 'error')
            else:
                err = _validate_coupon(data, data['start_date'], data['end_date'])
                if err:
                    flash(err, 'error')
                elif create_coupon(data):
                    flash('Tạo mã thành công!', 'success')
                    return redirect(url_for('admin_coupons'))
                else:
                    flash('Lỗi tạo mã (có thể đã tồn tại)', 'error')
        except Exception as exc:
            flash(f'Lỗi: {exc}', 'error')
    return render_template('admin/coupon_form.html', coupon=None)


@app.route('/admin/coupons/<int:coupon_id>/edit', methods=['GET', 'POST'])
@admin_required
def admin_edit_coupon(coupon_id):
    coupon = get_coupon_by_id(coupon_id)
    if not coupon:
        flash('Không tìm thấy mã giảm giá', 'error')
        return redirect(url_for('admin_coupons'))

    if request.method == 'POST':
        try:
            data = _coupon_data_from_form()
            err  = _validate_coupon(data, data['start_date'], data['end_date'])
            if err:
                flash(err, 'error')
            elif update_coupon(coupon_id, data):
                flash('Cập nhật thành công!', 'success')
                return redirect(url_for('admin_coupons'))
            else:
                flash('Lỗi cập nhật mã', 'error')
        except Exception as exc:
            flash(f'Lỗi: {exc}', 'error')

    return render_template('admin/coupon_form.html', coupon=coupon)


@app.route('/admin/coupons/<int:coupon_id>/delete', methods=['POST'])
@admin_required
def admin_delete_coupon(coupon_id):
    flash('Đã xóa mã' if delete_coupon(coupon_id) else 'Lỗi xóa',
          'success' if delete_coupon(coupon_id) else 'error')
    return redirect(url_for('admin_coupons'))


# Admin notifications
@app.route('/admin/notifications')
@admin_required
def admin_notifications():
    page     = request.args.get('page', 1, type=int)
    unread   = request.args.get('unread', '') == 'true'
    per_page = 20

    notifications = get_all_notifications(user_type='customer', unread_only=unread,
                                          limit=per_page, offset=(page-1)*per_page)
    total         = count_notifications(user_type='customer', unread_only=unread)

    return render_template('admin/notifications.html',
                           notifications=notifications,
                           stats={'total':  count_notifications(user_type='customer'),
                                  'unread': count_notifications(user_type='customer', unread_only=True)},
                           page=page, total_pages=(total+per_page-1)//per_page,
                           total_notifications=total, unread_only=unread)


# Admin payment transactions
@app.route('/admin/payment-transactions')
@admin_required
def admin_payment_transactions():
    page   = request.args.get('page', 1, type=int)
    status = request.args.get('status', '')
    per_page = 20

    txns  = get_all_payment_transactions(status=status or None,
                                         limit=per_page, offset=(page-1)*per_page)
    total = count_payment_transactions(status=status or None)

    return render_template('admin/payment_transactions.html',
                           transactions=txns,
                           stats={'total':     count_payment_transactions(),
                                  'pending':   count_payment_transactions(status='pending'),
                                  'completed': count_payment_transactions(status='completed'),
                                  'failed':    count_payment_transactions(status='failed')},
                           page=page, total_pages=(total+per_page-1)//per_page,
                           total_transactions=total, status_filter=status)


# Admin contacts
@app.route('/admin/contacts')
@admin_required
def admin_contacts():
    page   = request.args.get('page', 1, type=int)
    status = request.args.get('status', '')
    per_page = 20

    contacts    = get_all_contacts(status=status or None)
    total       = len(contacts)
    start       = (page - 1) * per_page
    page_items  = contacts[start:start + per_page]
    total_pages = (total + per_page - 1) // per_page

    return render_template('admin/contacts.html',
                           contacts=page_items,
                           stats={'total':   total,
                                  'new':     sum(1 for c in contacts if c.get('status') == 'new'),
                                  'replied': sum(1 for c in contacts if c.get('replied'))},
                           page=page, total_pages=total_pages,
                           total_contacts=total, status_filter=status)


@app.route('/admin/contacts/<int:contact_id>/mark-replied', methods=['POST'])
@admin_required
def admin_mark_contact_replied(contact_id):
    ok = execute_query("UPDATE contacts SET replied=TRUE, status='replied' WHERE id=%s",
                       (contact_id,))
    flash('Đã đánh dấu đã trả lời' if ok else 'Lỗi', 'success' if ok else 'error')
    return redirect(url_for('admin_contacts'))


@app.route('/admin/contacts/<int:contact_id>/delete', methods=['POST'])
@admin_required
def admin_delete_contact(contact_id):
    ok = execute_query('DELETE FROM contacts WHERE id=%s', (contact_id,))
    flash('Đã xóa tin nhắn' if ok else 'Lỗi', 'success' if ok else 'error')
    return redirect(url_for('admin_contacts'))


# ──────────────────────────────────────────
# API — Reviews, Wishlist, Coupon, Addresses,
#        Notifications, Cart sync, Orders
# ──────────────────────────────────────────

@app.route('/api/product/<int:product_id>/reviews')
def get_reviews(product_id):
    rf       = request.args.get('rating', type=int)
    sort     = request.args.get('sort', 'newest')
    page     = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    reviews  = get_product_reviews(product_id, approved_only=True,
                                   rating_filter=rf, sort_by=sort,
                                   limit=per_page, offset=(page-1)*per_page)
    q   = 'SELECT COUNT(*) AS c FROM product_reviews WHERE product_id=%s AND is_approved=TRUE'
    args = (product_id,)
    if rf:
        q    += ' AND rating=%s'
        args  = (product_id, rf)
    row   = execute_query(q, args, fetch=True, fetch_one=True)
    total = (row or {}).get('c', 0)
    return jsonify({'success': True, 'reviews': reviews,
                    'pagination': {'page': page, 'per_page': per_page,
                                   'total': total, 'total_pages': (total+per_page-1)//per_page}})


@app.route('/api/product/<int:product_id>/reviews/stats')
def get_review_stats(product_id):
    return jsonify({'success': True, 'stats': get_review_rating_stats(product_id)})


@app.route('/api/review/<int:review_id>/helpful', methods=['POST'])
def mark_review_helpful_route(review_id):
    if mark_review_helpful(review_id):
        r = get_review_by_id(review_id)
        return jsonify({'success': True, 'helpful_count': (r or {}).get('helpful_count', 0)})
    return jsonify({'success': False, 'message': 'Lỗi'}), 400


@app.route('/api/product/<int:product_id>/review', methods=['POST'])
@login_required
def add_review(product_id):
    cid      = session['customer_id']
    customer = get_customer_by_id(cid)
    if not customer:
        return jsonify({'success': False, 'message': 'Không tìm thấy khách hàng'}), 401

    existing = execute_query(
        'SELECT id FROM product_reviews WHERE product_id=%s AND customer_id=%s',
        (product_id, cid), fetch=True, fetch_one=True
    )
    if existing:
        return jsonify({'success': False, 'message': 'Bạn đã đánh giá sản phẩm này'}), 400

    row = execute_query("""
        SELECT COUNT(*) AS cnt FROM orders o
        JOIN order_items oi ON o.order_id=oi.order_id
        WHERE o.customer_id=%s AND oi.product_id=%s AND o.payment_status='paid'
    """, (cid, product_id), fetch=True, fetch_one=True)
    purchased = bool(row and row.get('cnt', 0) > 0)

    data = request.json or {}
    rid  = create_product_review({
        'product_id':          product_id,
        'customer_id':         cid,
        'customer_name':       customer['full_name'],
        'rating':              data.get('rating', 5),
        'title':               data.get('title', ''),
        'comment':             data.get('comment', ''),
        'images':              data.get('images', []),
        'is_verified_purchase': purchased,
    })
    if rid:
        return jsonify({'success': True, 'message': 'Đánh giá đã gửi. Cảm ơn bạn!'})
    return jsonify({'success': False, 'message': 'Có lỗi xảy ra'}), 400


# Wishlist
@app.route('/api/wishlist')
@login_required
def get_wishlist_route():
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401
    return jsonify({'success': True, 'wishlist': get_wishlist(customer['id'])})


@app.route('/api/wishlist/toggle/<int:product_id>', methods=['POST'])
@login_required
def toggle_wishlist(product_id):
    """Single-request wishlist toggle (replaces separate add/remove)."""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401
    cid = customer['id']
    in_wl = is_in_wishlist(cid, product_id)
    if in_wl:
        ok = remove_from_wishlist(cid, product_id)
    else:
        ok = add_to_wishlist(cid, product_id)
    return jsonify({'success': ok, 'in_wishlist': not in_wl if ok else in_wl,
                    'message': ('Đã xóa' if in_wl else 'Đã thêm') + ' khỏi yêu thích'})


# FIX 8: keep old endpoints for backward compat, delegate to toggle
@app.route('/api/wishlist/add/<int:product_id>', methods=['POST'])
@login_required
def add_to_wishlist_route(product_id):
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401
    ok = add_to_wishlist(customer['id'], product_id)
    return jsonify({'success': ok, 'message': 'Đã thêm vào yêu thích' if ok else 'Lỗi'})


@app.route('/api/wishlist/remove/<int:product_id>', methods=['POST'])
@login_required
def remove_from_wishlist_route(product_id):
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401
    ok = remove_from_wishlist(customer['id'], product_id)
    return jsonify({'success': ok, 'message': 'Đã xóa' if ok else 'Lỗi'})


@app.route('/api/wishlist/check/<int:product_id>')
@login_required
def check_wishlist_route(product_id):
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'in_wishlist': False})
    return jsonify({'success': True, 'in_wishlist': is_in_wishlist(customer['id'], product_id)})


@app.route('/api/wishlist/check-batch', methods=['POST'])
@login_required
def check_wishlist_batch():
    """Batch wishlist status check — replaces N individual requests."""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401

    product_ids = (request.json or {}).get('product_ids', [])
    statuses = {}
    for pid in product_ids:
        try:
            statuses[int(pid)] = is_in_wishlist(customer['id'], int(pid))
        except (TypeError, ValueError):
            pass
    return jsonify({'success': True, 'statuses': statuses})


# Coupon
@app.route('/api/coupons/available')
def api_available_coupons():
    """Trả về danh sách mã giảm giá công khai đang hoạt động."""
    try:
        from datetime import date, datetime
        today = date.today()
        coupons = get_all_coupons(active_only=True, limit=50) or []
        result = []
        for c in coupons:
            # Bỏ qua nếu hết lượt
            if c.get('usage_limit') and int(c.get('usage_count') or 0) >= int(c['usage_limit']):
                continue

            # Xử lý end_date — có thể là date, datetime, string, hoặc None
            end_date = c.get('end_date')
            if end_date:
                try:
                    if isinstance(end_date, datetime):
                        end_date = end_date.date()
                    elif isinstance(end_date, str):
                        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                    if end_date < today:
                        continue   # Đã hết hạn
                    end_date_str = end_date.strftime('%d/%m/%Y')
                except Exception:
                    end_date_str = str(end_date)
            else:
                end_date_str = None

            result.append({
                'code':             c.get('code', ''),
                'name':             c.get('name', ''),
                'description':      c.get('description') or '',
                'discount_type':    c.get('discount_type', 'percentage'),
                'discount_value':   float(c.get('discount_value') or 0),
                'min_order_amount': float(c.get('min_order_amount') or 0),
                'end_date':         end_date_str,
            })

        return jsonify({'success': True, 'coupons': result, 'count': len(result)})
    except Exception as e:
        app.logger.exception('Error in api_available_coupons')
        return jsonify({'success': False, 'coupons': [], 'error': str(e)})



def validate_coupon_route():
    try:
        data         = request.json or {}
        code         = data.get('code', '').strip().upper()
        order_amount = float(data.get('order_amount', 0))

        if not code:
            return jsonify({'valid': False, 'message': 'Vui lòng nhập mã'}), 400
        if order_amount <= 0:
            return jsonify({'valid': False, 'message': 'Tổng tiền không hợp lệ'}), 400

        result = apply_coupon(code, order_amount)

        if result.get('valid'):
            result['discount']     = float(result['discount'])
            result['final_amount'] = float(result['final_amount'])
            if 'coupon' in result:
                safe = {}
                for k, v in result['coupon'].items():
                    if v is None or isinstance(v, (int, float, str, bool)):
                        safe[k] = v
                    elif hasattr(v, 'isoformat'):
                        safe[k] = v.isoformat()
                    else:
                        try:
                            safe[k] = float(v)
                        except (TypeError, ValueError):
                            safe[k] = str(v)
                result['coupon'] = safe

        return jsonify(result)
    except Exception as exc:
        app.logger.exception('validate_coupon_route error')
        return jsonify({'valid': False, 'message': f'Lỗi: {exc}'}), 500


# Shipping addresses
@app.route('/api/shipping-addresses')
@login_required
def get_shipping_addresses_route():
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401
    return jsonify({'success': True, 'addresses': get_shipping_addresses(customer['id'])})


@app.route('/api/shipping-address', methods=['POST'])
@login_required
def create_shipping_address_route():
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401
    addr_id = create_shipping_address(customer['id'], request.json or {})
    return (jsonify({'success': True, 'address_id': addr_id})
            if addr_id else jsonify({'success': False, 'message': 'Lỗi'}))


@app.route('/api/shipping-address/<int:address_id>', methods=['PUT', 'DELETE'])
@login_required
def manage_shipping_address_route(address_id):
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401
    if request.method == 'PUT':
        ok = update_shipping_address(address_id, customer['id'], request.json or {})
    else:
        ok = delete_shipping_address(address_id, customer['id'])
    return jsonify({'success': ok, 'message': '' if ok else 'Lỗi'})


# Notifications
@app.route('/api/notifications')
def get_notifications_route():
    if not session.get('customer_logged_in') or not session.get('customer_id'):
        return jsonify({'success': False}), 401
    cid         = session['customer_id']
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    limit       = request.args.get('limit', type=int)
    return jsonify({
        'success':       True,
        'notifications': get_notifications(cid, 'customer', unread_only, limit),
        'unread_count':  count_unread_notifications(cid, 'customer'),
    })


@app.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read_route(notification_id):
    if not session.get('customer_logged_in'):
        return jsonify({'success': False}), 401
    ok = mark_notification_read(notification_id, session['customer_id'])
    return jsonify({'success': ok})


@app.route('/api/notifications/read-all', methods=['POST'])
def mark_all_notifications_read_route():
    if not session.get('customer_logged_in'):
        return jsonify({'success': False}), 401
    ok = mark_all_notifications_read(session['customer_id'], 'customer')
    return jsonify({'success': ok})


# Cart sync
@app.route('/api/cart/sync', methods=['POST'])
@login_required
def sync_cart_route():
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401

    # FIX 8: call db helper function, NOT the route function add_to_cart()
    for item in session.get('cart', []):
        add_cart_item(customer['id'], item['product_id'], item['quantity'])

    session['cart'] = []
    return jsonify({'success': True})


@app.route('/api/cart/load')
@login_required
def load_cart_route():
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401

    db_items = get_cart_items(customer['id'])
    cart = [
        {'product_id': i['product_id'], 'name': i['name'],
         'price': float(i['price']), 'image': i['image'], 'quantity': i['quantity']}
        for i in db_items if i.get('is_active')
    ]
    session['cart'] = cart
    return jsonify({'success': True, 'cart': cart})


# Order history — FIX 5: single definition, correct decorator
@app.route('/api/order/<order_id>/history')
@login_required
def get_order_history_route(order_id):
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False}), 401

    order = get_order_by_id(order_id)
    if not order:
        return jsonify({'success': False, 'message': 'Không tìm thấy đơn hàng'}), 404
    if order.get('customer_id') != customer['id']:
        return jsonify({'success': False, 'message': 'Không có quyền truy cập'}), 403

    return jsonify({'success': True, 'history': get_order_status_history(order_id)})


# Chatbot
@app.route('/api/chatbot-message', methods=['POST'])
def save_chatbot_message():
    try:
        data    = request.get_json() or {}
        message = data.get('message', '').strip()
        if not message:
            return jsonify({'success': False, 'error': 'Message required'}), 400

        ts = data.get('timestamp', datetime.now().isoformat())
        ok = create_contact({
            'name':    session.get('customer_name', 'Khách hàng'),
            'email':   session.get('customer_email', 'chatbot@noreply.local'),
            'phone':   '',
            'subject': 'Tin nhắn từ Chatbot',
            'message': f'[Chatbot] {message}\n\nThời gian: {ts}',
        })
        return jsonify({'success': bool(ok)})
    except Exception as exc:
        app.logger.error('chatbot save error: %s', exc)
        return jsonify({'success': False, 'error': str(exc)}), 500


# Products search API (for chatbot live search)
@app.route('/api/products/search')
def api_products_search():
    q     = request.args.get('q', '').strip()
    limit = min(request.args.get('limit', 4, type=int), 10)
    if not q:
        return jsonify({'success': True, 'products': []})
    try:
        from db_helper import get_products_filtered
        products = get_products_filtered(search=q, active_only=True)[:limit]
        return jsonify({'success': True, 'products': products})
    except Exception:
        return jsonify({'success': True, 'products': []})


# NFT metadata
@app.route('/api/nft/metadata/<int:token_id>')
def nft_metadata(token_id):
    try:
        chain_id = request.args.get('chain_id', 56, type=int)
        nft      = get_nft_certificate_by_token_id(token_id, chain_id=chain_id)
        if not nft:
            return jsonify({'error': 'NFT not found'}), 404

        order = get_order_by_id(nft['order_id'])
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        image_url  = None
        items      = order.get('items') or []
        if items and items[0].get('product_id'):
            p = get_product_by_id(items[0]['product_id'])
            if p and p.get('image'):
                base      = _base_url()
                image_url = p['image'] if p['image'].startswith('http') else f'{base}{p["image"]}'
        if not image_url:
            image_url = f'{_base_url()}/static/images/logo.png'

        brand         = _site_name()
        product_names = [i.get('product_name') or i.get('name', '') for i in items[:5]]

        return jsonify({
            'name':         f'Furniture Certificate #{token_id}',
            'description':  f'Chứng nhận từ {brand}. Đơn #{nft["order_id"]}. {", ".join(product_names)}',
            'image':        image_url,
            'external_url': url_for('order_success', order_id=nft['order_id'], _external=True),
            'attributes': [
                {'trait_type': 'Order ID',    'value': nft['order_id']},
                {'trait_type': 'Recipient',   'value': nft['recipient_address'][:10] + '...' + nft['recipient_address'][-8:]},
                {'trait_type': 'Total (VND)', 'value': f"{order.get('total', 0):,.0f}"},
                {'trait_type': 'Chain',       'value': 'BSC Testnet' if chain_id == 97 else 'BSC'},
            ],
        })
    except Exception as exc:
        app.logger.error('NFT metadata error: %s', exc)
        return jsonify({'error': str(exc)}), 500


# Test routes (dev only)
@app.route('/test-usdt-payment')
def test_usdt_payment():
    return render_template('test-usdt-payment.html')


@app.route('/test-responsive')
def test_responsive():
    return render_template('test_responsive.html')


@app.route('/test-all-responsive')
def test_all_responsive():
    return render_template('test_all_responsive.html')


# ──────────────────────────────────────────
if __name__ == '__main__':
    app.run(
        debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true',
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
    )