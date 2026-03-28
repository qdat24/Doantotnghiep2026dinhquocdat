-- Tạo database
CREATE DATABASE IF NOT EXISTS furniture_store CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE furniture_store;

-- Bảng danh mục sản phẩm
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng sản phẩm
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    original_price DECIMAL(12, 2),
    image VARCHAR(500),
    description TEXT,
    features TEXT,
    rating DECIMAL(2, 1) DEFAULT 5.0,
    reviews INT DEFAULT 0,
    stock INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng khách hàng
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng đơn hàng
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT NULL,
    customer_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address TEXT NOT NULL,
    note TEXT,
    payment_method VARCHAR(50) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    shipping_fee DECIMAL(12, 2) DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_customer_id (customer_id),
    INDEX idx_order_id (order_id),
    INDEX idx_status (status),
    INDEX idx_payment_status (payment_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng chi tiết đơn hàng
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    quantity INT NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm dữ liệu mẫu cho danh mục
INSERT INTO categories (name, description) VALUES
('Phòng Khách', 'Nội thất phòng khách sang trọng, hiện đại'),
('Phòng Ngủ', 'Nội thất phòng ngủ ấm cúng, tiện nghi'),
('Phòng Ăn', 'Nội thất phòng ăn đẹp mắt, tiện dụng'),
('Văn Phòng', 'Nội thất văn phòng chuyên nghiệp'),
('Nhà Bếp', 'Nội thất nhà bếp hiện đại, tiện lợi');

-- Thêm admin mặc định (username: admin, password: admin123)
-- Mật khẩu được mã hóa bằng bcrypt
INSERT INTO admin_users (username, password, full_name, email) VALUES
('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYNq.4OdFG6', 'Administrator', 'admin@furniture.com');

-- Thêm dữ liệu sản phẩm mẫu
INSERT INTO products (name, category, price, original_price, image, description, features, rating, reviews) VALUES
('Ghế Sofa Hiện Đại', 'Phòng Khách', 15000000, 18000000, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800', 
 'Ghế sofa cao cấp với chất liệu vải nhung mềm mại, thiết kế hiện đại phù hợp mọi không gian.',
 'Chất liệu vải nhung cao cấp|Khung gỗ chắc chắn|Đệm mút êm ái|Bảo hành 2 năm', 4.8, 124),

('Bàn Làm Việc Gỗ Sồi', 'Văn Phòng', 8500000, 10000000, 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800',
 'Bàn làm việc gỗ sồi tự nhiên, thiết kế tối giản, sang trọng với nhiều ngăn kéo tiện dụng.',
 'Gỗ sồi tự nhiên 100%|Thiết kế tối giản|3 ngăn kéo rộng rãi|Chống trầy xước', 4.9, 89),

('Giường Ngủ Bọc Da', 'Phòng Ngủ', 22000000, 25000000, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800',
 'Giường ngủ bọc da cao cấp với đầu giường êm ái, mang lại sự thoải mái tối đa.',
 'Da PU cao cấp|Đầu giường có đệm|Kích thước 1.8m x 2m|Bền bỉ theo thời gian', 4.7, 156),

('Tủ Bếp Hiện Đại', 'Nhà Bếp', 35000000, 40000000, 'https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=800',
 'Tủ bếp thiết kế hiện đại với chất liệu gỗ công nghiệp cao cấp chống ẩm.',
 'Gỗ công nghiệp chống ẩm|Phụ kiện cao cấp|Thiết kế tối ưu|Lắp đặt miễn phí', 4.9, 78),

('Kệ Sách Gỗ Trang Trí', 'Phòng Khách', 6500000, 8000000, 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=800',
 'Kệ sách đa năng với thiết kế độc đáo, vừa để sách vừa trang trí không gian.',
 'Gỗ công nghiệp MDF|5 tầng rộng rãi|Thiết kế hiện đại|Dễ lắp đặt', 4.6, 92),

('Ghế Ăn Bọc Vải', 'Phòng Ăn', 2500000, 3000000, 'https://images.unsplash.com/photo-1503602642458-232111445657?w=800',
 'Ghế ăn êm ái với chân gỗ chắc chắn, phù hợp mọi phong cách nội thất.',
 'Vải bọc cao cấp|Chân gỗ bền chắc|Thiết kế ergonomic|Bộ 4 ghế', 4.7, 145),

('Tủ Quần Áo Cửa Lùa', 'Phòng Ngủ', 18000000, 21000000, 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800',
 'Tủ quần áo hiện đại với cửa lùa tiết kiệm không gian, nhiều ngăn chia khoa học.',
 'Cửa lùa êm ái|Gương soi toàn thân|Nhiều ngăn chia|Chống ẩm mốc', 4.8, 67),

('Bàn Ăn 6 Chỗ', 'Phòng Ăn', 12000000, 14000000, 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800',
 'Bàn ăn mặt đá sang trọng, chắc chắn dành cho gia đình 6 người.',
 'Mặt đá nhân tạo|Chân inox cao cấp|Kích thước 1.6m x 0.9m|Dễ vệ sinh', 4.9, 103),

('Ghế Sofa Góc L', 'Phòng Khách', 28000000, 32000000, 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800',
 'Sofa góc L rộng rãi, sang trọng, phù hợp phòng khách lớn.',
 'Thiết kế góc L|Chất liệu da cao cấp|Chỗ ngồi rộng|Khung gỗ chắc chắn', 4.9, 87),

('Bàn Trà Mặt Kính', 'Phòng Khách', 4500000, 5500000, 'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800',
 'Bàn trà hiện đại với mặt kính cường lực, chân inox sang trọng.',
 'Kính cường lực 10mm|Chân inox mạ chrome|Dễ vệ sinh|Thiết kế tối giản', 4.6, 95),

('Tủ Giày Thông Minh', 'Phòng Khách', 3200000, 4000000, 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800',
 'Tủ giày đa năng với nhiều ngăn, thiết kế thông minh tiết kiệm không gian.',
 '8-10 đôi giày|Có ghế ngồi|Chống ẩm mốc|Dễ lắp đặt', 4.5, 112),

('Ghế Gaming Pro', 'Văn Phòng', 5800000, 7000000, 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800',
 'Ghế gaming cao cấp với tựa lưng điều chỉnh, gác chân tiện lợi.',
 'Tựa lưng 180 độ|Gác chân co giãn|Đệm memory foam|Trục D5 chịu lực 200kg', 4.8, 143),

('Bàn Học Cho Bé', 'Phòng Ngủ', 3500000, 4200000, 'https://images.unsplash.com/photo-1611269154421-4e27233ac5c7?w=800',
 'Bàn học ergonomic cho trẻ em, điều chỉnh độ cao, bảo vệ cột sống.',
 'Điều chỉnh độ cao|Mặt bàn nghiêng|Chống gù lưng|Màu sắc tươi sáng', 4.7, 128),

('Giường Tầng Gỗ Thông', 'Phòng Ngủ', 12000000, 14500000, 'https://images.unsplash.com/photo-1595428773665-69b0566f97bb?w=800',
 'Giường tầng chắc chắn cho 2 bé, gỗ thông tự nhiên an toàn.',
 'Gỗ thông tự nhiên|Thanh chắn an toàn|Thang leo vững chắc|Sơn water-based', 4.8, 76),

('Tủ Đầu Giường Hiện Đại', 'Phòng Ngủ', 2800000, 3500000, 'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=800',
 'Tủ đầu giường nhỏ gọn với 2 ngăn kéo, thiết kế sang trọng.',
 '2 ngăn kéo rộng|Ray trượt êm ái|Mặt gỗ veneer|Chống trầy xước', 4.6, 134),

('Ghế Xoay Văn Phòng', 'Văn Phòng', 2200000, 2800000, 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=800',
 'Ghế xoay lưng lưới thoáng mát, phù hợp làm việc lâu dài.',
 'Lưng lưới thoáng|Tay vịn điều chỉnh|Bánh xe êm|Nâng hạ khí nén', 4.5, 167),

('Kệ Tivi Gỗ Tự Nhiên', 'Phòng Khách', 8900000, 10500000, 'https://images.unsplash.com/photo-1591290619762-539b1838ad70?w=800',
 'Kệ tivi gỗ sồi tự nhiên với nhiều ngăn chứa đồ tiện lợi.',
 'Gỗ sồi tự nhiên|Nhiều ngăn chứa|Dài 1.8m|Chịu lực tốt', 4.8, 91),

('Bàn Ăn Thông Minh', 'Phòng Ăn', 15000000, 18000000, 'https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=800',
 'Bàn ăn mở rộng thông minh, từ 4 chỗ thành 8 chỗ.',
 'Mở rộng linh hoạt|Cơ chế trơn tru|Mặt gỗ veneer|Tiết kiệm không gian', 4.9, 121),

('Tủ Rượu Gỗ Tự Nhiên', 'Phòng Khách', 12500000, 15000000, 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800',
 'Tủ rượu cao cấp với cửa kính, lưu trữ và trưng bày đẹp mắt.',
 'Gỗ tự nhiên cao cấp|Cửa kính chắc chắn|Nhiều ngăn|Thiết kế sang trọng', 4.7, 54),

('Ghế Thư Giãn Bọc Da', 'Phòng Khách', 9800000, 12000000, 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800',
 'Ghế thư giãn ergonomic, điều chỉnh được góc ngả thoải mái.',
 'Da PU cao cấp|Điều chỉnh góc ngả|Gác chân tích hợp|Khung thép chắc chắn', 4.8, 98);
DELETE FROM admin_users WHERE username = 'admin';
INSERT INTO admin_users (username, password, full_name, email) 
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYNq.4OdFG6', 'Administrator', 'admin@furniture.com');
SELECT * FROM admin_users WHERE username = 'admin';
-- Xóa admin cũ
DELETE FROM furniture_store.admin_users WHERE username = 'admin';

-- Tạo admin mới với password đã được hash sẵn
INSERT INTO furniture_store.admin_users 
(username, password, full_name, email, is_active, created_at, updated_at)
VALUES (
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYNq.4OdFG6',
    'Administrator',
    'admin@furniture.com',
    1,
    NOW(),
    NOW()
);

-- Kiểm tra
SELECT * FROM furniture_store.admin_users WHERE username = 'admin';
USE furniture_store;
SELECT * FROM products;
INSERT INTO site_settings (setting_key, setting_value, description) VALUES
('contact_facebook', 'https://facebook.com/yourpage', 'Link Facebook'),
('contact_zalo', '0901234567', 'Số Zalo'),
('contact_whatsapp', '84901234567', 'Số WhatsApp');
USE furniture_store;

-- Tạo bảng lưu tin nhắn liên hệ
CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'new',
    replied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ============================================
-- SETUP DATABASE CHO QUẢN LÝ KHÁCH HÀNG
-- ============================================

-- 1. Tạo bảng customers nếu chưa có
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL COMMENT 'Mật khẩu đã mã hóa bằng bcrypt',
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE COMMENT 'TRUE = hoạt động, FALSE = bị khóa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL COMMENT 'Lần đăng nhập gần nhất',
    
    -- Indexes để tăng tốc truy vấn
    INDEX idx_email (email),
    INDEX idx_is_active (is_active),
    INDEX idx_created_at (created_at),
    INDEX idx_full_name (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Insert một số khách hàng demo
-- Password mặc định: password123
INSERT IGNORE INTO customers (email, password, full_name, phone, address, is_active) VALUES
    ('customer1@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eTnB7hV9VqJm', 'Nguyễn Văn A', '0901234567', '123 Đường ABC, Q.1, TP.HCM', TRUE),
    ('customer2@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eTnB7hV9VqJm', 'Trần Thị B', '0902345678', '456 Đường XYZ, Q.2, TP.HCM', TRUE),
    ('customer3@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eTnB7hV9VqJm', 'Lê Văn C', '0903456789', '789 Đường DEF, Q.3, TP.HCM', TRUE),
    ('customer4@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eTnB7hV9VqJm', 'Phạm Thị D', '0904567890', '321 Đường GHI, Q.4, TP.HCM', FALSE),
    ('customer5@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eTnB7hV9VqJm', 'Hoàng Văn E', '0905678901', '654 Đường JKL, Q.5, TP.HCM', TRUE);

-- 3. Kiểm tra dữ liệu
SELECT 
    COUNT(*) as total_customers,
    SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_customers,
    SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactive_customers
FROM customers;
CREATE TABLE IF NOT EXISTS product_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(100) NOT NULL,
    rating DECIMAL(2, 1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    images TEXT COMMENT 'JSON array of image URLs',
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT TRUE,
    helpful_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_product_id (product_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_rating (rating),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 9: Danh sách yêu thích
CREATE TABLE IF NOT EXISTS wishlists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_wishlist (customer_id, product_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 10: Mã giảm giá / Coupons
CREATE TABLE IF NOT EXISTS coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(12, 2) DEFAULT 0,
    max_discount_amount DECIMAL(12, 2) NULL,
    usage_limit INT NULL COMMENT 'Tổng số lần sử dụng',
    usage_count INT DEFAULT 0,
    per_user_limit INT DEFAULT 1 COMMENT 'Số lần mỗi user được dùng',
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_is_active (is_active),
    INDEX idx_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 11: Địa chỉ giao hàng
CREATE TABLE IF NOT EXISTS shipping_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    ward VARCHAR(100) COMMENT 'Phường/Xã',
    district VARCHAR(100) COMMENT 'Quận/Huyện',
    city VARCHAR(100) COMMENT 'Tỉnh/Thành phố',
    postal_code VARCHAR(20),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id),
    INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 12: Giao dịch thanh toán
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    order_id VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'VND',
    status VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, completed, failed, refunded',
    transaction_hash VARCHAR(255) NULL COMMENT 'Hash giao dịch blockchain (cho USDT)',
    bank_reference VARCHAR(255) NULL COMMENT 'Mã tham chiếu ngân hàng',
    payment_gateway_response TEXT NULL COMMENT 'JSON response từ payment gateway',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_order_id (order_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 13: Thông báo
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL COMMENT 'ID khách hàng hoặc admin (NULL = thông báo chung)',
    user_type ENUM('customer', 'admin') DEFAULT 'customer',
    type VARCHAR(50) NOT NULL COMMENT 'order, payment, promotion, system',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500) NULL COMMENT 'Link liên quan',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id, user_type),
    INDEX idx_is_read (is_read),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 14: Cài đặt website
CREATE TABLE IF NOT EXISTS site_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'text' COMMENT 'text, number, boolean, json',
    description VARCHAR(255),
    group_name VARCHAR(50) DEFAULT 'general' COMMENT 'general, contact, payment, email, etc',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_setting_key (setting_key),
    INDEX idx_group_name (group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 15: Hình ảnh sản phẩm (nhiều ảnh cho 1 sản phẩm)
CREATE TABLE IF NOT EXISTS product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    display_order INT DEFAULT 0 COMMENT 'Thứ tự hiển thị',
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id),
    INDEX idx_display_order (display_order),
    INDEX idx_is_primary (is_primary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 16: Lịch sử trạng thái đơn hàng
CREATE TABLE IF NOT EXISTS order_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    note TEXT COMMENT 'Ghi chú khi thay đổi trạng thái',
    changed_by VARCHAR(100) NULL COMMENT 'Người thay đổi (admin username hoặc system)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 17: Giỏ hàng (lưu giỏ hàng của khách hàng đã đăng nhập)
CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_cart_item (customer_id, product_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERT DỮ LIỆU MẪU CHO CÁC BẢNG MỚI
-- ============================================

-- Thêm một số cài đặt website mặc định
INSERT INTO site_settings (setting_key, setting_value, setting_type, description, group_name) VALUES
('site_name', 'Nội Thất ABC', 'text', 'Tên website', 'general'),
('site_description', 'Cửa hàng nội thất cao cấp', 'text', 'Mô tả website', 'general'),
('contact_phone', '0345211386', 'text', 'Số điện thoại liên hệ', 'contact'),
('contact_email', 'quocdat30075@gmail.com', 'text', 'Email liên hệ', 'contact'),
('contact_address', 'Hà Đông, Hà Nội', 'text', 'Địa chỉ liên hệ', 'contact'),
('contact_facebook', 'https://facebook.com', 'text', 'Link Facebook', 'contact'),
('contact_zalo', '0345211386', 'text', 'Số Zalo', 'contact'),
('shipping_fee', '30000', 'number', 'Phí vận chuyển mặc định', 'shipping'),
('free_shipping_threshold', '5000000', 'number', 'Miễn phí ship cho đơn trên', 'shipping'),
('currency', 'VND', 'text', 'Đơn vị tiền tệ', 'general'),
('tax_rate', '10', 'number', 'Thuế VAT (%)', 'payment')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Thêm một số mã giảm giá mẫu
INSERT INTO coupons (code, name, description, discount_type, discount_value, min_order_amount, usage_limit, start_date, end_date, is_active) VALUES
('WELCOME10', 'Chào mừng khách hàng mới', 'Giảm 10% cho đơn hàng đầu tiên', 'percentage', 10.00, 1000000, 100, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), TRUE),
('FREESHIP', 'Miễn phí vận chuyển', 'Miễn phí ship cho mọi đơn hàng', 'fixed', 30000, 0, 500, NOW(), DATE_ADD(NOW(), INTERVAL 6 MONTH), TRUE),
('SALE20', 'Giảm giá 20%', 'Giảm 20% cho đơn hàng trên 5 triệu', 'percentage', 20.00, 5000000, 50, NOW(), DATE_ADD(NOW(), INTERVAL 3 MONTH), TRUE),
('VIP50K', 'Giảm 50k', 'Giảm 50.000đ cho đơn hàng trên 2 triệu', 'fixed', 50000, 2000000, 200, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);
   SELECT * FROM coupons WHERE is_active = TRUE;