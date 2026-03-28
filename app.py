from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from datetime import datetime
import os
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import wraps
import hashlib
import time
import urllib.parse

# Import database helper
from db_helper import *

# Import Web3 Payment
from web3_payment import init_web3_payment

# Import PayPal Payment
from paypal_payment import create_paypal_order, capture_paypal_order, get_amount_usd_from_vnd

# Import Rate Limiter
from rate_limiter import rate_limiter

# Import NFT Certificate
try:
    from nft_certificate import mint_certificate_nft, get_nft_config
    NFT_AVAILABLE = True
except ImportError:
    NFT_AVAILABLE = False

app = Flask(__name__)
app.secret_key = 'your-secret-key-here-change-in-production'

# Initialize Web3 Payment System
init_web3_payment(app)

# Context processor để cung cấp cart_count và site_settings cho tất cả templates
@app.context_processor
def inject_globals():
    cart_count = 0
    if 'cart' in session:
        cart_count = sum(item['quantity'] for item in session['cart'])
    
    # Lấy site settings
    site_settings = get_settings_dict()
    
    # Kiểm tra nếu cần hiển thị modal mã giảm giá
    show_coupons = False
    coupons_list = []
    if session.get('show_coupons_after_login') or session.get('show_coupons_after_register'):
        show_coupons = True
        coupons_list = session.get('coupons_list', [])
    
    return {
        'cart_count': cart_count,
        'site_settings': site_settings,
        'show_coupons': show_coupons,
        'coupons_list': coupons_list
    }

# Helper function để tính phí vận chuyển
def calculate_shipping_fee(subtotal):
    """Tính phí vận chuyển dựa trên subtotal và settings"""
    settings = get_settings_dict()
    
    # Lấy phí vận chuyển từ settings, mặc định 30000
    shipping_fee = int(settings.get('shipping_fee', '30000'))
    
    # Lấy ngưỡng miễn phí ship từ settings, mặc định 5000000
    free_shipping_threshold = int(settings.get('free_shipping_threshold', '5000000'))
    
    # Nếu subtotal >= ngưỡng miễn phí hoặc ngưỡng = 0 (tắt miễn phí), thì miễn phí
    if free_shipping_threshold > 0 and subtotal >= free_shipping_threshold:
        return 0
    
    return shipping_fee

# Custom filter để format currency
@app.template_filter('format_currency')
def format_currency(value):
    """Format number as Vietnamese currency"""
    try:
        return "{:,.0f}".format(float(value))
    except (ValueError, TypeError):
        return value

# Thông tin ngân hàng
BANK_INFO = {
    'bank_code': 'TECHCOMBANK',
    'bank_name': 'TECHCOMBANK',
    'account_number': '988833',
    'account_name': 'DINH QUOC DAT'
}

# Email configuration (cấu hình nếu cần gửi email)
EMAIL_CONFIG = {
    'smtp_server': 'smtp.gmail.com',
    'smtp_port': 587,
    'sender_email': 'quocdat3007888@gmail.com',
    'sender_password': 'vdrb yfkp qrav lrlt',
    'enabled': True  # Đặt True khi muốn bật gửi email
}

# Decorator để kiểm tra đăng nhập admin
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_logged_in' not in session:
            flash('Vui lòng đăng nhập để truy cập trang này', 'error')
            return redirect(url_for('admin_login'))
        if 'ddos_verified' not in session:
            session['ddos_verified'] = True
            session['ddos_verified_time'] = time.time()
        return f(*args, **kwargs)
    return decorated_function

# Decorator để kiểm tra verification (chống DDoS)
def verify_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'ddos_verified' not in session or not session.get('ddos_verified'):
            return redirect(url_for('landing_page'))
        return f(*args, **kwargs)
    return decorated_function

# Decorator để kiểm tra đăng nhập khách hàng
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'customer_logged_in' not in session:
            flash('Vui lòng đăng nhập để tiếp tục', 'error')
            return redirect(url_for('customer_login'))
        return f(*args, **kwargs)
    return decorated_function

# Helper function để lấy IP address
def get_client_ip():
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    else:
        return request.remote_addr

def send_password_reset_email(recipient_email, reset_url, recipient_name="Khách hàng"):
    """Gửi email đặt lại mật khẩu"""
    if not EMAIL_CONFIG['enabled']:
        print("Email sending is disabled.")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_CONFIG['sender_email']
        msg['To'] = recipient_email
        msg['Subject'] = "Yêu cầu đặt lại mật khẩu của bạn"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); 
                          color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }}
                .header h1 {{ margin: 0; font-size: 28px; }}
                .content {{ background: white; padding: 40px; border: 1px solid #ddd; }}
                .button {{ display: inline-block; background: #3498db; color: white; padding: 12px 25px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; 
                          border-top: 1px solid #ddd; font-size: 12px; color: #777; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Đặt Lại Mật Khẩu</h1>
                </div>
                <div class="content">
                    <p>Xin chào <strong>{recipient_name}</strong>,</p>
                    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                    <p>Vui lòng nhấp vào liên kết dưới đây để đặt lại mật khẩu của bạn:</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{reset_url}" class="button">Đặt Lại Mật Khẩu</a>
                    </p>
                    <p>Liên kết này sẽ hết hạn sau 1 giờ.</p>
                    <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                    <p>Trân trọng,</p>
                    <p>Đội ngũ Nội Thất Sang Trọng</p>
                </div>
                <div class="footer">
                    <p>Email này được gửi tự động, vui lòng không trả lời.</p>
                    <p>&copy; {datetime.now().year} Nội Thất Sang Trọng. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html_body, 'html'))
        
        server = smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port'])
        server.starttls()
        server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
        server.send_message(msg)
        server.quit()
        
        print(f"✅ Đã gửi email đặt lại mật khẩu đến {recipient_email}")
        return True
    except Exception as e:
        print(f"❌ Lỗi gửi email đặt lại mật khẩu: {e}")
        return False

def send_order_confirmation_email(order):
    """Gửi email xác nhận đơn hàng"""
    if not EMAIL_CONFIG['enabled']:
        return
    
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_CONFIG['sender_email']
        msg['To'] = order.get('email', '')
        msg['Subject'] = f"✅ Xác nhận đơn hàng #{order['order_id']} - Nội Thất ABC"
        
        # Tạo bảng sản phẩm HTML (order_items có product_name, place_order có name)
        items_html = ""
        for item in order.get('items', []):
            item_name = item.get('name') or item.get('product_name', 'Sản phẩm')
            item_qty = item.get('quantity', 0)
            item_price = float(item.get('price', 0) or 0)
            item_subtotal = float(item.get('subtotal', 0) or item_price * item_qty)
            items_html += f"""
            <tr>
                <td style="padding: 15px; border-bottom: 1px solid #eee;">
                    <strong>{item_name}</strong>
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #eee; text-align: center;">
                    {item_qty}
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #eee; text-align: right;">
                    {item_price:,.0f}₫
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #eee; text-align: right;">
                    <strong>{item_subtotal:,.0f}₫</strong>
                </td>
            </tr>
            """
        
        # Tạo HTML email đẹp
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }}
                .container {{ max-width: 650px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #27ae60 0%, #229954 100%); 
                          color: white; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                .header h1 {{ margin: 0; font-size: 28px; }}
                .header .order-id {{ background: rgba(255,255,255,0.2); padding: 10px 20px; 
                                    border-radius: 20px; display: inline-block; margin-top: 15px; 
                                    font-size: 18px; font-weight: bold; }}
                .content {{ background: white; padding: 30px; border: 1px solid #ddd; }}
                .status-box {{ background: #d5f4e6; border-left: 4px solid #27ae60; 
                              padding: 20px; border-radius: 5px; margin: 20px 0; }}
                .info-section {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .info-row {{ margin: 10px 0; }}
                .label {{ color: #666; font-weight: 600; display: inline-block; width: 140px; }}
                .value {{ color: #333; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th {{ background: #f1f3f5; padding: 15px; text-align: left; font-weight: 600; 
                     color: #495057; border-bottom: 2px solid #dee2e6; }}
                .total-section {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .total-row {{ display: flex; justify-content: space-between; padding: 10px 0; }}
                .total-row.grand {{ border-top: 2px solid #27ae60; margin-top: 10px; 
                                   padding-top: 15px; font-size: 18px; font-weight: bold; color: #27ae60; }}
                .payment-method {{ display: inline-block; background: #e3f2fd; color: #1976d2; 
                                  padding: 8px 16px; border-radius: 20px; font-weight: 600; 
                                  margin: 10px 0; }}
                .contact-box {{ background: #fff3cd; padding: 20px; border-radius: 8px; 
                               margin: 20px 0; border-left: 4px solid #ffc107; }}
                .footer {{ background: #2c3e50; color: white; padding: 30px; text-align: center; 
                          border-radius: 0 0 10px 10px; }}
                .footer a {{ color: #3498db; text-decoration: none; }}
                .button {{ display: inline-block; background: #27ae60; color: white; 
                          padding: 12px 30px; text-decoration: none; border-radius: 5px; 
                          margin: 15px 5px; font-weight: bold; }}
                .button-secondary {{ background: #3498db; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ ĐẶT HÀNG THÀNH CÔNG</h1>
                    <div class="order-id">Mã đơn: #{order['order_id']}</div>
                </div>
                
                <div class="content">
                    <div class="status-box">
                        <p style="margin: 0; font-size: 16px;">
                            <strong>🎉 Cảm ơn bạn đã đặt hàng tại Nội Thất ABC!</strong>
                        </p>
                        <p style="margin: 10px 0 0 0;">
                            Chúng tôi đã nhận được đơn hàng của bạn và đang xử lý. 
                            Nhân viên sẽ liên hệ với bạn sớm nhất để xác nhận.
                        </p>
                    </div>

                    <h3 style="color: #2c3e50; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">
                        📦 Chi Tiết Đơn Hàng
                    </h3>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Sản phẩm</th>
                                <th style="text-align: center; width: 80px;">Số lượng</th>
                                <th style="text-align: right; width: 120px;">Đơn giá</th>
                                <th style="text-align: right; width: 120px;">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                    </table>

                    <div class="total-section">
                        <div class="total-row">
                            <span>Tạm tính:</span>
                            <span>{order.get('subtotal', order.get('total', 0)):,.0f}₫</span>
                        </div>
                        <div class="total-row">
                            <span>Phí vận chuyển:</span>
                            <span>{order.get('shipping_fee', 0):,.0f}₫</span>
                        </div>
                        <div class="total-row grand">
                            <span>Tổng cộng:</span>
                            <span>{order.get('total', 0):,.0f}₫</span>
                        </div>
                    </div>

                    <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                        📋 Thông Tin Giao Hàng
                    </h3>
                    
                    <div class="info-section">
                        <div class="info-row">
                            <span class="label">👤 Người nhận:</span>
                            <span class="value">{order.get('customer_name', '')}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">📱 Số điện thoại:</span>
                            <span class="value">{order.get('phone', '')}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">📧 Email:</span>
                            <span class="value">{order.get('email', 'Không có')}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">🏠 Địa chỉ:</span>
                            <span class="value">{order.get('address', '')}</span>
                        </div>
                        {f'<div class="info-row"><span class="label">📝 Ghi chú:</span><span class="value">{order["note"]}</span></div>' if order.get('note') else ''}
                    </div>

                    <div class="info-row" style="margin: 20px 0;">
                        <span class="label">💳 Thanh toán:</span>
                        <span class="payment-method">
                            {'💵 Thanh toán khi nhận hàng (COD)' if order.get('payment_method') == 'cod' 
                             else '🏦 Chuyển khoản ngân hàng' if order.get('payment_method') == 'bank_transfer'
                             else '💳 PayPal' if order.get('payment_method') == 'paypal'
                             else '💳 USDT Crypto' if order.get('payment_method') == 'usdt'
                             else '💳 Thẻ tín dụng/ghi nợ'}
                        </span>
                    </div>

                    <div class="contact-box">
                        <p style="margin: 0 0 10px 0; font-weight: bold;">
                            ⚠️ Cần hỗ trợ hoặc thay đổi đơn hàng?
                        </p>
                        <p style="margin: 0;">
                            Vui lòng liên hệ: <strong>0345211386</strong> hoặc 
                            email <strong>quocdat30075@gmail.com</strong>
                        </p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="http://localhost:5000/account" class="button">
                            Xem Chi Tiết Đơn Hàng
                        </a>
                        <a href="http://localhost:5000/products" class="button button-secondary">
                            Tiếp Tục Mua Sắm
                        </a>
                    </div>
                </div>

                <div class="footer">
                    <h3 style="margin: 0 0 15px 0;">🛋️ Nội Thất ABC</h3>
                    <p style="margin: 5px 0;">Thiết Kế Không Gian Sống Của Bạn</p>
                    <p style="margin: 15px 0 5px 0;">
                        📞 Hotline: <strong>0345211386</strong> | 
                        📧 Email: <strong>quocdat30075@gmail.com</strong>
                    </p>
                    <p style="margin: 5px 0;">🏠 Địa chỉ: Hà Đông, Hà Nội</p>
                    <p style="margin: 20px 0 0 0; font-size: 12px; opacity: 0.8;">
                        Email này được gửi tự động, vui lòng không trả lời trực tiếp email này.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(html_body, 'html'))
        
        server = smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port'])
        server.starttls()
        server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
        server.send_message(msg)
        server.quit()
        
        print(f"✅ Đã gửi email xác nhận đơn hàng đến {order.get('email', 'N/A')}")
        
    except Exception as e:
        print(f"❌ Lỗi gửi email xác nhận đơn hàng: {e}")

# ==================== CONTACT EMAIL FUNCTIONS ====================

def send_contact_email(contact_data):
    """Gửi email thông báo có liên hệ mới đến admin"""
    if not EMAIL_CONFIG['enabled']:
        return False
    
    try:
        # Email gửi đến admin
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_CONFIG['sender_email']
        msg['To'] = EMAIL_CONFIG['sender_email']  # Gửi đến chính mình
        msg['Subject'] = f"🔔 Liên hệ mới: {contact_data['subject']}"
        
        # HTML email đẹp cho admin
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }}
                .info-row {{ margin: 15px 0; padding: 15px; background: white; border-radius: 5px; }}
                .label {{ font-weight: bold; color: #667eea; display: inline-block; width: 120px; }}
                .value {{ color: #333; }}
                .message-box {{ background: white; padding: 20px; border-left: 4px solid #667eea; 
                               margin: 20px 0; border-radius: 5px; }}
                .footer {{ text-align: center; padding: 20px; color: #999; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📬 Liên Hệ Mới Từ Website</h1>
                </div>
                <div class="content">
                    <div class="info-row">
                        <span class="label">👤 Họ tên:</span>
                        <span class="value">{contact_data['name']}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">📧 Email:</span>
                        <span class="value">{contact_data['email']}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">📱 Điện thoại:</span>
                        <span class="value">{contact_data.get('phone', 'Không có')}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">📌 Chủ đề:</span>
                        <span class="value">{contact_data['subject']}</span>
                    </div>
                    <div class="message-box">
                        <p style="margin: 0 0 10px 0; font-weight: bold; color: #667eea;">💬 Nội dung tin nhắn:</p>
                        <p style="margin: 0; white-space: pre-wrap;">{contact_data['message']}</p>
                    </div>
                    <p style="text-align: center; margin-top: 30px;">
                        <a href="http://localhost:5000/admin/contacts" 
                           style="background: #667eea; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Xem trong Admin Panel
                        </a>
                    </p>
                </div>
                <div class="footer">
                    <p>Email tự động từ hệ thống Nội Thất ABC</p>
                    <p>Thời gian: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(html_body, 'html'))
        
        # Gửi email
        server = smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port'])
        server.starttls()
        server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Lỗi gửi email thông báo: {e}")
        return False

def send_contact_reply_email(contact_data):
    """Gửi email tự động trả lời khách hàng"""
    if not EMAIL_CONFIG['enabled']:
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_CONFIG['sender_email']
        msg['To'] = contact_data['email']
        msg['Subject'] = f"Cảm ơn bạn đã liên hệ - {contact_data['subject']}"
        
        # HTML email đẹp cho khách hàng
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); 
                          color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }}
                .header h1 {{ margin: 0; font-size: 28px; }}
                .content {{ background: white; padding: 40px; border: 1px solid #ddd; }}
                .highlight {{ background: #f0f8ff; padding: 20px; border-radius: 5px; 
                             border-left: 4px solid #3498db; margin: 20px 0; }}
                .button {{ display: inline-block; background: #3498db; color: white; 
                          padding: 15px 40px; text-decoration: none; border-radius: 5px; 
                          margin: 20px 0; font-weight: bold; }}
                .footer {{ background: #f9f9f9; padding: 30px; text-align: center; 
                          border-top: 3px solid #3498db; }}
                .contact-info {{ margin: 20px 0; padding: 20px; background: #f9f9f9; 
                                border-radius: 5px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🛋️ Nội Thất ABC</h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px;">Cảm ơn bạn đã liên hệ với chúng tôi!</p>
                </div>
                <div class="content">
                    <p>Xin chào <strong>{contact_data['name']}</strong>,</p>
                    
                    <p>Chúng tôi đã nhận được tin nhắn của bạn với nội dung:</p>
                    
                    <div class="highlight">
                        <p style="margin: 0 0 10px 0;"><strong>📌 Chủ đề:</strong> {contact_data['subject']}</p>
                        <p style="margin: 0;"><strong>💬 Nội dung:</strong></p>
                        <p style="margin: 10px 0 0 0; white-space: pre-wrap;">{contact_data['message']}</p>
                    </div>
                    
                    <p>Đội ngũ chúng tôi sẽ xem xét và phản hồi bạn trong vòng <strong>24 giờ làm việc</strong>.</p>
                    
                    <p style="text-align: center;">
                        <a href="http://localhost:5000" class="button">Ghé Thăm Website</a>
                    </p>
                    
                    <div class="contact-info">
                        <p style="margin: 0 0 10px 0; font-weight: bold; color: #2c3e50;">
                            📞 Thông Tin Liên Hệ
                        </p>
                        <p style="margin: 5px 0;">📱 Hotline: 0345211386</p>
                        <p style="margin: 5px 0;">📧 Email: quocdat30075@gmail.com</p>
                        <p style="margin: 5px 0;">🏠 Địa chỉ: Hà Đông Hà Nội</p>
                    </div>
                    
                    <p>Nếu bạn cần hỗ trợ gấp, vui lòng gọi trực tiếp hotline của chúng tôi.</p>
                    
                    <p style="margin-top: 30px;">Trân trọng,<br>
                    <strong>Đội ngũ Nội Thất ABC</strong></p>
                </div>
                <div class="footer">
                    <p style="margin: 0 0 10px 0; color: #666;">
                        🛋️ Nội Thất ABC - Thiết Kế Không Gian Sống Của Bạn
                    </p>
                    <p style="margin: 5px 0; font-size: 12px; color: #999;">
                        Email này được gửi tự động, vui lòng không trả lời email này.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(html_body, 'html'))
        
        # Gửi email
        server = smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port'])
        server.starttls()
        server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Lỗi gửi email trả lời: {e}")
        return False

# ==================== MAINTENANCE MODE CHECK ====================
# QUAN TRỌNG: Phải đặt TRƯỚC tất cả các route khác để chạy đầu tiên

@app.before_request
def check_maintenance_mode():
    """Kiểm tra chế độ bảo trì trước mỗi request - CHẠY ĐẦU TIÊN"""
    # Cho phép static files luôn truy cập được
    if request.endpoint == 'static' or request.path.startswith('/static/'):
        return None
    
    # Cho phép admin routes và admin login
    if request.endpoint:
        endpoint_str = str(request.endpoint)
        if endpoint_str.startswith('admin_') or endpoint_str == 'admin_login':
            return None
    
    # Kiểm tra maintenance mode TRƯỚC TẤT CẢ CÁC KIỂM TRA KHÁC
    try:
        maintenance_mode = get_setting('maintenance_mode', '0')
        
        # Chuyển đổi giá trị thành string và normalize
        if maintenance_mode:
            maintenance_mode_str = str(maintenance_mode).strip().lower()
        else:
            maintenance_mode_str = '0'
        
        # Kiểm tra nếu maintenance mode được bật
        is_maintenance = maintenance_mode_str == '1'
        
        if is_maintenance:
            # Nếu đã đăng nhập admin, cho phép truy cập
            if session.get('admin_logged_in'):
                return None
            
            # Lấy thông báo bảo trì
            maintenance_message = get_setting('maintenance_message', 'Website đang được bảo trì. Vui lòng quay lại sau!')
            
            # Hiển thị trang bảo trì - TRẢ VỀ NGAY LẬP TỨC, KHÔNG CHO CHẠY CÁC ROUTE KHÁC
            return render_template('maintenance.html', maintenance_message=maintenance_message), 503
    except Exception as e:
        import traceback
        try:
            print(f"[MAINTENANCE] ERROR: {e}")
        except:
            print(f"[MAINTENANCE] ERROR occurred")
        # Nếu có lỗi, cho phép truy cập để tránh block toàn bộ site
    
    return None

# ==================== DDoS PROTECTION LANDING PAGE ====================

@app.route('/landing')
def landing_page():
    """Landing page chào mừng người dùng"""
    client_ip = get_client_ip()
    
    is_allowed, message = rate_limiter.is_allowed(client_ip)
    
    if not is_allowed:
        return render_template('landing.html', 
                             error_message=message,
                             blocked=True)
    
    return render_template('landing.html', 
                         blocked=False)

@app.route('/api/verify', methods=['POST'])
def verify_challenge():
    """Xác minh đơn giản - chỉ cần click vào nút"""
    client_ip = get_client_ip()
    
    is_allowed, message = rate_limiter.is_allowed(client_ip)
    if not is_allowed:
        return jsonify({
            'success': False,
            'message': message
        }), 429
    
    data = request.json
    simple_verify = data.get('simple_verify', False)
    
    if not simple_verify:
        return jsonify({
            'success': False,
            'message': 'Yêu cầu không hợp lệ'
        }), 400
    
    session['ddos_verified'] = True
    session['ddos_verified_time'] = time.time()
    
    return jsonify({
        'success': True,
        'message': 'Chào mừng đến với website!',
        'redirect_url': url_for('index')
    })

@app.route('/api/generate-captcha', methods=['GET'])
def generate_captcha():
    """Tạo CAPTCHA mới"""
    num1 = random.randint(1, 10)
    num2 = random.randint(1, 10)
    answer = num1 + num2
    
    session['captcha_answer'] = str(answer)
    
    return jsonify({
        'question': f'{num1} + {num2} = ?',
        'answer': answer
    })

@app.route('/api/clear-coupons-session', methods=['POST'])
def clear_coupons_session():
    """Xóa session mã giảm giá sau khi đã hiển thị"""
    session.pop('show_coupons_after_login', None)
    session.pop('show_coupons_after_register', None)
    session.pop('coupons_list', None)
    return jsonify({'success': True})

# ==================== PUBLIC ROUTES ====================

@app.route('/')
def index():
    """Trang chủ"""
    client_ip = get_client_ip()
    
    if 'ddos_verified' not in session or not session.get('ddos_verified'):
        verified_time = session.get('ddos_verified_time', 0)
        if time.time() - verified_time > 3600:
            session.pop('ddos_verified', None)
            session.pop('ddos_verified_time', None)
            return redirect(url_for('landing_page'))
    
    is_allowed, message = rate_limiter.is_allowed(client_ip)
    if not is_allowed:
        session.pop('ddos_verified', None)
        session.pop('ddos_verified_time', None)
        return redirect(url_for('landing_page'))
    
    products = get_all_products()
    categories = get_category_names()
    
    seen_ids = set()
    unique_products = []
    for product in products:
        product_id = product.get('id')
        if product_id and product_id not in seen_ids:
            seen_ids.add(product_id)
            unique_products.append(product)
    
    featured_products = unique_products[:6] if unique_products else []
    
    return render_template('index.html', 
                         featured_products=featured_products,
                         categories=categories)

@app.route('/products')
def products():
    """Trang danh sách sản phẩm"""
    try:
        from urllib.parse import unquote
        from db_helper import get_products_filtered
        
        category = request.args.get('category', '').strip()
        if category:
            category = unquote(category)
        
        search = request.args.get('search', '').strip()
        if search:
            search = unquote(search)
        
        print(f"DEBUG - Search parameter: '{search}'")
        print(f"DEBUG - Search type: {type(search)}")
        print(f"DEBUG - Search length: {len(search) if search else 0}")
        
        price_range = request.args.get('price', '').strip()
        min_price = None
        max_price = None
        if price_range:
            try:
                if '-' in price_range:
                    parts = price_range.split('-')
                    if len(parts) == 2:
                        min_price = float(parts[0]) if parts[0] else None
                        max_price = float(parts[1]) if parts[1] else None
            except (ValueError, TypeError):
                pass
        
        sort = request.args.get('sort', '').strip()
        
        print(f"DEBUG - Calling get_products_filtered with search='{search}'")
        products_list = get_products_filtered(
            category=category if category else None,
            search=search if search else None,
            min_price=min_price,
            max_price=max_price,
            sort_by=sort if sort else None,
            active_only=True
        )
        print(f"DEBUG - Found {len(products_list)} products")
        
        categories = get_category_names()
        
        return render_template('products.html',
                             products=products_list,
                             categories=categories,
                             selected_category=category,
                             search=search,
                             price_range=price_range,
                             sort=sort)
    except Exception as e:
        import traceback
        print(f"Error in products route: {str(e)}")
        print(traceback.format_exc())
        return render_template('products.html',
                             products=[],
                             categories=[],
                             selected_category='',
                             search='',
                             price_range='',
                             sort='')

@app.route('/categories')
def categories():
    """Trang danh mục sản phẩm"""
    categories_list = get_category_names()
    all_products = get_all_products()
    
    categories_with_count = []
    for category in categories_list:
        count = len([p for p in all_products if p.get('category') == category])
        categories_with_count.append({
            'name': category,
            'count': count
        })
    
    return render_template('categories.html',
                         categories=categories_with_count)

@app.route('/product/<int:product_id>')
def product_detail(product_id):
    """Trang chi tiết sản phẩm"""
    product = get_product_by_id(product_id)
    
    if not product:
        return "Không tìm thấy sản phẩm", 404
    
    # Lấy nhiều ảnh sản phẩm từ bảng product_images
    product_images = get_product_images(product_id)
    
    # Lấy sản phẩm liên quan (cùng category)
    related_products = get_all_products(category=product['category'])
    # Loại bỏ sản phẩm hiện tại và lấy 4 sản phẩm
    related_products = [p for p in related_products if p['id'] != product_id][:4]
    
    # Lấy thống kê rating
    rating_stats = get_review_rating_stats(product_id)
    
    # Kiểm tra xem khách hàng đã mua sản phẩm này chưa (để hiển thị verified purchase)
    customer_has_purchased = False
    if 'customer_id' in session:
        customer_id = session['customer_id']
        purchase_query = """
            SELECT COUNT(*) as count FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            WHERE o.customer_id = %s AND oi.product_id = %s AND o.payment_status = 'paid'
        """
        result = execute_query(purchase_query, (customer_id, product_id), fetch=True, fetch_one=True)
        customer_has_purchased = result and result.get('count', 0) > 0
    
    return render_template('product_detail.html',
                         product=product,
                         product_images=product_images,
                         related_products=related_products,
                         rating_stats=rating_stats,
                         customer_has_purchased=customer_has_purchased)

@app.route('/api/product/<int:product_id>/quick-view', methods=['GET'])
def quick_view_product(product_id):
    """Lấy thông tin sản phẩm cho quick view modal"""
    product = get_product_by_id(product_id)
    
    if not product:
        return jsonify({'success': False, 'message': 'Sản phẩm không tồn tại'})
    
    return jsonify({
        'success': True,
        'product': product
    })

@app.route('/api/add-to-cart', methods=['POST'])
def add_to_cart():
    """Thêm sản phẩm vào giỏ hàng"""
    try:
        data = None
        
        if request.content_type and 'application/json' in request.content_type:
            data = request.get_json(silent=True)
        else:
            data = request.get_json(force=True, silent=True)
        
        if not data:
            return jsonify({'success': False, 'message': 'Invalid JSON data'}), 400
        
        product_id = data.get('product_id')
        quantity = data.get('quantity', 1)
        
        if product_id is None:
            return jsonify({'success': False, 'message': 'Product ID is required'}), 400
        
        try:
            product_id = int(product_id)
            quantity = int(quantity)
            if product_id <= 0 or quantity <= 0:
                return jsonify({'success': False, 'message': 'Product ID and quantity must be positive'}), 400
        except (ValueError, TypeError) as e:
            return jsonify({'success': False, 'message': f'Invalid product ID or quantity: {str(e)}'}), 400
        
        # Kiểm tra sản phẩm tồn tại
        try:
            product = get_product_by_id(product_id)
        except Exception as e:
            import traceback
            print(f"Error getting product: {str(e)}")
            print(traceback.format_exc())
            return jsonify({'success': False, 'message': f'Error getting product: {str(e)}'}), 500
        
        if not product:
            return jsonify({'success': False, 'message': 'Sản phẩm không tồn tại'}), 404
        
        # Khởi tạo giỏ hàng nếu chưa có
        if 'cart' not in session:
            session['cart'] = []
        
        cart = session['cart']
        
        # Kiểm tra sản phẩm đã có trong giỏ chưa
        found = False
        for item in cart:
            if item.get('product_id') == product_id:
                item['quantity'] = item.get('quantity', 0) + quantity
                found = True
                break
        
        if not found:
            cart.append({
                'product_id': product_id,
                'quantity': quantity
            })
        
        session['cart'] = cart
        session.modified = True
        
        cart_count = sum(item.get('quantity', 0) for item in cart)
        
        return jsonify({
            'success': True, 
            'message': 'Đã thêm vào giỏ hàng',
            'cart_count': cart_count
        })
    except Exception as e:
        import traceback
        print(f"Error in add_to_cart: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False, 
            'message': f'Có lỗi xảy ra: {str(e)}'
        }), 500

@app.route('/api/update-cart', methods=['POST'])
def update_cart():
    """Cập nhật số lượng sản phẩm trong giỏ"""
    data = request.json
    product_id = data.get('product_id')
    quantity = data.get('quantity', 1)
    
    if 'cart' not in session:
        return jsonify({'success': False})
    
    cart = session['cart']
    
    for item in cart:
        if item['product_id'] == product_id:
            if quantity <= 0:
                cart.remove(item)
            else:
                item['quantity'] = quantity
            break
    
    session['cart'] = cart
    session.modified = True
    
    return jsonify({'success': True})

@app.route('/api/remove-from-cart', methods=['POST'])
def remove_from_cart():
    """Xóa sản phẩm khỏi giỏ hàng"""
    data = request.json
    product_id = data.get('product_id')
    
    if 'cart' not in session:
        return jsonify({'success': False})
    
    cart = session['cart']
    cart = [item for item in cart if item['product_id'] != product_id]
    
    session['cart'] = cart
    session.modified = True
    
    return jsonify({'success': True})

@app.route('/cart/update/<int:product_id>', methods=['POST'])
def update_cart_item(product_id):
    """Cập nhật số lượng sản phẩm trong giỏ hàng"""
    try:
        data = request.get_json() or {}
        quantity = int(data.get('quantity', 1))
        
        if 'cart' not in session:
            return jsonify({'success': False, 'message': 'Giỏ hàng trống'}), 400
        
        cart = session['cart']
        
        if quantity <= 0:
            cart = [item for item in cart if item['product_id'] != product_id]
        else:
            found = False
            for item in cart:
                if item['product_id'] == product_id:
                    item['quantity'] = quantity
                    found = True
                    break
            
            if not found:
                return jsonify({'success': False, 'message': 'Sản phẩm không tồn tại trong giỏ hàng'}), 404
        
        session['cart'] = cart
        session.modified = True
        
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Error updating cart: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'message': f'Có lỗi xảy ra: {str(e)}'}), 500

@app.route('/cart/remove/<int:product_id>', methods=['POST'])
def remove_cart_item(product_id):
    """Xóa sản phẩm khỏi giỏ hàng"""
    try:
        if 'cart' not in session:
            return jsonify({'success': False, 'message': 'Giỏ hàng trống'}), 400
        
        cart = session['cart']
        cart = [item for item in cart if item['product_id'] != product_id]
        
        session['cart'] = cart
        session.modified = True
        
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Error removing from cart: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'message': f'Có lỗi xảy ra: {str(e)}'}), 500

@app.route('/cart/clear', methods=['POST'])
def clear_cart():
    """Xóa toàn bộ giỏ hàng"""
    try:
        if 'cart' in session:
            session['cart'] = []
            session.modified = True
        
        return jsonify({'success': True, 'message': 'Đã xóa toàn bộ giỏ hàng'})
    except Exception as e:
        import traceback
        print(f"Error clearing cart: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'message': f'Có lỗi xảy ra: {str(e)}'}), 500

@app.route('/cart')
def cart():
    """Trang giỏ hàng"""
    # DEBUG
    print("\n" + "="*60)
    print("🛒 DEBUG TRANG GIỎ HÀNG")
    print("="*60)
    
    cart_items = []
    total = 0
    
    # Kiểm tra session cart
    print(f"📦 Session có 'cart': {'cart' in session}")
    
    if 'cart' in session:
        print(f"📦 Số items trong session['cart']: {len(session['cart'])}")
        print(f"📦 Nội dung session['cart']: {session['cart']}")
        
        for idx, item in enumerate(session['cart']):
            print(f"\n   Item {idx + 1}:")
            print(f"   - product_id: {item.get('product_id')}")
            print(f"   - quantity: {item.get('quantity')}")
            
            product = get_product_by_id(item['product_id'])
            
            if product:
                print(f"   - product found: {product['name']}")
                subtotal = product['price'] * item['quantity']
                cart_items.append({
                    'product': product,
                    'quantity': item['quantity'],
                    'subtotal': subtotal
                })
                total += subtotal
            else:
                print(f"   - ❌ Sản phẩm ID {item['product_id']} KHÔNG TÌM THẤY!")
    else:
        print("❌ Session KHÔNG có 'cart'")
    
    print(f"\n📊 Tổng số cart_items để render: {len(cart_items)}")
    print(f"💰 Tổng tiền: {total}")
    print("="*60 + "\n")
    
    shipping_fee = calculate_shipping_fee(total)
    settings = get_settings_dict()
    free_shipping_threshold = int(settings.get('free_shipping_threshold', '5000000'))
    
    return render_template('cart.html',
                         cart_items=cart_items,
                         subtotal=total,
                         shipping_fee=shipping_fee,
                         total=total + shipping_fee,
                         free_shipping_threshold=free_shipping_threshold)

@app.route('/checkout')
def checkout():
    """Trang thanh toán"""
    # Kiểm tra đăng nhập - YÊU CẦU BẮT BUỘC
    if 'customer_logged_in' not in session:
        flash('Vui lòng đăng nhập để tiếp tục thanh toán', 'warning')
        return redirect(url_for('customer_login', next=url_for('checkout')))
    
    # Kiểm tra giỏ hàng có sản phẩm không
    if 'cart' not in session or not session['cart']:
        flash('Giỏ hàng của bạn đang trống', 'warning')
        return redirect(url_for('cart'))
    
    # Tính toán giỏ hàng
    cart_items = []
    total = 0
    
    for item in session['cart']:
        product = get_product_by_id(item['product_id'])
        if product:
            subtotal = product['price'] * item['quantity']
            cart_items.append({
                'product': product,
                'quantity': item['quantity'],
                'subtotal': subtotal
            })
            total += subtotal
    
    # Kiểm tra lại nếu không có sản phẩm hợp lệ
    if not cart_items:
        flash('Giỏ hàng của bạn đang trống', 'warning')
        return redirect(url_for('cart'))
    
    shipping_fee = calculate_shipping_fee(total)
    settings = get_settings_dict()
    free_shipping_threshold = int(settings.get('free_shipping_threshold', '5000000'))
    
    # Lấy thông tin khách hàng nếu đã đăng nhập
    customer = None
    shipping_addresses = []
    default_address = None
    
    if 'customer_logged_in' in session:
        customer = get_customer_by_id(session['customer_id'])
        if customer:
            shipping_addresses = get_shipping_addresses(customer['id'])
            # Tìm địa chỉ mặc định
            for addr in shipping_addresses:
                if addr.get('is_default'):
                    default_address = addr
                    break
            # Nếu không có mặc định, lấy địa chỉ đầu tiên
            if not default_address and shipping_addresses:
                default_address = shipping_addresses[0]
    
    # Lưu tổng tiền vào session cho Web3 payment
    session['cart_total'] = total + shipping_fee
    session['pending_order_id'] = None  # Sẽ set sau khi tạo order
    
    return render_template('checkout.html',
                         cart_items=cart_items,
                         subtotal=total,
                         shipping_fee=shipping_fee,
                         total=total + shipping_fee,
                         customer=customer,
                         shipping_addresses=shipping_addresses,
                         default_address=default_address,
                         free_shipping_threshold=free_shipping_threshold)

@app.route('/api/place-order', methods=['POST'])
def place_order():
    """Đặt hàng"""
    try:
        # Kiểm tra đăng nhập - YÊU CẦU BẮT BUỘC
        if 'customer_logged_in' not in session:
            return jsonify({
                'success': False, 
                'message': 'Vui lòng đăng nhập để đặt hàng',
                'require_login': True,
                'login_url': url_for('customer_login', next=url_for('checkout'))
            }), 401
        
        data = request.json
        
        if not data:
            return jsonify({'success': False, 'message': 'Dữ liệu không hợp lệ'}), 400
        
        if 'cart' not in session or not session['cart']:
            return jsonify({'success': False, 'message': 'Giỏ hàng trống'})
        
        # Tính tổng tiền và chuẩn bị order items
        order_items = []
        total = 0
        
        for item in session['cart']:
            product = get_product_by_id(item['product_id'])
            if product:
                # Convert Decimal to float để tránh lỗi type mismatch
                price = float(product['price']) if product.get('price') else 0.0
                subtotal = price * item['quantity']
                total += subtotal
                order_items.append({
                    'product_id': product['id'],
                    'name': product['name'],
                    'price': product['price'],
                    'quantity': item['quantity'],
                    'subtotal': subtotal
                })
        
        # Xử lý mã giảm giá
        coupon_code = data.get('coupon_code', '').strip().upper()
        discount_amount = 0
        coupon_id = None
        
        if coupon_code:
            coupon_result = apply_coupon(coupon_code, total)
            if coupon_result.get('valid'):
                discount_amount = coupon_result['discount']
                total = coupon_result['final_amount']
                coupon_id = coupon_result['coupon']['id']
                # Tăng số lần sử dụng
                increment_coupon_usage(coupon_code)
        
        # Thêm phí vận chuyển
        shipping_fee = calculate_shipping_fee(total)
        subtotal = total
        final_total = total + shipping_fee
        
        # Tạo mã đơn hàng
        order_id = 'ORD' + ''.join(random.choices(string.digits, k=8))
        
        # Chuẩn bị dữ liệu đơn hàng
        order_data = {
            'order_id': order_id,
            'customer_id': session.get('customer_id'),  # Thêm customer_id nếu đã đăng nhập
            'customer_name': data.get('fullname'),
            'phone': data.get('phone'),
            'email': data.get('email'),
            'address': f"{data.get('address')}, {data.get('ward')}, {data.get('district')}, {data.get('city')}",
            'note': data.get('note', ''),
            'payment_method': data.get('payment_method'),
            'items': order_items,
            'subtotal': subtotal,
            'shipping_fee': shipping_fee,
            'total': final_total,
            'status': 'pending',
            'payment_status': 'pending',
            'coupon_code': coupon_code if coupon_code else None,
            'discount_amount': discount_amount
        }
        
        # Lưu vào database
        result = create_order(order_data)
        
        if not result:
            return jsonify({'success': False, 'message': 'Không thể tạo đơn hàng'})
        
        # Tạo payment transaction với status pending
        payment_method = data.get('payment_method')
        if payment_method in ['bank_transfer', 'credit_card', 'usdt', 'paypal']:
            try:
                transaction_id = f"{payment_method.upper()}_{order_id}"
                transaction_data = {
                    'transaction_id': transaction_id,
                    'order_id': order_id,
                    'payment_method': payment_method,
                    'amount': float(final_total),
                    'currency': 'VND',
                    'status': 'pending'
                }
                create_payment_transaction(transaction_data)
            except Exception as e:
                print(f"Lỗi khi tạo payment transaction: {e}")
        
        # Lưu order_id vào session cho Web3 payment
        session['pending_order_id'] = order_id
        
        # Xóa giỏ hàng
        session['cart'] = []
        
        # Chuyển hướng dựa trên phương thức thanh toán
        if payment_method == 'usdt':
            # USDT Web3 Payment
            return jsonify({
                'success': True, 
                'order_id': order_id,
                'redirect': 'usdt_payment'
            })
        elif payment_method == 'paypal':
            # PayPal Payment - trả về order_id để frontend gọi create PayPal order
            return jsonify({
                'success': True, 
                'order_id': order_id,
                'redirect': 'paypal_payment',
                'amount': final_total
            })
        elif payment_method == 'bank_transfer':
            return jsonify({
                'success': True, 
                'order_id': order_id,
                'redirect': 'bank_transfer'
            })
        elif payment_method == 'credit_card':
            return jsonify({
                'success': True, 
                'order_id': order_id,
                'redirect': 'credit_card'
            })
        else:
            # COD
            try:
                send_order_confirmation_email(order_data)
            except Exception as e:
                print(f"Không thể gửi email: {str(e)}")
            
            return jsonify({
                'success': True, 
                'order_id': order_id,
                'redirect': 'order_success'
            })
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error in place_order: {e}")
        print(f"Traceback: {error_trace}")
        return jsonify({
            'success': False, 
            'message': f'Lỗi khi đặt hàng: {str(e)}'
        }), 500

@app.route('/order-success')
def order_success():
    """Trang thành công"""
    order_id = request.args.get('order_id')
    tx_hash = request.args.get('tx_hash', '')
    
    if not order_id:
        return redirect('/')
    
    order = get_order_by_id(order_id)
    
    if not order:
        return "Không tìm thấy đơn hàng", 404
    
    # Get payment transaction if exists
    payment_transaction = get_payment_transaction_by_order(order_id)
    
    # Get payment method - ưu tiên từ order, fallback từ payment_transaction (cho PayPal khi order có thể thiếu)
    payment_method = (order.get('payment_method') or 
                      (payment_transaction.get('payment_method') if payment_transaction else None) or 
                      'cod')
    # Chuẩn hóa về lowercase để so sánh
    if payment_method:
        payment_method = str(payment_method).lower().strip()
    
    # Số tiền USD cho PayPal (thanh toán chuyển đổi sang $)
    amount_usd = None
    if payment_method == 'paypal':
        amount_usd = get_amount_usd_from_vnd(order.get('total', 0))
    
    # NFT chứng nhận (nếu có)
    nft_certificate = None
    nft_contract_address = ''
    nft_explorer_base = 'https://bscscan.com'
    try:
        nft_certificate = get_nft_certificate_by_order(order_id)
        if nft_certificate and NFT_AVAILABLE:
            chain_id = nft_certificate.get('chain_id', 56)
            cfg = get_nft_config(chain_id)
            nft_contract_address = cfg.get('contract_address', '')
            nft_explorer_base = cfg.get('explorer', 'https://bscscan.com')
    except Exception:
        nft_certificate = None
    
    return render_template('order_success.html', 
                         order_id=order_id, 
                         order=order,
                         tx_hash=tx_hash,
                         payment_method=payment_method,
                         payment_transaction=payment_transaction,
                         amount_usd=amount_usd,
                         nft_certificate=nft_certificate,
                         nft_contract_address=nft_contract_address,
                         nft_explorer_base=nft_explorer_base)

@app.route('/bank-transfer/<order_id>')
def bank_transfer(order_id):
    """Trang chuyển khoản"""
    order = get_order_by_id(order_id)
    
    if not order:
        return "Không tìm thấy đơn hàng", 404
    
    return render_template('bank_transfer.html', 
                         order_id=order_id,
                         order=order,
                         total=order['total'],
                         bank_code=BANK_INFO['bank_code'],
                         bank_name=BANK_INFO['bank_name'],
                         account_number=BANK_INFO['account_number'],
                         account_name=BANK_INFO['account_name'])

@app.route('/credit-card/<order_id>')
def credit_card(order_id):
    """Trang thanh toán thẻ"""
    order = get_order_by_id(order_id)
    
    if not order:
        return "Không tìm thấy đơn hàng", 404
    
    return render_template('credit_card.html',
                         order_id=order_id,
                         order=order,
                         total=order['total'])

# ==================== PayPal Payment Routes ====================

@app.route('/api/paypal/create-order', methods=['POST'])
def paypal_create_order():
    """Tạo PayPal order và trả về approval URL"""
    try:
        data = request.get_json(silent=True) or {}
        order_id = data.get('order_id')
        amount = data.get('amount', 0)
        
        if not order_id or not amount:
            return jsonify({'success': False, 'message': 'Thiếu thông tin đơn hàng (order_id, amount)'}), 400
        
        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return jsonify({'success': False, 'message': 'Số tiền không hợp lệ'}), 400
        
        if amount <= 0:
            return jsonify({'success': False, 'message': 'Số tiền phải lớn hơn 0'}), 400
        
        order = get_order_by_id(order_id)
        if not order:
            return jsonify({'success': False, 'message': 'Không tìm thấy đơn hàng'}), 404
        
        # Tạo return và cancel URLs
        base_url = request.url_root.rstrip('/')
        return_url = f"{base_url}/paypal/success?order_id={order_id}"
        cancel_url = f"{base_url}/paypal/cancel?order_id={order_id}"
        
        approval_url, error = create_paypal_order(
            order_id=order_id,
            amount=float(amount),
            currency='VND',
            return_url=return_url,
            cancel_url=cancel_url
        )
        
        if error:
            return jsonify({'success': False, 'message': str(error)}), 400
        
        return jsonify({
            'success': True,
            'approval_url': approval_url
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/paypal/success')
def paypal_success():
    """Xử lý khi user thanh toán PayPal thành công"""
    order_id = request.args.get('order_id')
    token = request.args.get('token')  # PayPal order ID
    payer_id = request.args.get('PayerID')
    
    if not order_id or not token:
        flash('Thông tin thanh toán không hợp lệ', 'error')
        return redirect(url_for('cart'))
    
    order = get_order_by_id(order_id)
    if not order:
        flash('Không tìm thấy đơn hàng', 'error')
        return redirect(url_for('index'))
    
    # Capture PayPal payment
    success, error = capture_paypal_order(token)
    
    if success:
        # Cập nhật order và payment transaction
        update_order_status(order_id, 'confirmed', payment_status='paid')
        update_payment_transaction_by_order(order_id, 'completed', paid_at=datetime.now(), bank_reference=token)
        
        try:
            # Lấy order đầy đủ từ DB (có subtotal, shipping_fee, items...) để gửi email
            order_full = get_order_by_id(order_id)
            if order_full:
                send_order_confirmation_email(order_full)
        except Exception as e:
            print(f"Không thể gửi email: {str(e)}")
        
        # Tính số tiền USD để thông báo cho khách
        amount_usd = get_amount_usd_from_vnd(order.get('total', 0))
        flash(f'Thanh toán PayPal thành công! Số tiền: ${amount_usd:,.2f} USD', 'success')
        return redirect(url_for('order_success', order_id=order_id))
    else:
        flash(f'Lỗi thanh toán PayPal: {error}', 'error')
        return redirect(url_for('order_success', order_id=order_id))

@app.route('/paypal/cancel')
def paypal_cancel():
    """Xử lý khi user hủy thanh toán PayPal"""
    order_id = request.args.get('order_id')
    flash('Bạn đã hủy thanh toán PayPal. Đơn hàng vẫn được lưu, bạn có thể thanh toán sau.', 'info')
    if order_id:
        return redirect(url_for('order_success', order_id=order_id))
    return redirect(url_for('cart'))

@app.route('/api/process-card-payment', methods=['POST'])
def process_card_payment():
    """Xử lý thanh toán thẻ"""
    data = request.json
    order_id = data.get('order_id')
    
    order = get_order_by_id(order_id)
    
    if not order:
        return jsonify({
            'success': False,
            'message': 'Không tìm thấy đơn hàng'
        })
    
    # Tạo transaction ID
    transaction_id = 'TXN' + ''.join(random.choices(string.digits, k=12))
    
    # Tạo payment transaction
    try:
        transaction_data = {
            'transaction_id': transaction_id,
            'order_id': order_id,
            'payment_method': 'credit_card',
            'amount': float(order['total']),
            'currency': 'VND',
            'status': 'completed',
            'paid_at': datetime.now()
        }
        create_payment_transaction(transaction_data)
    except Exception as e:
        print(f"Lỗi khi tạo payment transaction: {e}")
    
    # Cập nhật trạng thái
    update_order_status(order_id, 'confirmed', 'paid')
    
    # Gửi email
    try:
        send_order_confirmation_email(order)
    except Exception as e:
        print(f"Không thể gửi email: {str(e)}")
    
    return jsonify({
        'success': True,
        'message': 'Thanh toán thành công',
        'transaction_id': transaction_id
    })

@app.route('/api/check-payment', methods=['POST'])
def check_payment():
    """Kiểm tra trạng thái thanh toán"""
    data = request.json
    order_id = data.get('order_id')
    
    if not order_id:
        return jsonify({
            'paid': False,
            'message': 'Thiếu order_id'
        }), 400
    
    # Kiểm tra payment transaction
    transaction = get_payment_transaction_by_order(order_id)
    
    if transaction:
        if transaction.get('status') == 'completed':
            return jsonify({
                'paid': True,
                'message': 'Đã thanh toán',
                'transaction_id': transaction.get('transaction_id'),
                'paid_at': transaction.get('paid_at').isoformat() if transaction.get('paid_at') else None
            })
        else:
            return jsonify({
                'paid': False,
                'message': f'Trạng thái: {transaction.get("status", "pending")}',
                'transaction_id': transaction.get('transaction_id')
            })
    
    # Kiểm tra order status
    order = get_order_by_id(order_id)
    if order and order.get('payment_status') == 'paid':
        return jsonify({
            'paid': True,
            'message': 'Đã thanh toán',
            'transaction_id': None
        })
    
    return jsonify({
        'paid': False,
        'message': 'Chưa thanh toán'
    })

# Các trang thông tin
@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/partners')
def partners():
    """Trang đối tác"""
    return render_template('partners.html')

@app.route('/policy')
def policy():
    return render_template('policy.html')

@app.route('/terms')
def terms():
    """Trang điều khoản dịch vụ"""
    return render_template('terms.html')

@app.route('/privacy')
def privacy():
    """Trang chính sách bảo mật"""
    return render_template('privacy.html')

@app.route('/contact', methods=['GET', 'POST'])
def contact():
    """Trang liên hệ"""
    if request.method == 'POST':
        # Lấy dữ liệu từ form
        contact_data = {
            'name': request.form.get('name'),
            'email': request.form.get('email'),
            'phone': request.form.get('phone', ''),
            'subject': request.form.get('subject'),
            'message': request.form.get('message')
        }
        
        # Validate
        if not all([contact_data['name'], contact_data['email'], 
                   contact_data['subject'], contact_data['message']]):
            flash('Vui lòng điền đầy đủ thông tin bắt buộc', 'error')
            return render_template('contact.html')
        
        # Lưu vào database
        if create_contact(contact_data):
            # Gửi email thông báo cho admin
            send_contact_email(contact_data)
            
            # Gửi email trả lời tự động cho khách hàng
            send_contact_reply_email(contact_data)
            
            flash('Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong 24h.', 'success')
            return redirect(url_for('contact'))
        else:
            flash('Có lỗi xảy ra, vui lòng thử lại sau', 'error')
    
    return render_template('contact.html')

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

# ==================== CUSTOMER AUTH ROUTES ====================

@app.route('/register', methods=['GET', 'POST'])
def customer_register():
    """Đăng ký tài khoản khách hàng"""
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        full_name = request.form.get('full_name') or request.form.get('name')
        phone = request.form.get('phone')
        address = request.form.get('address')
        
        # Validate
        if not all([email, password, full_name]):
            flash('Vui lòng điền đầy đủ thông tin bắt buộc', 'error')
            return render_template('customer/register.html')
        
        if password != confirm_password:
            flash('Mật khẩu xác nhận không khớp', 'error')
            return render_template('customer/register.html')
        
        if len(password) < 6:
            flash('Mật khẩu phải có ít nhất 6 ký tự', 'error')
            return render_template('customer/register.html')
        
        # Kiểm tra email đã tồn tại
        if get_customer_by_email(email):
            flash('Email này đã được đăng ký', 'error')
            return render_template('customer/register.html')
        
        # Tạo tài khoản
        result = create_customer(email, password, full_name, phone, address)
        
        if result:
            # Lấy danh sách mã giảm giá đang hoạt động
            active_coupons = get_all_coupons(active_only=True, limit=5)
            session['show_coupons_after_register'] = True
            session['coupons_list'] = [
                {
                    'code': c['code'],
                    'name': c['name'],
                    'description': c.get('description', ''),
                    'discount_type': c['discount_type'],
                    'discount_value': float(c['discount_value']),
                    'min_order_amount': float(c.get('min_order_amount', 0))
                }
                for c in active_coupons
            ]
            flash('Đăng ký thành công! Vui lòng đăng nhập', 'success')
            return redirect(url_for('customer_login'))
        else:
            flash('Đã có lỗi xảy ra, vui lòng thử lại', 'error')
    
    return render_template('customer/register.html')

@app.route('/login', methods=['GET', 'POST'])
def customer_login():
    """Đăng nhập khách hàng"""
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        remember = request.form.get('remember')
        
        customer = verify_customer(email, password)
        
        if customer:
            session['customer_logged_in'] = True
            session['customer_id'] = customer['id']
            session['customer_email'] = customer['email']
            session['customer_name'] = customer['full_name']
            
            # Xử lý "Nhớ đăng nhập"
            if remember:
                from datetime import timedelta
                session.permanent = True
                app.permanent_session_lifetime = timedelta(days=30)
            else:
                session.permanent = False
            
            # Lấy danh sách mã giảm giá đang hoạt động
            active_coupons = get_all_coupons(active_only=True, limit=5)
            session['show_coupons_after_login'] = True
            session['coupons_list'] = [
                {
                    'code': c['code'],
                    'name': c['name'],
                    'description': c.get('description', ''),
                    'discount_type': c['discount_type'],
                    'discount_value': float(c['discount_value']),
                    'min_order_amount': float(c.get('min_order_amount', 0))
                }
                for c in active_coupons
            ]
            
            flash('Đăng nhập thành công!', 'success')
            
            # Redirect về trang trước đó hoặc trang chủ
            next_page = request.args.get('next')
            return redirect(next_page if next_page else url_for('index'))
        else:
            flash('Email hoặc mật khẩu không đúng', 'error')
    
    return render_template('customer/login.html')

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    """Quên mật khẩu - Gửi email reset"""
    if request.method == 'POST':
        email = request.form.get('email')
        
        if not email:
            flash('Vui lòng nhập email', 'error')
            return render_template('customer/forgot_password.html')
        
        customer = get_customer_by_email(email)
        
        if customer:
            import secrets
            import hashlib
            from datetime import datetime, timedelta
            
            # Tạo reset token
            token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            expires_at = datetime.now() + timedelta(hours=1)
            
            # Lưu token vào database (hoặc session nếu không có bảng reset_tokens)
            # Tạm thời lưu vào session
            if 'reset_tokens' not in session:
                session['reset_tokens'] = {}
            session['reset_tokens'][token_hash] = {
                'email': email,
                'expires_at': expires_at.isoformat()
            }
            
            # Gửi email reset
            reset_url = url_for('reset_password', token=token, _external=True)
            send_password_reset_email(email, reset_url, customer['full_name'])
            
            flash('Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư của bạn.', 'success')
            return redirect(url_for('customer_login'))
        else:
            flash('Email không tồn tại trong hệ thống', 'error')
    
    return render_template('customer/forgot_password.html')

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    """Đặt lại mật khẩu với token"""
    import hashlib
    from datetime import datetime
    
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Kiểm tra token trong session
    if 'reset_tokens' not in session or token_hash not in session['reset_tokens']:
        flash('Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', 'error')
        return redirect(url_for('customer_login'))
    
    token_data = session['reset_tokens'][token_hash]
    expires_at = datetime.fromisoformat(token_data['expires_at'])
    
    if datetime.now() > expires_at:
        del session['reset_tokens'][token_hash]
        flash('Link đặt lại mật khẩu đã hết hạn', 'error')
        return redirect(url_for('forgot_password'))
    
    if request.method == 'POST':
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')
        
        if not new_password or not confirm_password:
            flash('Vui lòng điền đầy đủ thông tin', 'error')
            return render_template('customer/reset_password.html', token=token)
        
        if new_password != confirm_password:
            flash('Mật khẩu xác nhận không khớp', 'error')
            return render_template('customer/reset_password.html', token=token)
        
        if len(new_password) < 6:
            flash('Mật khẩu phải có ít nhất 6 ký tự', 'error')
            return render_template('customer/reset_password.html', token=token)
        
        # Cập nhật mật khẩu
        customer = get_customer_by_email(token_data['email'])
        if customer:
            update_customer_password(customer['id'], new_password)
            del session['reset_tokens'][token_hash]
            flash('Đặt lại mật khẩu thành công! Vui lòng đăng nhập', 'success')
            return redirect(url_for('customer_login'))
        else:
            flash('Không tìm thấy tài khoản', 'error')
            return redirect(url_for('customer_login'))
    
    return render_template('customer/reset_password.html', token=token)

@app.route('/logout')
def customer_logout():
    """Đăng xuất khách hàng"""
    session.pop('customer_logged_in', None)
    session.pop('customer_id', None)
    session.pop('customer_email', None)
    session.pop('customer_name', None)
    flash('Đã đăng xuất', 'info')
    return redirect(url_for('index'))

@app.route('/account')
@login_required
def customer_account():
    """Trang tài khoản khách hàng"""
    customer = get_customer_by_id(session['customer_id'])
    
    # Lấy đơn hàng của khách hàng
    query = "SELECT * FROM orders WHERE customer_id = %s ORDER BY created_at DESC"
    connection = get_db_connection()
    if connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, (session['customer_id'],))
        orders = cursor.fetchall()
        cursor.close()
        connection.close()
    else:
        orders = []
    
    # Lấy wishlist
    wishlist = get_wishlist(session['customer_id'])
    
    # Lấy đánh giá của khách hàng
    customer_reviews_query = "SELECT * FROM product_reviews WHERE customer_id = %s ORDER BY created_at DESC LIMIT 10"
    customer_reviews = execute_query(customer_reviews_query, (session['customer_id'],), fetch=True) or []
    
    # Parse images JSON cho reviews
    for review in customer_reviews:
        if review.get('images'):
            try:
                import json
                review['images'] = json.loads(review['images'])
            except:
                review['images'] = []
    
    # Lấy địa chỉ giao hàng
    shipping_addresses = get_shipping_addresses(session['customer_id'])
    
    # Lấy thông báo
    notifications = get_notifications(session['customer_id'], 'customer', unread_only=False, limit=10)
    unread_count = count_unread_notifications(session['customer_id'], 'customer')
    
    # Lấy giao dịch thanh toán
    transactions_query = """
        SELECT pt.* FROM payment_transactions pt
        JOIN orders o ON pt.order_id = o.order_id
        WHERE o.customer_id = %s
        ORDER BY pt.created_at DESC
        LIMIT 10
    """
    transactions = execute_query(transactions_query, (session['customer_id'],), fetch=True) or []
    
    return render_template('customer/account.html', 
                         customer=customer, 
                         orders=orders,
                         wishlist=wishlist,
                         customer_reviews=customer_reviews,
                         shipping_addresses=shipping_addresses,
                         notifications=notifications,
                         unread_count=unread_count,
                         transactions=transactions)

@app.route('/account/update', methods=['POST'])
@login_required
def update_customer_info():
    """Cập nhật thông tin khách hàng"""
    data = {
        'full_name': request.form.get('full_name'),
        'phone': request.form.get('phone'),
        'address': request.form.get('address')
    }
    
    result = update_customer(session['customer_id'], data)
    
    if result:
        session['customer_name'] = data['full_name']
        flash('Cập nhật thông tin thành công!', 'success')
    else:
        flash('Đã có lỗi xảy ra', 'error')
    
    return redirect(url_for('customer_account'))

@app.route('/account/change-password', methods=['POST'])
@login_required
def change_customer_password():
    """Đổi mật khẩu khách hàng"""
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')
    
    # Validate
    customer = get_customer_by_id(session['customer_id'])
    
    if not verify_customer(customer['email'], current_password):
        flash('Mật khẩu hiện tại không đúng', 'error')
        return redirect(url_for('customer_account'))
    
    if new_password != confirm_password:
        flash('Mật khẩu mới không khớp', 'error')
        return redirect(url_for('customer_account'))
    
    if len(new_password) < 6:
        flash('Mật khẩu phải có ít nhất 6 ký tự', 'error')
        return redirect(url_for('customer_account'))
    
    result = update_customer_password(session['customer_id'], new_password)
    
    if result:
        flash('Đổi mật khẩu thành công!', 'success')
    else:
        flash('Đã có lỗi xảy ra', 'error')
    
    return redirect(url_for('customer_account'))

@app.route('/order/<order_id>')
@login_required
def customer_order_detail(order_id):
    """Trang chi tiết đơn hàng của khách hàng"""
    order = get_order_by_id(order_id)
    
    if not order:
        flash('Không tìm thấy đơn hàng', 'error')
        return redirect(url_for('customer_account'))
    
    # Kiểm tra quyền xem đơn hàng (chỉ chủ đơn hàng mới xem được)
    if order.get('customer_id') != session.get('customer_id'):
        flash('Bạn không có quyền xem đơn hàng này', 'error')
        return redirect(url_for('customer_account'))
    
    # Lấy lịch sử thay đổi trạng thái đơn hàng
    order_history = get_order_status_history(order_id)
    
    return render_template('customer/order_detail.html', order=order, order_history=order_history)

@app.route('/order/<order_id>/cancel', methods=['POST'])
@login_required
def customer_cancel_order(order_id):
    """Hủy đơn hàng"""
    order = get_order_by_id(order_id)
    
    if not order:
        flash('Không tìm thấy đơn hàng', 'error')
        return redirect(url_for('customer_account'))
    
    # Kiểm tra quyền (chỉ chủ đơn hàng mới hủy được)
    if order.get('customer_id') != session.get('customer_id'):
        flash('Bạn không có quyền hủy đơn hàng này', 'error')
        return redirect(url_for('customer_account'))
    
    # Chỉ cho phép hủy đơn hàng ở trạng thái pending
    if order['status'] != 'pending':
        flash('Chỉ có thể hủy đơn hàng đang chờ xử lý', 'error')
        return redirect(url_for('customer_order_detail', order_id=order_id))
    
    # Cập nhật trạng thái
    result = update_order_status(order_id, 'cancelled', order['payment_status'])
    
    if result:
        flash('Đã hủy đơn hàng thành công', 'success')
    else:
        flash('Có lỗi xảy ra khi hủy đơn hàng', 'error')
    
    return redirect(url_for('customer_account'))

# ==================== ADMIN ROUTES ====================

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Trang đăng nhập admin - Không cần DDoS verification"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if not username or not password:
            flash('Vui lòng nhập đầy đủ thông tin', 'error')
            return render_template('admin/login.html')
        
        admin = verify_admin(username, password)
        
        if admin:
            session['admin_logged_in'] = True
            session['admin_id'] = admin['id']
            session['admin_username'] = admin['username']
            session['admin_name'] = admin['full_name']
            session['ddos_verified'] = True
            session['ddos_verified_time'] = time.time()
            flash('Đăng nhập thành công!', 'success')
            return redirect(url_for('admin_dashboard'))
        else:
            flash('Tên đăng nhập hoặc mật khẩu không đúng', 'error')
    
    return render_template('admin/login.html')

@app.route('/admin/logout')
def admin_logout():
    """Đăng xuất admin"""
    session.pop('admin_logged_in', None)
    session.pop('admin_id', None)
    session.pop('admin_username', None)
    session.pop('admin_name', None)
    flash('Đã đăng xuất', 'info')
    return redirect(url_for('admin_login'))

@app.route('/admin')
@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    """Trang dashboard admin"""
    # Lấy thống kê đầy đủ
    stats = {
        'total_products': count_products(),
        'total_orders': count_orders(),
        'revenue': get_revenue_stats(),
        'total_customers': count_customers() or 0,
        'total_reviews': count_reviews(),
        'pending_reviews': count_reviews(approved_only=False),
        'total_coupons': count_coupons(),
        'active_coupons': count_coupons(active_only=True),
        'total_contacts': count_contacts(),
        'new_contacts': count_contacts(status='new'),
        'total_notifications': count_notifications(user_type='customer'),
        'unread_notifications': count_notifications(user_type='customer', unread_only=True),
        'total_transactions': count_payment_transactions(),
        'pending_transactions': count_payment_transactions(status='pending')
    }
    
    recent_orders = get_all_orders(limit=10)
    
    # Lấy thống kê doanh thu theo thời gian (30 ngày gần đây)
    revenue_by_day = get_revenue_by_period('day', 30)
    revenue_by_payment = get_revenue_by_payment_method()
    top_products = get_top_products_by_revenue(5)
    
    return render_template('admin/dashboard.html', 
                         stats=stats,
                         recent_orders=recent_orders,
                         revenue_by_day=revenue_by_day,
                         revenue_by_payment=revenue_by_payment,
                         top_products=top_products)

@app.route('/admin/reports/revenue')
@admin_required
def admin_revenue_report():
    """Báo cáo doanh thu chi tiết"""
    period = request.args.get('period', 'day')
    days = request.args.get('days', 30, type=int)
    
    revenue_data = get_revenue_by_period(period, days)
    revenue_by_payment = get_revenue_by_payment_method()
    top_products = get_top_products_by_revenue(20)
    
    return render_template('admin/revenue_report.html',
                         revenue_data=revenue_data,
                         revenue_by_payment=revenue_by_payment,
                         top_products=top_products,
                         period=period,
                         days=days)

@app.route('/admin/orders/export')
@admin_required
def admin_export_orders():
    """Export đơn hàng ra CSV"""
    import csv
    from io import StringIO
    from flask import Response
    
    status_filter = request.args.get('status', '')
    payment_filter = request.args.get('payment_status', '')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    
    # Lấy đơn hàng
    query = "SELECT * FROM orders WHERE 1=1"
    params = []
    
    if status_filter:
        query += " AND status = %s"
        params.append(status_filter)
    
    if payment_filter:
        query += " AND payment_status = %s"
        params.append(payment_filter)
    
    if date_from:
        query += " AND DATE(created_at) >= %s"
        params.append(date_from)
    
    if date_to:
        query += " AND DATE(created_at) <= %s"
        params.append(date_to)
    
    query += " ORDER BY created_at DESC"
    
    orders = execute_query(query, tuple(params) if params else None, fetch=True)
    
    # Tạo CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'Mã Đơn', 'Khách Hàng', 'Email', 'SĐT', 'Địa Chỉ',
        'Tổng Tiền', 'Trạng Thái', 'Thanh Toán', 'Phương Thức Thanh Toán',
        'Ngày Đặt', 'Ghi Chú'
    ])
    
    # Data
    for order in orders:
        writer.writerow([
            order.get('order_id', ''),
            order.get('customer_name', ''),
            order.get('email', ''),
            order.get('phone', ''),
            order.get('address', ''),
            order.get('total', 0),
            order.get('status', ''),
            order.get('payment_status', ''),
            order.get('payment_method', ''),
            order.get('created_at', '').strftime('%d/%m/%Y %H:%M:%S') if order.get('created_at') else '',
            order.get('note', '')
        ])
    
    output.seek(0)
    
    # Tạo response
    response = Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename=orders_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        }
    )
    
    return response

@app.route('/admin/products')
@admin_required
def admin_products():
    """Danh sách sản phẩm admin"""
    products_list = get_all_products(active_only=False)
    
    seen_ids = set()
    unique_products = []
    for product in products_list:
        if not product or not isinstance(product, dict):
            continue
        product_id = product.get('id')
        if product_id is not None:
            try:
                product_id = int(product_id)
                if product_id not in seen_ids:
                    seen_ids.add(product_id)
                    unique_products.append(product)
            except (ValueError, TypeError):
                continue
    
    products_list = unique_products
    categories = get_category_names()
    
    return render_template('admin/products.html',
                         products=products_list,
                         categories=categories)

@app.route('/admin/products/add', methods=['GET', 'POST'])
@admin_required
def admin_add_product():
    """Thêm sản phẩm mới"""
    if request.method == 'POST':
        # Lấy features từ form (mỗi feature trên 1 dòng)
        features_text = request.form.get('features', '')
        features = [f.strip() for f in features_text.split('\n') if f.strip()]
        
        try:
            product_data = {
                'name': request.form.get('name'),
                'category': request.form.get('category'),
                'price': float(request.form.get('price', 0)),
                'original_price': float(request.form.get('original_price', 0)),
                'image': request.form.get('image', ''),
                'description': request.form.get('description', ''),
                'features': features,
                'rating': float(request.form.get('rating', 5.0)),
                'reviews': int(request.form.get('reviews', 0)),
                'stock': int(request.form.get('stock', 100))
            }
            
            # Validate required fields
            if not product_data['name'] or not product_data['category']:
                flash('Vui lòng điền đầy đủ tên sản phẩm và danh mục', 'error')
            elif product_data['price'] <= 0:
                flash('Giá bán phải lớn hơn 0', 'error')
            else:
                result = create_product(product_data)
                
                if result:
                    flash('Thêm sản phẩm thành công!', 'success')
                    return redirect(url_for('admin_products'))
                else:
                    flash('Lỗi khi thêm sản phẩm. Vui lòng thử lại.', 'error')
        except ValueError as e:
            flash(f'Lỗi định dạng dữ liệu: {str(e)}', 'error')
        except Exception as e:
            flash(f'Lỗi không mong muốn: {str(e)}', 'error')
    
    categories = get_category_names()
    return render_template('admin/product_form.html', 
                         product=None,
                         categories=categories,
                         action='add')

@app.route('/admin/products/edit/<int:product_id>', methods=['GET', 'POST'])
@admin_required
def admin_edit_product(product_id):
    """Sửa sản phẩm"""
    product = get_product_by_id(product_id)
    
    if not product:
        flash('Không tìm thấy sản phẩm', 'error')
        return redirect(url_for('admin_products'))
    
    if request.method == 'POST':
        # Lấy features từ form
        features_text = request.form.get('features', '')
        features = [f.strip() for f in features_text.split('\n') if f.strip()]
        
        try:
            product_data = {
                'name': request.form.get('name'),
                'category': request.form.get('category'),
                'price': float(request.form.get('price', 0)),
                'original_price': float(request.form.get('original_price', 0)),
                'image': request.form.get('image', ''),
                'description': request.form.get('description', ''),
                'features': features,
                'rating': float(request.form.get('rating', 5.0)),
                'reviews': int(request.form.get('reviews', 0)),
                'stock': int(request.form.get('stock', 100)),
                'is_active': request.form.get('is_active') == 'on'
            }
            
            # Validate required fields
            if not product_data['name'] or not product_data['category']:
                flash('Vui lòng điền đầy đủ tên sản phẩm và danh mục', 'error')
            elif product_data['price'] <= 0:
                flash('Giá bán phải lớn hơn 0', 'error')
            else:
                result = update_product(product_id, product_data)
                
                if result:
                    flash('Cập nhật sản phẩm thành công!', 'success')
                    return redirect(url_for('admin_products'))
                else:
                    flash('Lỗi khi cập nhật sản phẩm. Vui lòng thử lại.', 'error')
        except ValueError as e:
            flash(f'Lỗi định dạng dữ liệu: {str(e)}', 'error')
        except Exception as e:
            flash(f'Lỗi không mong muốn: {str(e)}', 'error')
    
    categories = get_category_names()
    return render_template('admin/product_form.html',
                         product=product,
                         categories=categories,
                         action='edit')

@app.route('/admin/products/delete/<int:product_id>', methods=['POST'])
@admin_required
def admin_delete_product(product_id):
    """Xóa sản phẩm"""
    # Kiểm tra sản phẩm có tồn tại không
    product = get_product_by_id(product_id)
    if not product:
        flash('Không tìm thấy sản phẩm', 'error')
        return redirect(url_for('admin_products'))
    
    # Kiểm tra xem có yêu cầu xóa vĩnh viễn không
    hard_delete = request.form.get('hard_delete') == 'true'
    
    try:
        if hard_delete:
            # Xóa vĩnh viễn
            from db_helper import hard_delete_product
            result = hard_delete_product(product_id)
            if result:
                flash(f'Đã xóa vĩnh viễn sản phẩm "{product["name"]}"!', 'success')
            else:
                flash('Lỗi khi xóa vĩnh viễn sản phẩm. Vui lòng thử lại.', 'error')
        else:
            # Soft delete (ẩn khỏi website)
            result = delete_product(product_id)
            if result:
                flash(f'Đã ẩn sản phẩm "{product["name"]}" khỏi website!', 'success')
            else:
                flash('Lỗi khi ẩn sản phẩm. Vui lòng thử lại.', 'error')
    except Exception as e:
        print(f"Lỗi khi xóa sản phẩm {product_id}: {e}")
        flash(f'Lỗi khi xóa sản phẩm: {str(e)}', 'error')
    
    return redirect(url_for('admin_products'))

@app.route('/admin/products/restore/<int:product_id>', methods=['POST'])
@admin_required
def admin_restore_product(product_id):
    """Khôi phục sản phẩm đã bị ẩn"""
    product = get_product_by_id(product_id)
    if not product:
        flash('Không tìm thấy sản phẩm', 'error')
        return redirect(url_for('admin_products'))
    
    try:
        query = "UPDATE products SET is_active = TRUE WHERE id = %s"
        from db_helper import execute_query
        result = execute_query(query, (product_id,))
        
        if result:
            flash(f'Đã khôi phục sản phẩm "{product["name"]}"!', 'success')
        else:
            flash('Lỗi khi khôi phục sản phẩm. Vui lòng thử lại.', 'error')
    except Exception as e:
        print(f"Lỗi khi khôi phục sản phẩm {product_id}: {e}")
        flash(f'Lỗi khi khôi phục sản phẩm: {str(e)}', 'error')
    
    return redirect(url_for('admin_products'))

# ==================== Product Images Management ====================
@app.route('/admin/products/<int:product_id>/images')
@admin_required
def admin_product_images(product_id):
    """Quản lý hình ảnh sản phẩm"""
    product = get_product_by_id(product_id)
    if not product:
        flash('Không tìm thấy sản phẩm', 'error')
        return redirect(url_for('admin_products'))
    
    images = get_product_images(product_id)
    return render_template('admin/product_images.html', product=product, images=images)

@app.route('/admin/products/<int:product_id>/images/add', methods=['POST'])
@admin_required
def admin_add_product_image(product_id):
    """Thêm hình ảnh sản phẩm"""
    image_url = request.form.get('image_url')
    alt_text = request.form.get('alt_text', '')
    is_primary = request.form.get('is_primary') == 'on'
    
    if not image_url:
        flash('Vui lòng nhập URL hình ảnh', 'error')
        return redirect(url_for('admin_product_images', product_id=product_id))
    
    result = add_product_image(product_id, image_url, alt_text, is_primary)
    
    if result:
        flash('Thêm hình ảnh thành công!', 'success')
    else:
        flash('Lỗi khi thêm hình ảnh', 'error')
    
    return redirect(url_for('admin_product_images', product_id=product_id))

@app.route('/admin/products/<int:product_id>/images/<int:image_id>/delete', methods=['POST'])
@admin_required
def admin_delete_product_image(product_id, image_id):
    """Xóa hình ảnh sản phẩm"""
    result = delete_product_image(image_id)
    
    if result:
        flash('Xóa hình ảnh thành công!', 'success')
    else:
        flash('Lỗi khi xóa hình ảnh', 'error')
    
    return redirect(url_for('admin_product_images', product_id=product_id))

@app.route('/admin/products/<int:product_id>/images/<int:image_id>/set-primary', methods=['POST'])
@admin_required
def admin_set_primary_image(product_id, image_id):
    """Đặt làm ảnh chính"""
    # Bỏ primary của tất cả ảnh khác
    query = "UPDATE product_images SET is_primary = FALSE WHERE product_id = %s"
    execute_query(query, (product_id,))
    
    # Đặt ảnh này làm primary
    query = "UPDATE product_images SET is_primary = TRUE WHERE id = %s"
    result = execute_query(query, (image_id,))
    
    if result:
        flash('Đã đặt làm ảnh chính!', 'success')
    else:
        flash('Lỗi khi đặt ảnh chính', 'error')
    
    return redirect(url_for('admin_product_images', product_id=product_id))

@app.route('/admin/orders')
@admin_required
def admin_orders():
    """Danh sách đơn hàng"""
    orders = get_all_orders()
    return render_template('admin/orders.html', orders=orders)

@app.route('/admin/orders/<order_id>')
@admin_required
def admin_order_detail(order_id):
    """Chi tiết đơn hàng"""
    order = get_order_by_id(order_id)
    
    if not order:
        flash('Không tìm thấy đơn hàng', 'error')
        return redirect(url_for('admin_orders'))
    
    return render_template('admin/order_detail.html', order=order)

@app.route('/admin/orders/<order_id>/update-status', methods=['POST'])
@admin_required
def admin_update_order_status(order_id):
    """Cập nhật trạng thái đơn hàng"""
    status = request.form.get('status')
    payment_status = request.form.get('payment_status')
    note = request.form.get('note', '')
    changed_by = session.get('admin_username', 'admin')
    
    result = update_order_status(order_id, status, payment_status, note, changed_by)
    
    if result:
        flash('Cập nhật trạng thái thành công!', 'success')
    else:
        flash('Lỗi khi cập nhật trạng thái', 'error')
    
    return redirect(url_for('admin_order_detail', order_id=order_id))

@app.route('/admin/settings', methods=['GET', 'POST'])
@admin_required
def admin_settings():
    """Quản lý cài đặt website"""
    if request.method == 'POST':
        settings_to_update = {}
        
        setting_keys = [
            'site_logo', 'site_name', 'site_description',
            'hero_banner_image', 'hero_banner_title', 'hero_banner_subtitle',
            'hero_banner_button_text', 'hero_banner_button_link',
            'contact_phone', 'contact_email', 'contact_address', 'contact_facebook', 'contact_zalo',
            'contact_instagram', 'contact_youtube', 'contact_tiktok',
            'bank_code', 'bank_name', 'account_number', 'account_name',
            'paypal_client_id', 'paypal_client_secret', 'paypal_sandbox', 'vnd_usd_rate',
            'smtp_server', 'smtp_port', 'sender_email', 'sender_password',
            'shipping_fee', 'free_shipping_threshold',
            'meta_description', 'meta_keywords', 'google_analytics',
            'currency', 'tax_rate',
            'maintenance_message',
            'session_timeout', 'password_min_length',
            'products_per_page', 'orders_per_page',
            'nft_contract_address', 'nft_testnet_contract_address', 'nft_minter_private_key', 'site_url'
        ]
        
        checkbox_keys = [
            'email_enabled', 'maintenance_mode',
            'enable_reviews', 'enable_coupons', 'enable_notifications',
            'paypal_sandbox', 'nft_enabled', 'web3_testnet_mode'
        ]
        
        for key in setting_keys:
            value = request.form.get(key, '')
            if key == 'sender_password' and value == '':
                continue
            if key == 'paypal_client_secret' and value == '':
                continue  # Không ghi đè nếu để trống
            if key == 'nft_minter_private_key' and value == '':
                continue  # Không ghi đè nếu để trống
            settings_to_update[key] = value
        
        for key in checkbox_keys:
            # Kiểm tra checkbox - nếu được check thì có giá trị '1' hoặc 'on', nếu không thì '0'
            checkbox_value = request.form.get(key)
            if checkbox_value in ['1', 'on', True]:
                settings_to_update[key] = '1'
            else:
                settings_to_update[key] = '0'
        
        try:
            if update_multiple_settings(settings_to_update):
                flash('Cập nhật cài đặt thành công!', 'success')
            else:
                flash('Có lỗi xảy ra khi cập nhật cài đặt. Vui lòng kiểm tra lại.', 'error')
        except Exception as e:
            print(f"Lỗi trong admin_settings: {e}")
            flash(f'Có lỗi xảy ra: {str(e)}', 'error')
        
        return redirect(url_for('admin_settings'))
    
    settings = get_all_settings()
    settings_dict = {s['setting_key']: s for s in settings} if settings else {}
    
    return render_template('admin/settings.html', settings=settings_dict)

# ============================================
# ROUTES QUẢN LÝ KHÁCH HÀNG (CUSTOMERS)
# ============================================

@app.route('/admin/customers')
@admin_required
def admin_customers():
    """Danh sách khách hàng"""
    # Lấy tham số từ URL
    page = request.args.get('page', 1, type=int)
    search = request.args.get('search', '')
    status_filter = request.args.get('status', '')
    
    # Phân trang
    per_page = 20
    offset = (page - 1) * per_page
    
    # Lấy danh sách khách hàng
    customers = get_all_customers(
        search=search if search else None,
        status_filter=status_filter if status_filter else None,
        limit=per_page,
        offset=offset
    )
    
    # Đếm tổng số khách hàng
    total_customers = count_customers(
        search=search if search else None,
        status_filter=status_filter if status_filter else None
    )
    
    # Tính tổng số trang
    total_pages = (total_customers + per_page - 1) // per_page
    
    # Lấy thống kê
    stats = get_customer_stats()
    
    return render_template('admin/customers.html',
                         customers=customers,
                         stats=stats,
                         page=page,
                         total_pages=total_pages,
                         total_customers=total_customers,
                         search=search,
                         status_filter=status_filter)

@app.route('/admin/customers/<int:customer_id>')
@admin_required
def admin_customer_detail(customer_id):
    """Chi tiết khách hàng"""
    customer = get_customer_by_id(customer_id)
    
    if not customer:
        flash('Không tìm thấy khách hàng', 'error')
        return redirect(url_for('admin_customers'))
    
    # Lấy đơn hàng của khách hàng
    orders_query = "SELECT * FROM orders WHERE customer_id = %s ORDER BY created_at DESC"
    connection = get_db_connection()
    if connection:
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(orders_query, (customer_id,))
            customer_orders = cursor.fetchall()
        except:
            customer_orders = []
        finally:
            cursor.close()
            connection.close()
    else:
        customer_orders = []
    
    return render_template('admin/customer_detail.html',
                         customer=customer,
                         orders=customer_orders)

@app.route('/admin/customers/<int:customer_id>/edit', methods=['GET', 'POST'])
@admin_required
def admin_edit_customer(customer_id):
    """Chỉnh sửa thông tin khách hàng"""
    customer = get_customer_by_id(customer_id)
    
    if not customer:
        flash('Không tìm thấy khách hàng', 'error')
        return redirect(url_for('admin_customers'))
    
    if request.method == 'POST':
        data = {
            'full_name': request.form.get('full_name'),
            'phone': request.form.get('phone'),
            'address': request.form.get('address'),
            'is_active': request.form.get('is_active') == 'true'
        }
        
        result = update_customer_by_admin(customer_id, data)
        
        if result:
            flash('Cập nhật thông tin khách hàng thành công!', 'success')
            return redirect(url_for('admin_customer_detail', customer_id=customer_id))
        else:
            flash('Lỗi khi cập nhật thông tin khách hàng', 'error')
    
    return render_template('admin/customer_edit.html', customer=customer)

@app.route('/admin/customers/<int:customer_id>/toggle-status', methods=['POST'])
@admin_required
def admin_toggle_customer_status(customer_id):
    """Kích hoạt/Vô hiệu hóa khách hàng"""
    result = toggle_customer_status(customer_id)
    
    if result:
        flash('Đã cập nhật trạng thái khách hàng', 'success')
    else:
        flash('Lỗi khi cập nhật trạng thái', 'error')
    
    return redirect(url_for('admin_customers'))

@app.route('/admin/customers/<int:customer_id>/delete', methods=['POST'])
@admin_required
def admin_delete_customer(customer_id):
    """Xóa khách hàng"""
    customer = get_customer_by_id(customer_id)
    
    if not customer:
        flash('Không tìm thấy khách hàng', 'error')
        return redirect(url_for('admin_customers'))
    
    result = delete_customer(customer_id)
    
    if result:
        flash(f'Đã xóa khách hàng {customer["full_name"]}', 'success')
    else:
        flash('Lỗi khi xóa khách hàng', 'error')
    
    return redirect(url_for('admin_customers'))

# ============================================
# ADMIN ROUTES - NEW FEATURES MANAGEMENT
# ============================================

@app.route('/admin/reviews')
@admin_required
def admin_reviews():
    """Quản lý đánh giá sản phẩm"""
    page = request.args.get('page', 1, type=int)
    approved_filter = request.args.get('approved', '')
    
    per_page = 20
    offset = (page - 1) * per_page
    
    approved_only = None
    if approved_filter == 'true':
        approved_only = True
    elif approved_filter == 'false':
        approved_only = False
    
    reviews = get_all_reviews(approved_only=approved_only, limit=per_page, offset=offset)
    total_reviews = count_reviews(approved_only=approved_only)
    total_pages = (total_reviews + per_page - 1) // per_page
    
    stats = {
        'total': count_reviews(),
        'approved': count_reviews(approved_only=True),
        'pending': count_reviews(approved_only=False)
    }
    
    # Lấy thông tin sản phẩm cho mỗi review
    products_dict = {}
    for review in reviews:
        if review.get('product_id') and review['product_id'] not in products_dict:
            product = get_product_by_id(review['product_id'])
            if product:
                products_dict[review['product_id']] = product
    
    return render_template('admin/reviews.html',
                         reviews=reviews,
                         products_dict=products_dict,
                         stats=stats,
                         page=page,
                         total_pages=total_pages,
                         total_reviews=total_reviews,
                         approved_filter=approved_filter)

@app.route('/admin/reviews/<int:review_id>/approve', methods=['POST'])
@admin_required
def admin_approve_review(review_id):
    """Duyệt đánh giá"""
    result = update_review_status(review_id, True)
    if result:
        flash('Đã duyệt đánh giá', 'success')
    else:
        flash('Lỗi khi duyệt đánh giá', 'error')
    return redirect(url_for('admin_reviews'))

@app.route('/admin/reviews/<int:review_id>/reject', methods=['POST'])
@admin_required
def admin_reject_review(review_id):
    """Từ chối đánh giá"""
    result = update_review_status(review_id, False)
    if result:
        flash('Đã từ chối đánh giá', 'success')
    else:
        flash('Lỗi khi từ chối đánh giá', 'error')
    return redirect(url_for('admin_reviews'))

@app.route('/admin/reviews/<int:review_id>/delete', methods=['POST'])
@admin_required
def admin_delete_review(review_id):
    """Xóa đánh giá"""
    result = delete_review(review_id)
    if result:
        flash('Đã xóa đánh giá', 'success')
    else:
        flash('Lỗi khi xóa đánh giá', 'error')
    return redirect(url_for('admin_reviews'))

@app.route('/admin/coupons')
@admin_required
def admin_coupons():
    """Quản lý mã giảm giá"""
    page = request.args.get('page', 1, type=int)
    active_filter = request.args.get('active', '')
    
    per_page = 20
    offset = (page - 1) * per_page
    
    active_only = None
    if active_filter == 'true':
        active_only = True
    elif active_filter == 'false':
        active_only = False
    
    coupons = get_all_coupons(active_only=active_only, limit=per_page, offset=offset)
    total_coupons = count_coupons(active_only=active_only)
    total_pages = (total_coupons + per_page - 1) // per_page
    
    stats = {
        'total': count_coupons(),
        'active': count_coupons(active_only=True),
        'inactive': count_coupons(active_only=False)
    }
    
    return render_template('admin/coupons.html',
                         coupons=coupons,
                         stats=stats,
                         page=page,
                         total_pages=total_pages,
                         total_coupons=total_coupons,
                         active_filter=active_filter)

@app.route('/admin/coupons/add', methods=['GET', 'POST'])
@admin_required
def admin_add_coupon():
    """Thêm mã giảm giá mới"""
    if request.method == 'POST':
        try:
            # Parse datetime từ datetime-local input
            start_date_str = request.form.get('start_date')
            end_date_str = request.form.get('end_date')
            
            start_date = datetime.strptime(start_date_str, '%Y-%m-%dT%H:%M') if start_date_str else None
            end_date = datetime.strptime(end_date_str, '%Y-%m-%dT%H:%M') if end_date_str else None
            
            data = {
                'code': request.form.get('code'),
                'name': request.form.get('name'),
                'description': request.form.get('description'),
                'discount_type': request.form.get('discount_type'),
                'discount_value': float(request.form.get('discount_value', 0)),
                'min_order_amount': float(request.form.get('min_order_amount', 0)),
                'max_discount_amount': float(request.form.get('max_discount_amount', 0)) if request.form.get('max_discount_amount') else None,
                'usage_limit': int(request.form.get('usage_limit', 0)) if request.form.get('usage_limit') else None,
                'start_date': start_date,
                'end_date': end_date,
                'is_active': request.form.get('is_active') == 'true'
            }
            
            # Validate
            if not data['code'] or not data['name']:
                flash('Vui lòng điền đầy đủ mã và tên mã giảm giá', 'error')
            elif not data['discount_type']:
                flash('Vui lòng chọn loại giảm giá', 'error')
            elif data['discount_value'] <= 0:
                flash('Giá trị giảm giá phải lớn hơn 0', 'error')
            elif data['discount_type'] == 'percentage' and data['discount_value'] > 100:
                flash('Giảm giá theo phần trăm không được vượt quá 100%', 'error')
            elif start_date and end_date and start_date >= end_date:
                flash('Ngày kết thúc phải sau ngày bắt đầu', 'error')
            else:
                result = create_coupon(data)
                if result:
                    flash('Đã tạo mã giảm giá thành công!', 'success')
                    return redirect(url_for('admin_coupons'))
                else:
                    flash('Lỗi khi tạo mã giảm giá. Có thể mã đã tồn tại.', 'error')
        except ValueError as e:
            flash(f'Lỗi định dạng dữ liệu: {str(e)}', 'error')
        except Exception as e:
            flash(f'Lỗi không mong muốn: {str(e)}', 'error')
    
    return render_template('admin/coupon_form.html', coupon=None)

@app.route('/admin/coupons/<int:coupon_id>/edit', methods=['GET', 'POST'])
@admin_required
def admin_edit_coupon(coupon_id):
    """Chỉnh sửa mã giảm giá"""
    coupon = get_coupon_by_id(coupon_id)
    
    if not coupon:
        flash('Không tìm thấy mã giảm giá', 'error')
        return redirect(url_for('admin_coupons'))
    
    if request.method == 'POST':
        try:
            # Parse datetime từ datetime-local input
            start_date_str = request.form.get('start_date')
            end_date_str = request.form.get('end_date')
            
            start_date = datetime.strptime(start_date_str, '%Y-%m-%dT%H:%M') if start_date_str else None
            end_date = datetime.strptime(end_date_str, '%Y-%m-%dT%H:%M') if end_date_str else None
            
            data = {
                'name': request.form.get('name'),
                'description': request.form.get('description'),
                'discount_type': request.form.get('discount_type'),
                'discount_value': float(request.form.get('discount_value', 0)),
                'min_order_amount': float(request.form.get('min_order_amount', 0)),
                'max_discount_amount': float(request.form.get('max_discount_amount', 0)) if request.form.get('max_discount_amount') else None,
                'usage_limit': int(request.form.get('usage_limit', 0)) if request.form.get('usage_limit') else None,
                'start_date': start_date,
                'end_date': end_date,
                'is_active': request.form.get('is_active') == 'true'
            }
            
            # Validate
            if not data['name']:
                flash('Vui lòng điền tên mã giảm giá', 'error')
            elif not data['discount_type']:
                flash('Vui lòng chọn loại giảm giá', 'error')
            elif data['discount_value'] <= 0:
                flash('Giá trị giảm giá phải lớn hơn 0', 'error')
            elif data['discount_type'] == 'percentage' and data['discount_value'] > 100:
                flash('Giảm giá theo phần trăm không được vượt quá 100%', 'error')
            elif start_date and end_date and start_date >= end_date:
                flash('Ngày kết thúc phải sau ngày bắt đầu', 'error')
            else:
                result = update_coupon(coupon_id, data)
                if result:
                    flash('Đã cập nhật mã giảm giá thành công!', 'success')
                    return redirect(url_for('admin_coupons'))
                else:
                    flash('Lỗi khi cập nhật mã giảm giá', 'error')
        except ValueError as e:
            flash(f'Lỗi định dạng dữ liệu: {str(e)}', 'error')
        except Exception as e:
            flash(f'Lỗi không mong muốn: {str(e)}', 'error')
    
    return render_template('admin/coupon_form.html', coupon=coupon)

@app.route('/admin/coupons/<int:coupon_id>/delete', methods=['POST'])
@admin_required
def admin_delete_coupon(coupon_id):
    """Xóa mã giảm giá"""
    result = delete_coupon(coupon_id)
    if result:
        flash('Đã xóa mã giảm giá', 'success')
    else:
        flash('Lỗi khi xóa mã giảm giá', 'error')
    return redirect(url_for('admin_coupons'))

@app.route('/admin/notifications')
@admin_required
def admin_notifications():
    """Quản lý thông báo"""
    page = request.args.get('page', 1, type=int)
    unread_only = request.args.get('unread', '') == 'true'
    
    per_page = 20
    offset = (page - 1) * per_page
    
    notifications = get_all_notifications(user_type='customer', unread_only=unread_only, limit=per_page, offset=offset)
    total_notifications = count_notifications(user_type='customer', unread_only=unread_only)
    total_pages = (total_notifications + per_page - 1) // per_page
    
    stats = {
        'total': count_notifications(user_type='customer'),
        'unread': count_notifications(user_type='customer', unread_only=True)
    }
    
    return render_template('admin/notifications.html',
                         notifications=notifications,
                         stats=stats,
                         page=page,
                         total_pages=total_pages,
                         total_notifications=total_notifications,
                         unread_only=unread_only)

@app.route('/admin/payment-transactions')
@admin_required
def admin_payment_transactions():
    """Xem giao dịch thanh toán"""
    page = request.args.get('page', 1, type=int)
    status_filter = request.args.get('status', '')
    
    per_page = 20
    offset = (page - 1) * per_page
    
    transactions = get_all_payment_transactions(status=status_filter if status_filter else None, limit=per_page, offset=offset)
    total_transactions = count_payment_transactions(status=status_filter if status_filter else None)
    total_pages = (total_transactions + per_page - 1) // per_page
    
    stats = {
        'total': count_payment_transactions(),
        'pending': count_payment_transactions(status='pending'),
        'completed': count_payment_transactions(status='completed'),
        'failed': count_payment_transactions(status='failed')
    }
    
    return render_template('admin/payment_transactions.html',
                         transactions=transactions,
                         stats=stats,
                         page=page,
                         total_pages=total_pages,
                         total_transactions=total_transactions,
                         status_filter=status_filter)

@app.route('/admin/contacts')
@admin_required
def admin_contacts():
    """Quản lý tin nhắn liên hệ"""
    page = request.args.get('page', 1, type=int)
    status_filter = request.args.get('status', '')
    
    per_page = 20
    offset = (page - 1) * per_page
    
    contacts = get_all_contacts(status=status_filter if status_filter else None)
    total_contacts = len(contacts)
    
    # Phân trang
    start = (page - 1) * per_page
    end = start + per_page
    contacts_page = contacts[start:end]
    total_pages = (total_contacts + per_page - 1) // per_page
    
    stats = {
        'total': total_contacts,
        'new': len([c for c in contacts if c.get('status') == 'new']),
        'replied': len([c for c in contacts if c.get('replied') == True])
    }
    
    return render_template('admin/contacts.html',
                         contacts=contacts_page,
                         stats=stats,
                         page=page,
                         total_pages=total_pages,
                         total_contacts=total_contacts,
                         status_filter=status_filter)

@app.route('/admin/contacts/<int:contact_id>/mark-replied', methods=['POST'])
@admin_required
def admin_mark_contact_replied(contact_id):
    """Đánh dấu đã trả lời"""
    query = "UPDATE contacts SET replied = TRUE, status = 'replied' WHERE id = %s"
    result = execute_query(query, (contact_id,))
    
    if result:
        flash('Đã đánh dấu đã trả lời', 'success')
    else:
        flash('Lỗi khi cập nhật', 'error')
    
    return redirect(url_for('admin_contacts'))

@app.route('/admin/contacts/<int:contact_id>/delete', methods=['POST'])
@admin_required
def admin_delete_contact(contact_id):
    """Xóa tin nhắn liên hệ"""
    query = "DELETE FROM contacts WHERE id = %s"
    result = execute_query(query, (contact_id,))
    
    if result:
        flash('Đã xóa tin nhắn', 'success')
    else:
        flash('Lỗi khi xóa', 'error')
    
    return redirect(url_for('admin_contacts'))

# Route /usdt-payment đã được xử lý bởi web3_payment blueprint
# Không cần route riêng ở đây nữa

# ==================== NFT Metadata API (ERC-721) ====================
@app.route('/api/nft/metadata/<int:token_id>')
def nft_metadata(token_id):
    """Trả về metadata JSON cho NFT chứng nhận (ERC-721 compliant). ?chain_id=97 cho BSC Testnet"""
    try:
        chain_id = request.args.get('chain_id', 56, type=int)
        nft = get_nft_certificate_by_token_id(token_id, chain_id=chain_id)
        if not nft:
            return jsonify({'error': 'NFT not found'}), 404
        
        order = get_order_by_id(nft['order_id'])
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        # Lấy ảnh sản phẩm đầu tiên (nếu có)
        image_url = None
        items = order.get('items') or []
        if items and items[0].get('product_id'):
            product = get_product_by_id(items[0]['product_id'])
            if product and product.get('image'):
                base = request.url_root.rstrip('/')
                image_url = product['image'] if product['image'].startswith('http') else f"{base}{product['image']}"
        
        if not image_url:
            image_url = f"{request.url_root.rstrip('/')}/static/images/logo.png"
        
        site_name = get_setting('site_name', 'HOMESTEAD')
        product_names = [i.get('product_name') or i.get('name', '') for i in items[:5]]
        
        metadata = {
            'name': f'Furniture Certificate #{token_id}',
            'description': f'Chứng nhận sở hữu nội thất từ {site_name}. Đơn hàng #{nft["order_id"]}. Sản phẩm: {", ".join(product_names) or "Nội thất"}',
            'image': image_url,
            'external_url': url_for('order_success', order_id=nft['order_id'], _external=True),
            'attributes': [
                {'trait_type': 'Order ID', 'value': nft['order_id']},
                {'trait_type': 'Recipient', 'value': nft['recipient_address'][:10] + '...' + nft['recipient_address'][-8:]},
                {'trait_type': 'Total (VND)', 'value': f"{order.get('total', 0):,.0f}"},
                {'trait_type': 'Chain', 'value': 'BSC Testnet' if chain_id == 97 else 'BSC'}
            ]
        }
        
        return jsonify(metadata)
    except Exception as e:
        print(f"❌ NFT metadata error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/test-usdt-payment')
def test_usdt_payment():
    """Trang test thanh toán USDT"""
    return render_template('test-usdt-payment.html')

# ============================================
# ROUTES CHO CÁC CHỨC NĂNG MỚI
# ============================================

# ==================== Product Reviews Routes ====================
@app.route('/api/product/<int:product_id>/reviews', methods=['GET'])
def get_reviews(product_id):
    """Lấy đánh giá sản phẩm với filter và sort"""
    rating_filter = request.args.get('rating', type=int)
    sort_by = request.args.get('sort', 'newest')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    offset = (page - 1) * per_page
    
    reviews = get_product_reviews(
        product_id, 
        approved_only=True,
        rating_filter=rating_filter,
        sort_by=sort_by,
        limit=per_page,
        offset=offset
    )
    
    # Lấy tổng số reviews để tính pagination
    count_query = "SELECT COUNT(*) as total FROM product_reviews WHERE product_id = %s AND is_approved = TRUE"
    if rating_filter:
        count_query += " AND rating = %s"
        total = execute_query(count_query, (product_id, rating_filter), fetch=True, fetch_one=True)
    else:
        total = execute_query(count_query, (product_id,), fetch=True, fetch_one=True)
    
    total_reviews = total['total'] if total else 0
    total_pages = (total_reviews + per_page - 1) // per_page
    
    return jsonify({
        'success': True, 
        'reviews': reviews,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total_reviews,
            'total_pages': total_pages
        }
    })

@app.route('/api/product/<int:product_id>/reviews/stats', methods=['GET'])
def get_review_stats(product_id):
    """Lấy thống kê rating"""
    stats = get_review_rating_stats(product_id)
    return jsonify({'success': True, 'stats': stats})

@app.route('/api/review/<int:review_id>/helpful', methods=['POST'])
def mark_review_helpful_route(review_id):
    """Đánh dấu đánh giá là hữu ích"""
    result = mark_review_helpful(review_id)
    if result:
        review = get_review_by_id(review_id)
        return jsonify({
            'success': True,
            'helpful_count': review.get('helpful_count', 0) if review else 0
        })
    return jsonify({'success': False, 'message': 'Có lỗi xảy ra'}), 400

@app.route('/api/product/<int:product_id>/review', methods=['POST'])
@login_required
def add_review(product_id):
    """Thêm đánh giá sản phẩm"""
    if 'customer_id' not in session:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    customer = get_customer_by_id(session['customer_id'])
    if not customer:
        return jsonify({'success': False, 'message': 'Không tìm thấy thông tin khách hàng'}), 401
    
    # Kiểm tra xem khách hàng đã đánh giá sản phẩm này chưa
    existing_review_query = "SELECT id FROM product_reviews WHERE product_id = %s AND customer_id = %s"
    existing = execute_query(existing_review_query, (product_id, customer['id']), fetch=True, fetch_one=True)
    if existing:
        return jsonify({'success': False, 'message': 'Bạn đã đánh giá sản phẩm này rồi'}), 400
    
    # Kiểm tra xem khách hàng đã mua sản phẩm này chưa
    purchase_query = """
        SELECT COUNT(*) as count FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        WHERE o.customer_id = %s AND oi.product_id = %s AND o.payment_status = 'paid'
    """
    purchase_result = execute_query(purchase_query, (customer['id'], product_id), fetch=True, fetch_one=True)
    has_purchased = purchase_result and purchase_result.get('count', 0) > 0
    
    data = request.json
    review_data = {
        'product_id': product_id,
        'customer_id': customer['id'],
        'customer_name': customer['full_name'],
        'rating': data.get('rating', 5),
        'title': data.get('title', ''),
        'comment': data.get('comment', ''),
        'images': data.get('images', []),
        'is_verified_purchase': has_purchased or data.get('is_verified_purchase', False)
    }
    
    review_id = create_product_review(review_data)
    if review_id:
        return jsonify({'success': True, 'message': 'Đánh giá đã được gửi. Cảm ơn bạn!'})
    return jsonify({'success': False, 'message': 'Có lỗi xảy ra'}), 400

# ==================== Wishlist Routes ====================
@app.route('/api/wishlist', methods=['GET'])
@login_required
def get_wishlist_route():
    """Lấy danh sách wishlist"""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    wishlist = get_wishlist(customer['id'])
    return jsonify({'success': True, 'wishlist': wishlist})

@app.route('/api/wishlist/add/<int:product_id>', methods=['POST'])
@login_required
def add_to_wishlist_route(product_id):
    """Thêm vào wishlist"""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    result = add_to_wishlist(customer['id'], product_id)
    if result:
        return jsonify({'success': True, 'message': 'Đã thêm vào yêu thích'})
    return jsonify({'success': False, 'message': 'Có lỗi xảy ra'}), 400

@app.route('/api/wishlist/remove/<int:product_id>', methods=['POST'])
@login_required
def remove_from_wishlist_route(product_id):
    """Xóa khỏi wishlist"""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    result = remove_from_wishlist(customer['id'], product_id)
    if result:
        return jsonify({'success': True, 'message': 'Đã xóa khỏi yêu thích'})
    return jsonify({'success': False, 'message': 'Có lỗi xảy ra'}), 400

@app.route('/api/wishlist/check/<int:product_id>', methods=['GET'])
@login_required
def check_wishlist_route(product_id):
    """Kiểm tra sản phẩm có trong wishlist không"""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'in_wishlist': False})
    
    in_wishlist = is_in_wishlist(customer['id'], product_id)
    return jsonify({'success': True, 'in_wishlist': in_wishlist})

# ==================== Coupon Routes ====================
@app.route('/api/coupon/validate', methods=['POST'])
def validate_coupon_route():
    """Kiểm tra và áp dụng coupon"""
    try:
        data = request.json
        if not data:
            return jsonify({'valid': False, 'message': 'Dữ liệu không hợp lệ'}), 400
        
        code = data.get('code', '').strip().upper()
        order_amount = float(data.get('order_amount', 0))
        
        if not code:
            return jsonify({'valid': False, 'message': 'Vui lòng nhập mã giảm giá'}), 400
        
        if order_amount <= 0:
            return jsonify({'valid': False, 'message': 'Tổng tiền đơn hàng không hợp lệ'}), 400
        
        customer_id = None
        if 'customer_email' in session:
            customer = get_customer_by_email(session.get('customer_email'))
            if customer:
                customer_id = customer['id']
        
        result = apply_coupon(code, order_amount)
        
        # Đảm bảo tất cả giá trị là JSON serializable
        if result.get('valid'):
            result['discount'] = float(result['discount'])
            result['final_amount'] = float(result['final_amount'])
            
            # Convert coupon object to dict và serialize các giá trị
            if 'coupon' in result:
                coupon = result['coupon']
                coupon_dict = {}
                for key, value in coupon.items():
                    if value is None:
                        coupon_dict[key] = None
                    elif isinstance(value, (int, float, str, bool)):
                        coupon_dict[key] = value
                    elif hasattr(value, 'isoformat'):  # datetime
                        coupon_dict[key] = value.isoformat()
                    elif hasattr(value, '__float__'):  # Decimal
                        try:
                            coupon_dict[key] = float(value)
                        except:
                            coupon_dict[key] = str(value)
                    else:
                        coupon_dict[key] = str(value)
                result['coupon'] = coupon_dict
        
        return jsonify(result)
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in validate_coupon_route: {e}")
        print(f"Traceback: {error_trace}")
        return jsonify({'valid': False, 'message': f'Lỗi: {str(e)}'}), 500

# ==================== Shipping Address Routes ====================
@app.route('/api/shipping-addresses', methods=['GET'])
@login_required
def get_shipping_addresses_route():
    """Lấy danh sách địa chỉ giao hàng"""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    addresses = get_shipping_addresses(customer['id'])
    return jsonify({'success': True, 'addresses': addresses})

@app.route('/api/shipping-address', methods=['POST'])
@login_required
def create_shipping_address_route():
    """Tạo địa chỉ giao hàng mới"""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    data = request.json
    address_id = create_shipping_address(customer['id'], data)
    if address_id:
        return jsonify({'success': True, 'message': 'Đã thêm địa chỉ', 'address_id': address_id})
    return jsonify({'success': False, 'message': 'Có lỗi xảy ra'}), 400

@app.route('/api/shipping-address/<int:address_id>', methods=['PUT', 'DELETE'])
@login_required
def manage_shipping_address_route(address_id):
    """Cập nhật hoặc xóa địa chỉ"""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    if request.method == 'PUT':
        data = request.json
        result = update_shipping_address(address_id, customer['id'], data)
        if result:
            return jsonify({'success': True, 'message': 'Đã cập nhật địa chỉ'})
        return jsonify({'success': False, 'message': 'Có lỗi xảy ra'}), 400
    else:  # DELETE
        result = delete_shipping_address(address_id, customer['id'])
        if result:
            return jsonify({'success': True, 'message': 'Đã xóa địa chỉ'})
        return jsonify({'success': False, 'message': 'Có lỗi xảy ra'}), 400

# ==================== Notification Routes ====================
@app.route('/api/notifications', methods=['GET'])
def get_notifications_route():
    """Lấy danh sách thông báo"""
    # Kiểm tra đăng nhập
    if not session.get('customer_logged_in') or not session.get('customer_id'):
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    customer_id = session.get('customer_id')
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    limit = request.args.get('limit', type=int)
    
    notifications = get_notifications(customer_id, 'customer', unread_only, limit)
    unread_count = count_unread_notifications(customer_id, 'customer')
    
    return jsonify({
        'success': True,
        'notifications': notifications,
        'unread_count': unread_count
    })

@app.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read_route(notification_id):
    """Đánh dấu thông báo đã đọc"""
    if not session.get('customer_logged_in') or not session.get('customer_id'):
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    customer_id = session.get('customer_id')
    result = mark_notification_read(notification_id, customer_id)
    if result:
        return jsonify({'success': True, 'message': 'Đã đánh dấu đã đọc'})
    return jsonify({'success': False, 'message': 'Có lỗi xảy ra'}), 400

@app.route('/api/notifications/read-all', methods=['POST'])
def mark_all_notifications_read_route():
    """Đánh dấu tất cả thông báo đã đọc"""
    if not session.get('customer_logged_in') or not session.get('customer_id'):
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    customer_id = session.get('customer_id')
    result = mark_all_notifications_read(customer_id, 'customer')
    if result:
        return jsonify({'success': True, 'message': 'Đã đánh dấu tất cả đã đọc'})
    return jsonify({'success': False, 'message': 'Có lỗi xảy ra'}), 400

# ==================== Cart Items Routes (Persistent Cart) ====================
@app.route('/api/cart/sync', methods=['POST'])
@login_required
def sync_cart_route():
    """Đồng bộ giỏ hàng từ session sang database"""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    # Lấy giỏ hàng từ session
    session_cart = session.get('cart', [])
    
    # Thêm vào database
    for item in session_cart:
        add_to_cart(customer['id'], item['product_id'], item['quantity'])
    
    # Xóa giỏ hàng session
    session['cart'] = []
    
    return jsonify({'success': True, 'message': 'Đã đồng bộ giỏ hàng'})

@app.route('/api/cart/load', methods=['GET'])
@login_required
def load_cart_route():
    """Tải giỏ hàng từ database vào session"""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    cart_items = get_cart_items(customer['id'])
    
    # Chuyển đổi sang format session
    session_cart = []
    for item in cart_items:
        if item.get('is_active'):
            session_cart.append({
                'product_id': item['product_id'],
                'name': item['name'],
                'price': float(item['price']),
                'image': item['image'],
                'quantity': item['quantity']
            })
    
    session['cart'] = session_cart
    return jsonify({'success': True, 'cart': session_cart})

# ==================== Order Status History Route ====================
@app.route('/api/order/<order_id>/history', methods=['GET'])
def get_order_history_route(order_id):
    """Lấy lịch sử thay đổi trạng thái đơn hàng"""
    history = get_order_status_history(order_id)
    return jsonify({
        'success': True,
        'history': history
    })

# ==================== Chatbot Routes ====================
@app.route('/api/chatbot-message', methods=['POST'])
def save_chatbot_message():
    """Lưu tin nhắn từ chatbot"""
    try:
        data = request.get_json()
        message = data.get('message', '').strip()
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        if not message:
            return jsonify({'success': False, 'error': 'Message is required'}), 400
        
        # Lưu vào database như một contact message
        contact_data = {
            'name': session.get('customer_name', 'Khách hàng'),
            'email': session.get('customer_email', 'chatbot@example.com'),
            'phone': session.get('customer_phone', ''),
            'subject': 'Tin nhắn từ Chatbot',
            'message': f'[Chatbot] {message}\n\nThời gian: {timestamp}'
        }
        
        # Lưu vào database
        result = create_contact(contact_data)
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Tin nhắn đã được lưu'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Không thể lưu tin nhắn'
            }), 500
            
    except Exception as e:
        print(f"Error saving chatbot message: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
@login_required
def get_order_history_route(order_id):
    """Lấy lịch sử thay đổi trạng thái đơn hàng"""
    customer = get_customer_by_email(session.get('customer_email'))
    if not customer:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập'}), 401
    
    # Kiểm tra đơn hàng thuộc về khách hàng
    order = get_order_by_id(order_id)
    if not order:
        return jsonify({'success': False, 'message': 'Không tìm thấy đơn hàng'}), 404
    
    if order.get('customer_id') != customer['id']:
        return jsonify({'success': False, 'message': 'Không có quyền truy cập'}), 403
    
    history = get_order_status_history(order_id)
    return jsonify({'success': True, 'history': history})

@app.route('/test-responsive')
def test_responsive():
    """Trang test responsive cho landing page"""
    return render_template('test_responsive.html')

@app.route('/test-all-responsive')
def test_all_responsive():
    """Trang test responsive cho tất cả các trang"""
    return render_template('test_all_responsive.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)