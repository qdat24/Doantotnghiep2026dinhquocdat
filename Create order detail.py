"""
Script tự động tạo file order_detail.html vào đúng vị trí
Chạy script này trong thư mục furniture-store-dynamic
"""
import os

# Nội dung file order_detail.html
TEMPLATE_CONTENT = '''{% extends "base.html" %}

{% block title %}Chi Tiết Đơn Hàng {{ order.order_id }} - Nội Thất ABC{% endblock %}

{% block content %}
<!-- Page Header -->
<section style="background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); color: white; padding: 40px 0; text-align: center;">
    <div class="container">
        <h1 style="font-size: 2rem; margin-bottom: 0.5rem;">
            <i class="fas fa-receipt"></i> Chi Tiết Đơn Hàng
        </h1>
        <p>Mã đơn hàng: <strong>#{{ order.order_id }}</strong></p>
    </div>
</section>

<section style="padding: 60px 0; background: #f8f9fa;">
    <div class="container">
        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                {% for category, message in messages %}
                    <div class="alert alert-{{ category }}" style="margin-bottom: 20px;">
                        <i class="fas fa-{{ 'check-circle' if category == 'success' else 'exclamation-circle' }}"></i>
                        {{ message }}
                    </div>
                {% endfor %}
            {% endif %}
        {% endwith %}

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px;">
            <!-- Chi tiết đơn hàng -->
            <div>
                <!-- Thông tin giao hàng -->
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
                    <h2 style="color: #2c3e50; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-shipping-fast"></i> Thông Tin Giao Hàng
                    </h2>
                    <table style="width: 100%; line-height: 2;">
                        <tr>
                            <td style="font-weight: 600; width: 180px;">Người nhận:</td>
                            <td>{{ order.customer_name }}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600;">Số điện thoại:</td>
                            <td>{{ order.phone }}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600;">Email:</td>
                            <td>{{ order.email if order.email else 'Không có' }}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600;">Địa chỉ:</td>
                            <td>{{ order.address }}</td>
                        </tr>
                        {% if order.note %}
                        <tr>
                            <td style="font-weight: 600; vertical-align: top;">Ghi chú:</td>
                            <td>{{ order.note }}</td>
                        </tr>
                        {% endif %}
                    </table>
                </div>

                <!-- Sản phẩm -->
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #2c3e50; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-shopping-bag"></i> Sản Phẩm Đã Đặt
                    </h2>
                    
                    {% for item in order['items'] %}
                    <div style="display: flex; gap: 20px; padding: 20px 0; border-bottom: 1px solid #e0e0e0;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 10px 0; font-size: 1.1rem;">{{ item.product_name }}</h3>
                            <div style="color: #7f8c8d; margin-bottom: 5px;">
                                Đơn giá: <strong>{{ "{:,.0f}".format(item.price) }} ₫</strong>
                            </div>
                            <div style="color: #7f8c8d;">
                                Số lượng: <strong>{{ item.quantity }}</strong>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.2rem; font-weight: 600; color: #e74c3c;">
                                {{ "{:,.0f}".format(item.subtotal) }} ₫
                            </div>
                        </div>
                    </div>
                    {% endfor %}

                    <!-- Tổng cộng -->
                    <div style="padding: 20px 0; border-bottom: 1px solid #e0e0e0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Tạm tính:</span>
                            <span style="font-weight: 600;">{{ "{:,.0f}".format(order.subtotal) }} ₫</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Phí vận chuyển:</span>
                            <span style="font-weight: 600;">
                                {% if order.shipping_fee == 0 %}
                                    <span style="color: #27ae60;">Miễn phí</span>
                                {% else %}
                                    {{ "{:,.0f}".format(order.shipping_fee) }} ₫
                                {% endif %}
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 20px 0; font-size: 1.3rem;">
                        <span style="font-weight: 600;">Tổng cộng:</span>
                        <span style="font-weight: 700; color: #e74c3c;">{{ "{:,.0f}".format(order.total) }} ₫</span>
                    </div>
                </div>
            </div>

            <!-- Thông tin đơn hàng -->
            <div>
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); position: sticky; top: 100px;">
                    <h2 style="color: #2c3e50; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-info-circle"></i> Trạng Thái Đơn Hàng
                    </h2>
                    
                    <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0;">
                        <div style="font-weight: 600; margin-bottom: 5px;">Ngày đặt hàng:</div>
                        <div style="color: #7f8c8d;">{{ order.created_at.strftime('%d/%m/%Y %H:%M:%S') if order.created_at else 'N/A' }}</div>
                    </div>

                    <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0;">
                        <div style="font-weight: 600; margin-bottom: 5px;">Phương thức thanh toán:</div>
                        <div style="color: #7f8c8d;">
                            {% if order.payment_method == 'cod' %}
                                💵 Thanh toán khi nhận hàng (COD)
                            {% elif order.payment_method == 'bank_transfer' %}
                                🏦 Chuyển khoản ngân hàng
                            {% elif order.payment_method == 'credit_card' %}
                                💳 Thẻ tín dụng
                            {% else %}
                                {{ order.payment_method }}
                            {% endif %}
                        </div>
                    </div>

                    <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0;">
                        <div style="font-weight: 600; margin-bottom: 10px;">Trạng thái đơn hàng:</div>
                        <div style="padding: 15px; border-radius: 8px; text-align: center; font-weight: 600; font-size: 1.1rem;
                            {% if order.status == 'pending' %}background: #fff3cd; color: #856404;
                            {% elif order.status == 'confirmed' %}background: #d1ecf1; color: #0c5460;
                            {% elif order.status == 'shipping' %}background: #e2d9f3; color: #5a3d7e;
                            {% elif order.status == 'completed' %}background: #d4edda; color: #155724;
                            {% elif order.status == 'cancelled' %}background: #f8d7da; color: #721c24;
                            {% endif %}">
                            {% if order.status == 'pending' %}
                                ⏳ Chờ xử lý
                            {% elif order.status == 'confirmed' %}
                                ✓ Đã xác nhận
                            {% elif order.status == 'shipping' %}
                                🚚 Đang giao hàng
                            {% elif order.status == 'completed' %}
                                ✓ Hoàn thành
                            {% elif order.status == 'cancelled' %}
                                ✗ Đã hủy
                            {% else %}
                                {{ order.status }}
                            {% endif %}
                        </div>
                    </div>

                    <div style="margin-bottom: 25px;">
                        <div style="font-weight: 600; margin-bottom: 10px;">Trạng thái thanh toán:</div>
                        <div style="padding: 12px; border-radius: 8px; text-align: center; font-weight: 600;
                            {% if order.payment_status == 'pending' %}background: #fff3cd; color: #856404;
                            {% elif order.payment_status == 'paid' %}background: #d4edda; color: #155724;
                            {% endif %}">
                            {% if order.payment_status == 'pending' %}
                                ⏳ Chưa thanh toán
                            {% elif order.payment_status == 'paid' %}
                                ✓ Đã thanh toán
                            {% else %}
                                {{ order.payment_status }}
                            {% endif %}
                        </div>
                    </div>

                    <!-- Nút hành động -->
                    {% if order.status == 'pending' %}
                    <form method="POST" action="{{ url_for('customer_cancel_order', order_id=order.order_id) }}" 
                          onsubmit="return confirm('Bạn có chắc muốn hủy đơn hàng này?')">
                        <button type="submit" class="btn" style="width: 100%; background: #e74c3c; color: white; padding: 15px; font-size: 1.1rem; margin-bottom: 10px;">
                            <i class="fas fa-times-circle"></i> Hủy Đơn Hàng
                        </button>
                    </form>
                    {% endif %}

                    <a href="{{ url_for('customer_account') }}" class="btn btn-primary" style="width: 100%; text-align: center; padding: 12px;">
                        <i class="fas fa-arrow-left"></i> Quay Lại Tài Khoản
                    </a>
                </div>
            </div>
        </div>
    </div>
</section>
{% endblock %}
'''

def create_template_file():
    """Tạo file order_detail.html"""
    # Đường dẫn đến thư mục customer
    customer_dir = os.path.join('templates', 'customer')
    
    # Tạo thư mục nếu chưa có
    os.makedirs(customer_dir, exist_ok=True)
    
    # Đường dẫn file
    file_path = os.path.join(customer_dir, 'order_detail.html')
    
    # Ghi nội dung vào file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(TEMPLATE_CONTENT)
    
    print(f"✅ Đã tạo file thành công: {file_path}")
    print(f"✅ Đường dẫn đầy đủ: {os.path.abspath(file_path)}")
    
    # Kiểm tra file đã tồn tại
    if os.path.exists(file_path):
        file_size = os.path.getsize(file_path)
        print(f"✅ File tồn tại với kích thước: {file_size} bytes")
        return True
    else:
        print("❌ Lỗi: File không được tạo!")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("SCRIPT TẠO FILE ORDER_DETAIL.HTML")
    print("=" * 60)
    print()
    
    # Kiểm tra đang ở đúng thư mục
    if not os.path.exists('templates'):
        print("❌ LỖI: Không tìm thấy thư mục 'templates'")
        print("❌ Hãy chạy script này trong thư mục furniture-store-dynamic")
        print()
        print("Ví dụ:")
        print("cd C:\\Users\\Windows\\Downloads\\furniture-store-upgraded\\furniture-store-dynamic")
        print("python create_order_detail.py")
        input("\nẤn Enter để thoát...")
        exit(1)
    
    # Tạo file
    success = create_template_file()
    
    print()
    print("=" * 60)
    if success:
        print("✅ HOÀN TẤT! Bây giờ khởi động lại server:")
        print("   1. Dừng server (Ctrl+C)")
        print("   2. Chạy lại: python app.py")
    else:
        print("❌ Có lỗi xảy ra! Vui lòng thử lại hoặc tạo file thủ công.")
    print("=" * 60)
    
    input("\nẤn Enter để thoát...")