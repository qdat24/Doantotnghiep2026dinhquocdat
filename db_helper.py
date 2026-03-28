import mysql.connector
from mysql.connector import Error
import bcrypt

# Cấu hình database
# Cấu hình cho PythonAnywhere
DB_CONFIG = {
     'host': 'localhost',
    'user': 'root',
    'password': '12345678',  # Thay đổi password của bạn
    'database': 'furniture_store',
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci'
}

# Cấu hình cho local development (comment lại khi deploy)
# DB_CONFIG = {
#     'host': 'localhost',
#     'user': 'root',
#     'password': '12345678',
#     'database': 'furniture_store',
#     'charset': 'utf8mb4',
#     'collation': 'utf8mb4_unicode_ci'
# }

def get_db_connection():
    """Tạo kết nối đến database"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"Lỗi kết nối database: {e}")
        return None

def execute_query(query, params=None, fetch=False, fetch_one=False):
    """
    Thực thi câu lệnh SQL
    
    Args:
        query: Câu lệnh SQL
        params: Tham số cho prepared statement
        fetch: True nếu cần lấy kết quả (SELECT)
        fetch_one: True nếu chỉ lấy 1 kết quả
    
    Returns:
        Kết quả query hoặc None
    """
    connection = get_db_connection()
    if not connection:
        return None
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params or ())
        
        if fetch:
            result = cursor.fetchone() if fetch_one else cursor.fetchall()
            return result
        else:
            connection.commit()
            return cursor.lastrowid if cursor.lastrowid else True
            
    except Error as e:
        try:
            print(f"Lỗi thực thi query: {e}")
        except UnicodeEncodeError:
            print(f"Query execution error: {str(e)}")
        if not fetch:
            connection.rollback()
        return None
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

# Hàm helper cho sản phẩm
def get_all_products(category=None, active_only=True):
    """Lấy tất cả sản phẩm, loại bỏ trùng lặp dựa trên ID và tên"""
    return get_products_filtered(category=category, active_only=active_only)

def get_products_filtered(category=None, search=None, min_price=None, max_price=None, sort_by=None, active_only=True):
    """Lấy sản phẩm với các bộ lọc và sắp xếp"""
    query = "SELECT * FROM products WHERE 1=1"
    params = []
    
    if active_only:
        query += " AND is_active = TRUE"
    
    if category:
        query += " AND category = %s"
        params.append(category)
    
    if min_price is not None:
        query += " AND price >= %s"
        params.append(float(min_price))
    
    if max_price is not None:
        query += " AND price <= %s"
        params.append(float(max_price))
    
    if sort_by:
        if sort_by == 'price_asc':
            query += " ORDER BY price ASC"
        elif sort_by == 'price_desc':
            query += " ORDER BY price DESC"
        elif sort_by == 'name_asc':
            query += " ORDER BY name ASC"
        elif sort_by == 'name_desc':
            query += " ORDER BY name DESC"
        elif sort_by == 'rating_desc':
            query += " ORDER BY rating DESC, reviews DESC"
        elif sort_by == 'newest':
            query += " ORDER BY created_at DESC"
        else:
            query += " ORDER BY created_at DESC"
    else:
        query += " ORDER BY created_at DESC"
    
    products = execute_query(query, tuple(params) if params else None, fetch=True)
    
    if not products:
        return []
    
    if not isinstance(products, list):
        products = [products] if products else []
    
    if search:
        print(f"DEBUG db_helper - Search value: '{search}'")
        search_lower = search.strip().lower()
        print(f"DEBUG db_helper - Search lower: '{search_lower}'")
        print(f"DEBUG db_helper - Products before filter: {len(products)}")
        
        if search_lower:
            filtered_products = []
            for product in products:
                if not product or not isinstance(product, dict):
                    continue
                
                name = str(product.get('name', '')).lower()
                description = str(product.get('description', '')).lower()
                category_name = str(product.get('category', '')).lower()
                features = product.get('features', '')
                if isinstance(features, str):
                    features_lower = features.lower()
                elif isinstance(features, list):
                    features_lower = '|'.join(features).lower()
                else:
                    features_lower = ''
                
                if (search_lower in name or 
                    search_lower in description or 
                    search_lower in category_name or 
                    search_lower in features_lower):
                    filtered_products.append(product)
            
            print(f"DEBUG db_helper - Products after filter: {len(filtered_products)}")
            products = filtered_products
        else:
            print("DEBUG db_helper - Search is empty after strip/lower")
    
    seen_ids = set()
    seen_names = {}
    unique_products = []
    
    for product in products:
        if not product or not isinstance(product, dict):
            continue
        
        product_id = product.get('id')
        product_name = product.get('name', '').strip().lower()
        
        if product_id is not None:
            try:
                product_id = int(product_id)
                
                if product_id not in seen_ids:
                    if product_name:
                        if product_name in seen_names:
                            existing_id = seen_names[product_name]
                            if product_id > existing_id:
                                seen_names[product_name] = product_id
                                seen_ids.discard(existing_id)
                                unique_products = [p for p in unique_products if p.get('id') != existing_id]
                                seen_ids.add(product_id)
                                unique_products.append(product)
                        else:
                            seen_names[product_name] = product_id
                            seen_ids.add(product_id)
                            unique_products.append(product)
                    else:
                        seen_ids.add(product_id)
                        unique_products.append(product)
            except (ValueError, TypeError):
                continue
    
    for product in unique_products:
        if product.get('features'):
            if isinstance(product['features'], str):
                product['features'] = product['features'].split('|')
            elif not isinstance(product['features'], list):
                product['features'] = []
        else:
            product['features'] = []
    
    return unique_products

def get_product_by_id(product_id):
    """Lấy sản phẩm theo ID"""
    query = "SELECT * FROM products WHERE id = %s"
    product = execute_query(query, (product_id,), fetch=True, fetch_one=True)
    
    # DEBUG
    print(f"🔍 get_product_by_id({product_id}): {product is not None}")
    
    if product and product.get('features'):
        if isinstance(product['features'], str):
            product['features'] = product['features'].split('|')
        elif not isinstance(product['features'], list):
            product['features'] = []
    
    return product

def create_product(data):
    """Tạo sản phẩm mới"""
    features_str = '|'.join(data['features']) if isinstance(data['features'], list) else data['features']
    
    query = """
        INSERT INTO products (name, category, price, original_price, image, description, features, rating, reviews, stock)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        data['name'],
        data['category'],
        data['price'],
        data.get('original_price', data['price']),
        data.get('image', ''),
        data.get('description', ''),
        features_str,
        data.get('rating', 5.0),
        data.get('reviews', 0),
        data.get('stock', 100)
    )
    
    return execute_query(query, params)

def update_product(product_id, data):
    """Cập nhật sản phẩm"""
    features_str = '|'.join(data['features']) if isinstance(data['features'], list) else data['features']
    
    query = """
        UPDATE products 
        SET name = %s, category = %s, price = %s, original_price = %s, 
            image = %s, description = %s, features = %s, rating = %s, 
            reviews = %s, stock = %s, is_active = %s
        WHERE id = %s
    """
    params = (
        data['name'],
        data['category'],
        data['price'],
        data.get('original_price', data['price']),
        data.get('image', ''),
        data.get('description', ''),
        features_str,
        data.get('rating', 5.0),
        data.get('reviews', 0),
        data.get('stock', 100),
        data.get('is_active', True),
        product_id
    )
    
    return execute_query(query, params)

def delete_product(product_id):
    """Xóa sản phẩm (soft delete - ẩn khỏi website)"""
    try:
        query = "UPDATE products SET is_active = FALSE WHERE id = %s"
        result = execute_query(query, (product_id,))
        return result
    except Exception as e:
        print(f"Lỗi trong delete_product: {e}")
        return None

def hard_delete_product(product_id):
    """Xóa vĩnh viễn sản phẩm"""
    query = "DELETE FROM products WHERE id = %s"
    return execute_query(query, (product_id,))

# Hàm helper cho categories
def get_all_categories():
    """Lấy tất cả danh mục"""
    query = "SELECT * FROM categories ORDER BY name"
    return execute_query(query, fetch=True)

def get_category_names():
    """Lấy danh sách tên categories"""
    categories = get_all_categories()
    return [cat['name'] for cat in categories] if categories else []

# Hàm helper cho admin
def verify_admin(username, password):
    """Xác thực admin"""
    try:
        query = "SELECT * FROM admin_users WHERE username = %s AND is_active = 1"
        admin = execute_query(query, (username,), fetch=True, fetch_one=True)
        
        if not admin:
            return None
        
        # Kiểm tra password
        stored_password = admin.get('password', '')
        if not stored_password:
            return None
        
        # Verify password với bcrypt
        try:
            # Đảm bảo stored_password là string
            if isinstance(stored_password, bytes):
                stored_password = stored_password.decode('utf-8')
            
            # Verify password
            password_bytes = password.encode('utf-8')
            stored_bytes = stored_password.encode('utf-8')
            
            if bcrypt.checkpw(password_bytes, stored_bytes):
                # Cập nhật last_login
                try:
                    update_query = "UPDATE admin_users SET last_login = NOW() WHERE id = %s"
                    execute_query(update_query, (admin['id'],))
                except:
                    pass  # Không quan trọng nếu update last_login fail
                
                return admin
        except Exception as e:
            print(f"Error verifying password: {e}")
            return None
            
    except Exception as e:
        print(f"Error in verify_admin: {e}")
        return None
    
    return None

def create_admin(username, password, full_name, email):
    """Tạo admin mới"""
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    query = """
        INSERT INTO admin_users (username, password, full_name, email)
        VALUES (%s, %s, %s, %s)
    """
    params = (username, hashed.decode('utf-8'), full_name, email)
    
    return execute_query(query, params)

# Hàm helper cho khách hàng
def create_customer(email, password, full_name, phone=None, address=None):
    """Tạo khách hàng mới"""
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    query = """
        INSERT INTO customers (email, password, full_name, phone, address)
        VALUES (%s, %s, %s, %s, %s)
    """
    params = (email, hashed.decode('utf-8'), full_name, phone, address)
    
    return execute_query(query, params)

def verify_customer(email, password):
    """Xác thực khách hàng"""
    query = "SELECT * FROM customers WHERE email = %s AND is_active = TRUE"
    customer = execute_query(query, (email,), fetch=True, fetch_one=True)
    
    if customer and bcrypt.checkpw(password.encode('utf-8'), customer['password'].encode('utf-8')):
        # Cập nhật last_login
        update_query = "UPDATE customers SET last_login = NOW() WHERE id = %s"
        execute_query(update_query, (customer['id'],))
        return customer
    
    return None

def get_customer_by_id(customer_id):
    """Lấy thông tin khách hàng theo ID"""
    query = "SELECT * FROM customers WHERE id = %s"
    return execute_query(query, (customer_id,), fetch=True, fetch_one=True)

def get_customer_by_email(email):
    """Lấy thông tin khách hàng theo email"""
    query = "SELECT * FROM customers WHERE email = %s"
    return execute_query(query, (email,), fetch=True, fetch_one=True)

def get_customer_by_google_id(google_id):
    """Lấy thông tin khách hàng theo Google ID"""
    query = "SELECT * FROM customers WHERE google_id = %s AND is_active = TRUE"
    return execute_query(query, (google_id,), fetch=True, fetch_one=True)

def create_customer_google(google_id, email, full_name, picture=None):
    """Tạo khách hàng mới từ Google OAuth"""
    query = """
        INSERT INTO customers (google_id, email, password, full_name, is_active)
        VALUES (%s, %s, NULL, %s, TRUE)
    """
    params = (google_id, email, full_name)
    return execute_query(query, params)

def update_customer_google_id(customer_id, google_id):
    """Cập nhật Google ID cho khách hàng đã có"""
    query = "UPDATE customers SET google_id = %s WHERE id = %s"
    return execute_query(query, (google_id, customer_id))

def update_customer(customer_id, data):
    """Cập nhật thông tin khách hàng"""
    query = """
        UPDATE customers 
        SET full_name = %s, phone = %s, address = %s
        WHERE id = %s
    """
    params = (
        data.get('full_name'),
        data.get('phone'),
        data.get('address'),
        customer_id
    )
    
    return execute_query(query, params)

def update_customer_password(customer_id, new_password):
    """Cập nhật mật khẩu khách hàng"""
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    query = "UPDATE customers SET password = %s WHERE id = %s"
    return execute_query(query, (hashed.decode('utf-8'), customer_id))

# Hàm helper cho đơn hàng
def create_order(order_data):
    """Tạo đơn hàng mới"""
    query = """
        INSERT INTO orders (order_id, customer_id, customer_name, phone, email, address, note, 
                          payment_method, subtotal, shipping_fee, total, status, payment_status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        order_data['order_id'],
        order_data.get('customer_id'),
        order_data['customer_name'],
        order_data['phone'],
        order_data.get('email', ''),
        order_data['address'],
        order_data.get('note', ''),
        order_data['payment_method'],
        order_data['subtotal'],
        order_data['shipping_fee'],
        order_data['total'],
        order_data.get('status', 'pending'),
        order_data.get('payment_status', 'pending')
    )
    
    order_id = execute_query(query, params)
    
    # Thêm order items
    if order_id and 'items' in order_data:
        for item in order_data['items']:
            create_order_item(order_data['order_id'], item)
    
    return order_id

def create_order_item(order_id, item_data):
    """Tạo chi tiết đơn hàng"""
    query = """
        INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    params = (
        order_id,
        item_data['product_id'],
        item_data['name'],
        item_data['price'],
        item_data['quantity'],
        item_data['subtotal']
    )
    
    return execute_query(query, params)

def get_order_by_id(order_id):
    """Lấy đơn hàng theo order_id"""
    query = "SELECT * FROM orders WHERE order_id = %s"
    order = execute_query(query, (order_id,), fetch=True, fetch_one=True)
    
    if order:
        # Lấy order items
        items_query = "SELECT * FROM order_items WHERE order_id = %s"
        order['items'] = execute_query(items_query, (order_id,), fetch=True)
    
    return order

def get_all_orders(limit=None):
    """Lấy tất cả đơn hàng"""
    query = "SELECT * FROM orders ORDER BY created_at DESC"
    if limit:
        query += f" LIMIT {limit}"
    
    return execute_query(query, fetch=True)

def update_order_status(order_id, status, payment_status=None, note=None, changed_by=None):
    """Cập nhật trạng thái đơn hàng và lưu lịch sử"""
    if payment_status:
        query = "UPDATE orders SET status = %s, payment_status = %s WHERE order_id = %s"
        params = (status, payment_status, order_id)
    else:
        query = "UPDATE orders SET status = %s WHERE order_id = %s"
        params = (status, order_id)
    
    result = execute_query(query, params)
    
    # Tự động thêm vào lịch sử thay đổi trạng thái
    if result:
        status_note = f"Trạng thái: {status}"
        if payment_status:
            status_note += f", Thanh toán: {payment_status}"
        if note:
            status_note += f" - {note}"
        
        add_order_status_history(order_id, status, status_note, changed_by)
    
    return result

# Helper để đếm
def count_products(active_only=True):
    """Đếm số lượng sản phẩm"""
    query = "SELECT COUNT(*) as total FROM products"
    if active_only:
        query += " WHERE is_active = TRUE"
    
    result = execute_query(query, fetch=True, fetch_one=True)
    return result['total'] if result else 0

def count_orders():
    """Đếm số lượng đơn hàng"""
    query = "SELECT COUNT(*) as total FROM orders"
    result = execute_query(query, fetch=True, fetch_one=True)
    return result['total'] if result else 0

def get_revenue_stats():
    """Lấy thống kê doanh thu"""
    query = """
        SELECT 
            SUM(total) as total_revenue,
            COUNT(*) as total_orders,
            AVG(total) as avg_order_value
        FROM orders 
        WHERE payment_status = 'paid'
    """
    return execute_query(query, fetch=True, fetch_one=True)

def get_revenue_by_period(period='day', days=30):
    """
    Lấy doanh thu theo khoảng thời gian
    
    Args:
        period: 'day', 'week', 'month'
        days: Số ngày gần đây (mặc định 30)
    
    Returns:
        List các dict với date và revenue
    """
    if period == 'day':
        query = """
            SELECT 
                DATE(created_at) as date,
                SUM(total) as revenue,
                COUNT(*) as orders
            FROM orders 
            WHERE payment_status = 'paid' 
            AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL %s DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        """
    elif period == 'week':
        query = """
            SELECT 
                YEARWEEK(created_at) as week,
                DATE(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY)) as week_start,
                SUM(total) as revenue,
                COUNT(*) as orders
            FROM orders 
            WHERE payment_status = 'paid' 
            AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL %s DAY)
            GROUP BY YEARWEEK(created_at)
            ORDER BY week ASC
        """
    else:  # month
        query = """
            SELECT 
                DATE_FORMAT(created_at, '%%Y-%%m') as month,
                SUM(total) as revenue,
                COUNT(*) as orders
            FROM orders 
            WHERE payment_status = 'paid' 
            AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL %s DAY)
            GROUP BY DATE_FORMAT(created_at, '%%Y-%%m')
            ORDER BY month ASC
        """
    
    return execute_query(query, (days,), fetch=True)

def get_revenue_by_payment_method():
    """Lấy doanh thu theo phương thức thanh toán"""
    query = """
        SELECT 
            payment_method,
            SUM(total) as revenue,
            COUNT(*) as orders
        FROM orders 
        WHERE payment_status = 'paid'
        GROUP BY payment_method
        ORDER BY revenue DESC
    """
    return execute_query(query, fetch=True)

def get_top_products_by_revenue(limit=10):
    """Lấy top sản phẩm bán chạy theo doanh thu"""
    query = """
        SELECT 
            p.id,
            p.name,
            p.image as image_url,
            SUM(oi.subtotal) as revenue,
            SUM(oi.quantity) as total_sold,
            COUNT(DISTINCT o.order_id) as order_count
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.payment_status = 'paid'
        GROUP BY p.id, p.name, p.image
        ORDER BY revenue DESC
        LIMIT %s
    """
    return execute_query(query, (limit,), fetch=True)

# ==================== Site Settings Functions ====================

def get_all_settings():
    """Lấy tất cả cài đặt website"""
    query = "SELECT * FROM site_settings ORDER BY setting_key"
    return execute_query(query, fetch=True)

def get_setting(setting_key, default=None):
    """Lấy giá trị của một cài đặt theo key"""
    query = "SELECT setting_value FROM site_settings WHERE setting_key = %s"
    result = execute_query(query, (setting_key,), fetch=True, fetch_one=True)
    return result['setting_value'] if result else default

def get_settings_dict():
    """Lấy tất cả cài đặt dưới dạng dictionary"""
    settings = get_all_settings()
    return {s['setting_key']: s['setting_value'] for s in settings} if settings else {}

def update_setting(setting_key, setting_value, setting_type='text', description='', group_name='general'):
    """Cập nhật giá trị của một cài đặt (tự động tạo nếu chưa tồn tại)"""
    try:
        if setting_value is None:
            setting_value = ''
        
        setting_value = str(setting_value)
        
        # Thử với đầy đủ các cột trước
        try:
            query = """
                INSERT INTO site_settings (setting_key, setting_value, setting_type, description, group_name)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    setting_type = VALUES(setting_type),
                    description = VALUES(description),
                    group_name = VALUES(group_name),
                    updated_at = NOW()
            """
            result = execute_query(query, (setting_key, setting_value, setting_type, description, group_name))
            if result is not None:
                return True
        except Exception:
            # Nếu lỗi, thử với chỉ setting_key và setting_value (schema cũ)
            pass
        
        # Fallback: chỉ dùng setting_key và setting_value
        query_simple = """
            INSERT INTO site_settings (setting_key, setting_value)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE 
                setting_value = VALUES(setting_value),
                updated_at = NOW()
        """
        result = execute_query(query_simple, (setting_key, setting_value))
        return result is not None
    except Exception as e:
        import sys
        error_msg = f"Error in update_setting for {setting_key}: {str(e)}"
        try:
            print(error_msg)
        except UnicodeEncodeError:
            print(error_msg.encode('ascii', 'ignore').decode('ascii'))
        return False

def update_multiple_settings(settings_dict):
    """Cập nhật nhiều cài đặt cùng lúc"""
    success = True
    error_messages = []
    
    for key, value in settings_dict.items():
        try:
            if value is None:
                value = ''
            
            result = update_setting(key, str(value))
            if not result:
                success = False
                error_messages.append(f"Lỗi khi cập nhật {key}")
        except Exception as e:
            print(f"Lỗi khi cập nhật setting {key}: {e}")
            success = False
            error_messages.append(f"Lỗi khi cập nhật {key}: {str(e)}")
    
    if error_messages:
        print("Chi tiết lỗi:", "; ".join(error_messages))
    
    return success

def create_setting(setting_key, setting_value, description=''):
    """Tạo một cài đặt mới"""
    query = """
        INSERT INTO site_settings (setting_key, setting_value, description)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE 
            setting_value = VALUES(setting_value),
            description = VALUES(description),
            updated_at = NOW()
    """
    return execute_query(query, (setting_key, setting_value, description))

# ==================== Contact Functions ====================

def create_contact(contact_data):
    """Tạo tin nhắn liên hệ mới"""
    query = """
        INSERT INTO contacts (name, email, phone, subject, message, status)
        VALUES (%s, %s, %s, %s, %s, 'new')
    """
    params = (
        contact_data['name'],
        contact_data['email'],
        contact_data.get('phone', ''),
        contact_data['subject'],
        contact_data['message']
    )
    return execute_query(query, params)

def get_all_contacts(status=None, limit=None):
    """Lấy danh sách liên hệ"""
    query = "SELECT * FROM contacts"
    params = []
    
    if status:
        query += " WHERE status = %s"
        params.append(status)
    
    query += " ORDER BY created_at DESC"
    
    if limit:
        query += " LIMIT %s"
        params.append(limit)
    
    return execute_query(query, tuple(params) if params else None, fetch=True)

def get_contact_by_id(contact_id):
    """Lấy chi tiết một liên hệ"""
    query = "SELECT * FROM contacts WHERE id = %s"
    return execute_query(query, (contact_id,), fetch=True, fetch_one=True)

def update_contact_status(contact_id, status, replied=False):
    """Cập nhật trạng thái liên hệ"""
    query = """
        UPDATE contacts 
        SET status = %s, replied = %s
        WHERE id = %s
    """
    return execute_query(query, (status, replied, contact_id))

def count_contacts(status=None):
    """Đếm số lượng liên hệ"""
    query = "SELECT COUNT(*) as total FROM contacts"
    params = None
    
    if status:
        query += " WHERE status = %s"
        params = (status,)
    
    result = execute_query(query, params, fetch=True, fetch_one=True)
    return result['total'] if result else 0

# ============================================
# HÀM QUẢN LÝ KHÁCH HÀNG CHO ADMIN
# ============================================

def get_all_customers(search=None, status_filter=None, limit=None, offset=0):
    """
    Lấy danh sách tất cả khách hàng với tìm kiếm và lọc
    
    Args:
        search: Từ khóa tìm kiếm (tên, email, số điện thoại)
        status_filter: Lọc theo trạng thái (active, inactive)
        limit: Số lượng kết quả tối đa
        offset: Vị trí bắt đầu lấy dữ liệu
    
    Returns:
        List các khách hàng
    """
    query = "SELECT * FROM customers WHERE 1=1"
    params = []
    
    # Tìm kiếm
    if search:
        query += " AND (full_name LIKE %s OR email LIKE %s OR phone LIKE %s)"
        search_pattern = f"%{search}%"
        params.extend([search_pattern, search_pattern, search_pattern])
    
    # Lọc theo trạng thái
    if status_filter == 'active':
        query += " AND is_active = TRUE"
    elif status_filter == 'inactive':
        query += " AND is_active = FALSE"
    
    # Sắp xếp
    query += " ORDER BY created_at DESC"
    
    # Giới hạn và phân trang
    if limit:
        query += " LIMIT %s OFFSET %s"
        params.extend([limit, offset])
    
    return execute_query(query, tuple(params) if params else None, fetch=True) or []

def count_customers(search=None, status_filter=None):
    """
    Đếm số lượng khách hàng với điều kiện tìm kiếm và lọc
    
    Args:
        search: Từ khóa tìm kiếm
        status_filter: Lọc theo trạng thái
    
    Returns:
        Số lượng khách hàng
    """
    query = "SELECT COUNT(*) as total FROM customers WHERE 1=1"
    params = []
    
    if search:
        query += " AND (full_name LIKE %s OR email LIKE %s OR phone LIKE %s)"
        search_pattern = f"%{search}%"
        params.extend([search_pattern, search_pattern, search_pattern])
    
    if status_filter == 'active':
        query += " AND is_active = TRUE"
    elif status_filter == 'inactive':
        query += " AND is_active = FALSE"
    
    result = execute_query(query, tuple(params) if params else None, fetch=True, fetch_one=True)
    return result['total'] if result else 0

def toggle_customer_status(customer_id):
    """
    Chuyển đổi trạng thái khách hàng (kích hoạt/vô hiệu hóa)
    
    Args:
        customer_id: ID của khách hàng
    
    Returns:
        True nếu thành công, False nếu thất bại
    """
    query = "UPDATE customers SET is_active = NOT is_active WHERE id = %s"
    return execute_query(query, (customer_id,))

def delete_customer(customer_id):
    """
    Xóa khách hàng
    
    Args:
        customer_id: ID của khách hàng
    
    Returns:
        True nếu thành công, False nếu thất bại
    """
    # Trước khi xóa, set customer_id = NULL cho các đơn hàng liên quan
    update_orders_query = "UPDATE orders SET customer_id = NULL WHERE customer_id = %s"
    execute_query(update_orders_query, (customer_id,))
    
    # Xóa khách hàng
    query = "DELETE FROM customers WHERE id = %s"
    return execute_query(query, (customer_id,))

def get_customer_stats():
    """
    Lấy thống kê về khách hàng
    
    Returns:
        Dict chứa các thống kê
    """
    stats = {}
    
    # Tổng số khách hàng
    total_query = "SELECT COUNT(*) as total FROM customers"
    total_result = execute_query(total_query, fetch=True, fetch_one=True)
    stats['total'] = total_result['total'] if total_result else 0
    
    # Khách hàng đang hoạt động
    active_query = "SELECT COUNT(*) as total FROM customers WHERE is_active = TRUE"
    active_result = execute_query(active_query, fetch=True, fetch_one=True)
    stats['active'] = active_result['total'] if active_result else 0
    
    # Khách hàng bị khóa
    stats['inactive'] = stats['total'] - stats['active']
    
    # Khách hàng mới trong tháng này
    new_query = """
        SELECT COUNT(*) as total FROM customers 
        WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) 
        AND YEAR(created_at) = YEAR(CURRENT_DATE())
    """
    new_result = execute_query(new_query, fetch=True, fetch_one=True)
    stats['new_this_month'] = new_result['total'] if new_result else 0
    
    return stats

def update_customer_by_admin(customer_id, data):
    """
    Admin cập nhật thông tin khách hàng (bao gồm cả trạng thái)
    
    Args:
        customer_id: ID khách hàng
        data: Dict chứa thông tin cần cập nhật
    
    Returns:
        True nếu thành công, False nếu thất bại
    """
    query = """
        UPDATE customers 
        SET full_name = %s, phone = %s, address = %s, is_active = %s
        WHERE id = %s
    """
    params = (
        data.get('full_name'),
        data.get('phone'),
        data.get('address'),
        data.get('is_active', True),
        customer_id
    )
    
    return execute_query(query, params)# ============================================
# HÀM HELPER CHO CÁC BẢNG MỚI
# ============================================

# ==================== Product Reviews ====================
def get_product_reviews(product_id, approved_only=True, rating_filter=None, sort_by='newest', limit=None, offset=None):
    """Lấy đánh giá của sản phẩm"""
    query = "SELECT * FROM product_reviews WHERE product_id = %s"
    params = [product_id]
    
    if approved_only:
        query += " AND is_approved = TRUE"
    
    if rating_filter:
        query += " AND rating = %s"
        params.append(rating_filter)
    
    # Sort
    if sort_by == 'newest':
        query += " ORDER BY created_at DESC"
    elif sort_by == 'oldest':
        query += " ORDER BY created_at ASC"
    elif sort_by == 'highest':
        query += " ORDER BY rating DESC, created_at DESC"
    elif sort_by == 'lowest':
        query += " ORDER BY rating ASC, created_at DESC"
    elif sort_by == 'helpful':
        query += " ORDER BY helpful_count DESC, created_at DESC"
    else:
        query += " ORDER BY created_at DESC"
    
    if limit:
        query += " LIMIT %s"
        params.append(limit)
        if offset:
            query += " OFFSET %s"
            params.append(offset)
    
    reviews = execute_query(query, tuple(params), fetch=True) or []
    
    # Parse images JSON
    for review in reviews:
        if review.get('images'):
            try:
                import json
                review['images'] = json.loads(review['images'])
            except:
                review['images'] = []
        else:
            review['images'] = []
    
    return reviews

def get_review_rating_stats(product_id):
    """Lấy thống kê rating của sản phẩm"""
    # Lấy tổng số reviews đã duyệt
    total_query = "SELECT COUNT(*) as total FROM product_reviews WHERE product_id = %s AND is_approved = TRUE"
    total_result = execute_query(total_query, (product_id,), fetch=True, fetch_one=True)
    total_reviews = total_result['total'] if total_result else 0
    
    # Lấy thống kê theo rating
    query = """
        SELECT 
            rating,
            COUNT(*) as count
        FROM product_reviews
        WHERE product_id = %s AND is_approved = TRUE
        GROUP BY rating
        ORDER BY rating DESC
    """
    stats = execute_query(query, (product_id,), fetch=True) or []
    
    # Tạo dict với key là rating
    stats_dict = {i: {'count': 0, 'percentage': 0} for i in range(5, 0, -1)}
    for stat in stats:
        rating = int(float(stat['rating']))
        count = stat['count']
        percentage = round((count * 100.0 / total_reviews) if total_reviews > 0 else 0, 1)
        stats_dict[rating] = {
            'count': count,
            'percentage': percentage
        }
    
    return stats_dict

def mark_review_helpful(review_id):
    """Đánh dấu đánh giá là hữu ích"""
    query = "UPDATE product_reviews SET helpful_count = helpful_count + 1 WHERE id = %s"
    return execute_query(query, (review_id,))

def create_product_review(review_data):
    """Tạo đánh giá mới"""
    import json
    images_json = json.dumps(review_data.get('images', [])) if review_data.get('images') else None
    
    query = """
        INSERT INTO product_reviews (product_id, customer_id, customer_name, rating, title, comment, images, is_verified_purchase)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        review_data['product_id'],
        review_data.get('customer_id'),
        review_data['customer_name'],
        review_data['rating'],
        review_data.get('title', ''),
        review_data.get('comment', ''),
        images_json,
        review_data.get('is_verified_purchase', False)
    )
    
    review_id = execute_query(query, params)
    
    # Cập nhật rating trung bình của sản phẩm
    if review_id:
        update_product_rating(review_data['product_id'])
    
    return review_id

def update_product_rating(product_id):
    """Cập nhật rating trung bình và số lượng reviews của sản phẩm"""
    query = """
        SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
        FROM product_reviews
        WHERE product_id = %s AND is_approved = TRUE
    """
    result = execute_query(query, (product_id,), fetch=True, fetch_one=True)
    
    if result and result.get('avg_rating'):
        update_query = """
            UPDATE products 
            SET rating = %s, reviews = %s
            WHERE id = %s
        """
        execute_query(update_query, (
            round(float(result['avg_rating']), 1),
            result['review_count'],
            product_id
        ))

def get_review_by_id(review_id):
    """Lấy đánh giá theo ID"""
    query = "SELECT * FROM product_reviews WHERE id = %s"
    review = execute_query(query, (review_id,), fetch=True, fetch_one=True)
    
    if review and review.get('images'):
        try:
            import json
            review['images'] = json.loads(review['images'])
        except:
            review['images'] = []
    
    return review

# ==================== Wishlist ====================
def add_to_wishlist(customer_id, product_id):
    """Thêm sản phẩm vào wishlist"""
    query = """
        INSERT INTO wishlists (customer_id, product_id)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE created_at = NOW()
    """
    return execute_query(query, (customer_id, product_id))

def remove_from_wishlist(customer_id, product_id):
    """Xóa sản phẩm khỏi wishlist"""
    query = "DELETE FROM wishlists WHERE customer_id = %s AND product_id = %s"
    return execute_query(query, (customer_id, product_id))

def get_wishlist(customer_id):
    """Lấy danh sách wishlist của khách hàng"""
    query = """
        SELECT w.*, p.name, p.price, p.original_price, p.image, p.is_active
        FROM wishlists w
        JOIN products p ON w.product_id = p.id
        WHERE w.customer_id = %s
        ORDER BY w.created_at DESC
    """
    return execute_query(query, (customer_id,), fetch=True) or []

def is_in_wishlist(customer_id, product_id):
    """Kiểm tra sản phẩm có trong wishlist không"""
    query = "SELECT COUNT(*) as count FROM wishlists WHERE customer_id = %s AND product_id = %s"
    result = execute_query(query, (customer_id, product_id), fetch=True, fetch_one=True)
    return result['count'] > 0 if result else False

def get_all_reviews(approved_only=None, limit=None, offset=None):
    """Lấy tất cả đánh giá"""
    query = "SELECT * FROM product_reviews"
    params = []
    
    if approved_only is True:
        query += " WHERE is_approved = TRUE"
    elif approved_only is False:
        query += " WHERE is_approved = FALSE"
    
    query += " ORDER BY created_at DESC"
    
    if limit:
        query += " LIMIT %s"
        params.append(limit)
        if offset:
            query += " OFFSET %s"
            params.append(offset)
    
    reviews = execute_query(query, tuple(params) if params else None, fetch=True) or []
    
    # Parse images JSON
    for review in reviews:
        if review.get('images'):
            try:
                import json
                review['images'] = json.loads(review['images'])
            except:
                review['images'] = []
        else:
            review['images'] = []
    
    return reviews

def count_reviews(approved_only=None):
    """Đếm số lượng đánh giá"""
    query = "SELECT COUNT(*) as total FROM product_reviews"
    params = None
    
    if approved_only is True:
        query += " WHERE is_approved = TRUE"
    elif approved_only is False:
        query += " WHERE is_approved = FALSE"
    
    result = execute_query(query, params, fetch=True, fetch_one=True)
    return result['total'] if result else 0

def delete_review(review_id):
    """Xóa đánh giá"""
    query = "DELETE FROM product_reviews WHERE id = %s"
    return execute_query(query, (review_id,))

def update_review_status(review_id, is_approved):
    """Cập nhật trạng thái duyệt đánh giá"""
    query = "UPDATE product_reviews SET is_approved = %s WHERE id = %s"
    return execute_query(query, (is_approved, review_id))

# ==================== Coupons ====================
def get_coupon_by_code(code):
    """Lấy thông tin coupon theo code"""
    query = """
        SELECT * FROM coupons 
        WHERE code = %s 
        AND is_active = TRUE
        AND start_date <= NOW()
        AND end_date >= NOW()
    """
    return execute_query(query, (code,), fetch=True, fetch_one=True)

def validate_coupon(code, order_amount, customer_id=None):
    """Kiểm tra coupon có hợp lệ không"""
    coupon = get_coupon_by_code(code)
    
    if not coupon:
        return {'valid': False, 'message': 'Mã giảm giá không tồn tại hoặc đã hết hạn'}
    
    # Kiểm tra usage limit
    if coupon.get('usage_limit') and coupon['usage_count'] >= coupon['usage_limit']:
        return {'valid': False, 'message': 'Mã giảm giá đã hết lượt sử dụng'}
    
    # Kiểm tra min order amount
    if order_amount < coupon.get('min_order_amount', 0):
        return {'valid': False, 'message': f'Đơn hàng tối thiểu {coupon["min_order_amount"]:,.0f}₫'}
    
    return {'valid': True, 'coupon': coupon}

def apply_coupon(code, order_amount):
    """Áp dụng coupon và tính số tiền giảm"""
    validation = validate_coupon(code, order_amount)
    
    if not validation['valid']:
        return validation
    
    coupon = validation['coupon']
    discount = 0
    
    # Convert tất cả Decimal to float để tránh lỗi type mismatch
    order_amount_float = float(order_amount) if order_amount else 0.0
    discount_value = float(coupon.get('discount_value', 0))
    max_discount = float(coupon.get('max_discount_amount', 0)) if coupon.get('max_discount_amount') else None
    min_order = float(coupon.get('min_order_amount', 0)) if coupon.get('min_order_amount') else 0
    
    if coupon['discount_type'] == 'percentage':
        discount = order_amount_float * (discount_value / 100)
        # Áp dụng max discount nếu có
        if max_discount:
            discount = min(discount, max_discount)
    else:  # fixed
        discount = discount_value
    
    # Đảm bảo discount không âm và không vượt quá order_amount
    discount = max(0.0, min(discount, order_amount_float))
    final_amount = order_amount_float - discount
    
    return {
        'valid': True,
        'discount': float(discount),
        'final_amount': float(final_amount),
        'coupon': coupon
    }

def increment_coupon_usage(code):
    """Tăng số lần sử dụng coupon"""
    query = "UPDATE coupons SET usage_count = usage_count + 1 WHERE code = %s"
    return execute_query(query, (code,))

def get_all_coupons(active_only=None, limit=None, offset=None):
    """Lấy tất cả mã giảm giá"""
    query = "SELECT * FROM coupons"
    params = []
    
    if active_only is True:
        query += " WHERE is_active = TRUE"
    elif active_only is False:
        query += " WHERE is_active = FALSE"
    
    query += " ORDER BY created_at DESC"
    
    if limit:
        query += " LIMIT %s"
        params.append(limit)
        if offset:
            query += " OFFSET %s"
            params.append(offset)
    
    return execute_query(query, tuple(params) if params else None, fetch=True) or []

def count_coupons(active_only=None):
    """Đếm số lượng mã giảm giá"""
    query = "SELECT COUNT(*) as total FROM coupons"
    params = None
    
    if active_only is True:
        query += " WHERE is_active = TRUE"
    elif active_only is False:
        query += " WHERE is_active = FALSE"
    
    result = execute_query(query, params, fetch=True, fetch_one=True)
    return result['total'] if result else 0

def get_coupon_by_id(coupon_id):
    """Lấy coupon theo ID"""
    query = "SELECT * FROM coupons WHERE id = %s"
    return execute_query(query, (coupon_id,), fetch=True, fetch_one=True)

def create_coupon(coupon_data):
    """Tạo mã giảm giá mới"""
    query = """
        INSERT INTO coupons (code, name, description, discount_type, discount_value, 
                            min_order_amount, max_discount_amount, usage_limit, 
                            start_date, end_date, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        coupon_data['code'],
        coupon_data['name'],
        coupon_data.get('description'),
        coupon_data['discount_type'],
        coupon_data['discount_value'],
        coupon_data.get('min_order_amount', 0),
        coupon_data.get('max_discount_amount'),
        coupon_data.get('usage_limit'),
        coupon_data['start_date'],
        coupon_data['end_date'],
        coupon_data.get('is_active', True)
    )
    return execute_query(query, params)

def update_coupon(coupon_id, coupon_data):
    """Cập nhật mã giảm giá"""
    query = """
        UPDATE coupons 
        SET name = %s, description = %s, discount_type = %s, discount_value = %s,
            min_order_amount = %s, max_discount_amount = %s, usage_limit = %s,
            start_date = %s, end_date = %s, is_active = %s
        WHERE id = %s
    """
    params = (
        coupon_data['name'],
        coupon_data.get('description'),
        coupon_data['discount_type'],
        coupon_data['discount_value'],
        coupon_data.get('min_order_amount', 0),
        coupon_data.get('max_discount_amount'),
        coupon_data.get('usage_limit'),
        coupon_data['start_date'],
        coupon_data['end_date'],
        coupon_data.get('is_active', True),
        coupon_id
    )
    return execute_query(query, params)

def delete_coupon(coupon_id):
    """Xóa mã giảm giá"""
    query = "DELETE FROM coupons WHERE id = %s"
    return execute_query(query, (coupon_id,))

# ==================== Shipping Addresses ====================
def create_shipping_address(customer_id, address_data):
    """Tạo địa chỉ giao hàng mới"""
    # Nếu đặt làm mặc định, bỏ default của các địa chỉ khác
    if address_data.get('is_default'):
        query = "UPDATE shipping_addresses SET is_default = FALSE WHERE customer_id = %s"
        execute_query(query, (customer_id,))
    
    query = """
        INSERT INTO shipping_addresses (customer_id, full_name, phone, address, ward, district, city, postal_code, is_default)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        customer_id,
        address_data['full_name'],
        address_data['phone'],
        address_data['address'],
        address_data.get('ward'),
        address_data.get('district'),
        address_data.get('city'),
        address_data.get('postal_code'),
        address_data.get('is_default', False)
    )
    
    return execute_query(query, params)

def get_shipping_addresses(customer_id):
    """Lấy danh sách địa chỉ giao hàng của khách hàng"""
    query = """
        SELECT * FROM shipping_addresses 
        WHERE customer_id = %s
        ORDER BY is_default DESC, created_at DESC
    """
    return execute_query(query, (customer_id,), fetch=True) or []

def get_shipping_address_by_id(address_id, customer_id=None):
    """Lấy địa chỉ theo ID"""
    query = "SELECT * FROM shipping_addresses WHERE id = %s"
    params = [address_id]
    
    if customer_id:
        query += " AND customer_id = %s"
        params.append(customer_id)
    
    return execute_query(query, tuple(params), fetch=True, fetch_one=True)

def update_shipping_address(address_id, customer_id, address_data):
    """Cập nhật địa chỉ giao hàng"""
    # Nếu đặt làm mặc định, bỏ default của các địa chỉ khác
    if address_data.get('is_default'):
        query = "UPDATE shipping_addresses SET is_default = FALSE WHERE customer_id = %s AND id != %s"
        execute_query(query, (customer_id, address_id))
    
    query = """
        UPDATE shipping_addresses 
        SET full_name = %s, phone = %s, address = %s, ward = %s, 
            district = %s, city = %s, postal_code = %s, is_default = %s
        WHERE id = %s AND customer_id = %s
    """
    params = (
        address_data['full_name'],
        address_data['phone'],
        address_data['address'],
        address_data.get('ward'),
        address_data.get('district'),
        address_data.get('city'),
        address_data.get('postal_code'),
        address_data.get('is_default', False),
        address_id,
        customer_id
    )
    
    return execute_query(query, params)

def delete_shipping_address(address_id, customer_id):
    """Xóa địa chỉ giao hàng"""
    query = "DELETE FROM shipping_addresses WHERE id = %s AND customer_id = %s"
    return execute_query(query, (address_id, customer_id))

# ==================== Payment Transactions ====================
def create_payment_transaction(transaction_data):
    """Tạo giao dịch thanh toán"""
    import json
    gateway_response = json.dumps(transaction_data.get('payment_gateway_response')) if transaction_data.get('payment_gateway_response') else None
    
    query = """
        INSERT INTO payment_transactions 
        (transaction_id, order_id, payment_method, amount, currency, status, 
         transaction_hash, bank_reference, payment_gateway_response, paid_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        transaction_data['transaction_id'],
        transaction_data['order_id'],
        transaction_data['payment_method'],
        transaction_data['amount'],
        transaction_data.get('currency', 'VND'),
        transaction_data.get('status', 'pending'),
        transaction_data.get('transaction_hash'),
        transaction_data.get('bank_reference'),
        gateway_response,
        transaction_data.get('paid_at')
    )
    
    return execute_query(query, params)

def get_payment_transaction_by_order(order_id):
    """Lấy giao dịch thanh toán theo order_id"""
    query = "SELECT * FROM payment_transactions WHERE order_id = %s ORDER BY created_at DESC LIMIT 1"
    transaction = execute_query(query, (order_id,), fetch=True, fetch_one=True)
    
    if transaction and transaction.get('payment_gateway_response'):
        try:
            import json
            transaction['payment_gateway_response'] = json.loads(transaction['payment_gateway_response'])
        except:
            pass
    
    return transaction

def update_payment_transaction_status(transaction_id, status, paid_at=None):
    """Cập nhật trạng thái giao dịch"""
    if paid_at:
        query = "UPDATE payment_transactions SET status = %s, paid_at = %s WHERE transaction_id = %s"
        return execute_query(query, (status, paid_at, transaction_id))
    else:
        query = "UPDATE payment_transactions SET status = %s WHERE transaction_id = %s"
        return execute_query(query, (status, transaction_id))

def update_payment_transaction_by_order(order_id, status, paid_at=None, bank_reference=None):
    """Cập nhật trạng thái giao dịch theo order_id"""
    if paid_at and bank_reference:
        query = "UPDATE payment_transactions SET status = %s, paid_at = %s, bank_reference = %s WHERE order_id = %s"
        return execute_query(query, (status, paid_at, bank_reference, order_id))
    elif paid_at:
        query = "UPDATE payment_transactions SET status = %s, paid_at = %s WHERE order_id = %s"
        return execute_query(query, (status, paid_at, order_id))
    else:
        query = "UPDATE payment_transactions SET status = %s WHERE order_id = %s"
        return execute_query(query, (status, order_id))

def get_all_payment_transactions(status=None, limit=None, offset=None):
    """Lấy tất cả giao dịch thanh toán"""
    query = "SELECT * FROM payment_transactions"
    params = []
    
    if status:
        query += " WHERE status = %s"
        params.append(status)
    
    query += " ORDER BY created_at DESC"
    
    if limit:
        query += " LIMIT %s"
        params.append(limit)
        if offset:
            query += " OFFSET %s"
            params.append(offset)
    
    transactions = execute_query(query, tuple(params) if params else None, fetch=True) or []
    
    # Parse payment_gateway_response JSON
    for transaction in transactions:
        if transaction.get('payment_gateway_response'):
            try:
                import json
                transaction['payment_gateway_response'] = json.loads(transaction['payment_gateway_response'])
            except:
                pass
    
    return transactions

# ==================== NFT Certificates ====================
def create_nft_certificate(order_id, token_id, tx_hash, recipient_address, chain_id=56):
    """Lưu thông tin NFT chứng nhận"""
    query = """
        INSERT INTO nft_certificates (order_id, token_id, tx_hash, recipient_address, chain_id)
        VALUES (%s, %s, %s, %s, %s)
    """
    return execute_query(query, (order_id, token_id, tx_hash, recipient_address, chain_id))

def get_nft_certificate_by_order(order_id):
    """Lấy NFT chứng nhận theo order_id"""
    query = "SELECT * FROM nft_certificates WHERE order_id = %s LIMIT 1"
    return execute_query(query, (order_id,), fetch=True, fetch_one=True)

def get_nft_certificate_by_token_id(token_id, chain_id=56):
    """Lấy NFT chứng nhận theo token_id (cho metadata API)"""
    query = "SELECT * FROM nft_certificates WHERE token_id = %s AND chain_id = %s LIMIT 1"
    return execute_query(query, (token_id, chain_id), fetch=True, fetch_one=True)

def count_payment_transactions(status=None):
    """Đếm số lượng giao dịch thanh toán"""
    query = "SELECT COUNT(*) as total FROM payment_transactions"
    params = None
    
    if status:
        query += " WHERE status = %s"
        params = (status,)
    
    result = execute_query(query, params, fetch=True, fetch_one=True)
    return result['total'] if result else 0

# ==================== Notifications ====================
def create_notification(notification_data):
    """Tạo thông báo mới"""
    query = """
        INSERT INTO notifications (user_id, user_type, type, title, message, link)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    params = (
        notification_data.get('user_id'),
        notification_data.get('user_type', 'customer'),
        notification_data['type'],
        notification_data['title'],
        notification_data['message'],
        notification_data.get('link')
    )
    
    return execute_query(query, params)

def get_notifications(user_id, user_type='customer', unread_only=False, limit=None):
    """Lấy danh sách thông báo"""
    query = "SELECT * FROM notifications WHERE user_id = %s AND user_type = %s"
    params = [user_id, user_type]
    
    if unread_only:
        query += " AND is_read = FALSE"
    
    query += " ORDER BY created_at DESC"
    
    if limit:
        query += " LIMIT %s"
        params.append(limit)
    
    return execute_query(query, tuple(params), fetch=True) or []

def mark_notification_read(notification_id, user_id=None):
    """Đánh dấu thông báo đã đọc"""
    if user_id:
        query = "UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = %s AND user_id = %s"
        return execute_query(query, (notification_id, user_id))
    else:
        query = "UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = %s"
        return execute_query(query, (notification_id,))

def mark_all_notifications_read(user_id, user_type='customer'):
    """Đánh dấu tất cả thông báo đã đọc"""
    query = "UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = %s AND user_type = %s"
    return execute_query(query, (user_id, user_type))

def get_all_notifications(user_type='customer', unread_only=False, limit=None, offset=None):
    """Lấy tất cả thông báo"""
    query = "SELECT * FROM notifications WHERE user_type = %s"
    params = [user_type]
    
    if unread_only:
        query += " AND is_read = FALSE"
    
    query += " ORDER BY created_at DESC"
    
    if limit:
        query += " LIMIT %s"
        params.append(limit)
        if offset:
            query += " OFFSET %s"
            params.append(offset)
    
    return execute_query(query, tuple(params), fetch=True) or []

def count_notifications(user_type='customer', unread_only=False):
    """Đếm số lượng thông báo"""
    query = "SELECT COUNT(*) as total FROM notifications WHERE user_type = %s"
    params = [user_type]
    
    if unread_only:
        query += " AND is_read = FALSE"
    
    result = execute_query(query, tuple(params), fetch=True, fetch_one=True)
    return result['total'] if result else 0

def count_unread_notifications(user_id, user_type='customer'):
    """Đếm số thông báo chưa đọc"""
    query = "SELECT COUNT(*) as count FROM notifications WHERE user_id = %s AND user_type = %s AND is_read = FALSE"
    result = execute_query(query, (user_id, user_type), fetch=True, fetch_one=True)
    return result['count'] if result else 0

# ==================== Product Images ====================
def add_product_image(product_id, image_url, alt_text=None, is_primary=False):
    """Thêm hình ảnh cho sản phẩm"""
    # Nếu đặt làm ảnh chính, bỏ primary của các ảnh khác
    if is_primary:
        query = "UPDATE product_images SET is_primary = FALSE WHERE product_id = %s"
        execute_query(query, (product_id,))
    
    query = """
        INSERT INTO product_images (product_id, image_url, alt_text, is_primary, display_order)
        VALUES (%s, %s, %s, %s, 
            (SELECT COALESCE(MAX(display_order), 0) + 1 FROM product_images AS pi WHERE pi.product_id = %s))
    """
    return execute_query(query, (product_id, image_url, alt_text, is_primary, product_id))

def get_product_images(product_id, primary_only=False):
    """Lấy hình ảnh của sản phẩm"""
    query = "SELECT * FROM product_images WHERE product_id = %s"
    params = [product_id]
    
    if primary_only:
        query += " AND is_primary = TRUE"
    
    query += " ORDER BY display_order ASC, created_at ASC"
    
    return execute_query(query, tuple(params), fetch=True) or []

def delete_product_image(image_id):
    """Xóa hình ảnh sản phẩm"""
    query = "DELETE FROM product_images WHERE id = %s"
    return execute_query(query, (image_id,))

# ==================== Order Status History ====================
def add_order_status_history(order_id, status, note=None, changed_by=None):
    """Thêm lịch sử thay đổi trạng thái đơn hàng"""
    query = """
        INSERT INTO order_status_history (order_id, status, note, changed_by)
        VALUES (%s, %s, %s, %s)
    """
    return execute_query(query, (order_id, status, note, changed_by))

def get_order_status_history(order_id):
    """Lấy lịch sử thay đổi trạng thái đơn hàng"""
    query = """
        SELECT * FROM order_status_history 
        WHERE order_id = %s
        ORDER BY created_at ASC
    """
    return execute_query(query, (order_id,), fetch=True) or []

# ==================== Cart Items ====================
def add_to_cart(customer_id, product_id, quantity=1):
    """Thêm sản phẩm vào giỏ hàng"""
    query = """
        INSERT INTO cart_items (customer_id, product_id, quantity)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE quantity = quantity + %s, updated_at = NOW()
    """
    return execute_query(query, (customer_id, product_id, quantity, quantity))

def get_cart_items(customer_id):
    """Lấy giỏ hàng của khách hàng"""
    query = """
        SELECT c.*, p.name, p.price, p.original_price, p.image, p.stock, p.is_active
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.customer_id = %s
        ORDER BY c.created_at DESC
    """
    return execute_query(query, (customer_id,), fetch=True) or []

def update_cart_item_quantity(customer_id, product_id, quantity):
    """Cập nhật số lượng sản phẩm trong giỏ hàng"""
    if quantity <= 0:
        return remove_from_cart(customer_id, product_id)
    
    query = "UPDATE cart_items SET quantity = %s, updated_at = NOW() WHERE customer_id = %s AND product_id = %s"
    return execute_query(query, (quantity, customer_id, product_id))

def remove_from_cart(customer_id, product_id):
    """Xóa sản phẩm khỏi giỏ hàng"""
    query = "DELETE FROM cart_items WHERE customer_id = %s AND product_id = %s"
    return execute_query(query, (customer_id, product_id))

def clear_cart(customer_id):
    """Xóa toàn bộ giỏ hàng"""
    query = "DELETE FROM cart_items WHERE customer_id = %s"
    return execute_query(query, (customer_id,))

