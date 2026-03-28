# Hướng Dẫn Cấu Hình PayPal

## Bước 1: Tạo tài khoản PayPal Developer

1. Truy cập [PayPal Developer](https://developer.paypal.com/)
2. Đăng nhập bằng tài khoản PayPal của bạn
3. Vào **Dashboard** → **My Apps & Credentials**

## Bước 2: Lấy Client ID và Secret

### Chế độ Sandbox (Test)
1. Chọn tab **Sandbox**
2. Click **Create App**
3. Đặt tên app (ví dụ: "Furniture Store")
4. Sau khi tạo, bạn sẽ thấy:
   - **Client ID**: Copy và lưu lại
   - **Secret**: Click **Show** để xem và copy

### Chế độ Live (Production)
1. Chọn tab **Live**
2. Tạo app tương tự
3. Lấy Client ID và Secret từ Live app

## Bước 3: Cấu hình trong Admin

1. Đăng nhập Admin: `/admin/login`
2. Vào **Cài Đặt** → tab **Thanh Toán**
3. Điền thông tin PayPal:
   - **Client ID**: Dán Client ID từ PayPal
   - **Client Secret**: Dán Secret từ PayPal
   - **Chế độ Sandbox**: Bật để test, tắt khi chạy thật

## Bước 4: Test thanh toán

1. Với Sandbox, dùng tài khoản test tại [PayPal Sandbox](https://developer.paypal.com/developer/accounts/)
2. Tạo tài khoản Personal (buyer) để test thanh toán
3. Thêm sản phẩm vào giỏ → Checkout → Chọn PayPal
4. Đăng nhập bằng tài khoản Sandbox và hoàn tất thanh toán

## Lưu ý

- **VND**: PayPal không hỗ trợ VND trực tiếp. Hệ thống tự động quy đổi sang USD theo tỷ giá thị trường (API open.er-api.com). Admin có thể cố định tỷ giá trong Settings > PayPal > Tỷ giá VND/USD.
- **Sandbox**: Luôn test với Sandbox trước khi chuyển Live
- **Production**: Khi sẵn sàng, tắt Sandbox và dùng Live credentials
