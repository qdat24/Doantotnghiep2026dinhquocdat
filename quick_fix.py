import bcrypt
import mysql.connector

# Cấu hình
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '12345678',  # Thay password MySQL
    'database': 'furniture_store'
}

# Kết nối
conn = mysql.connector.connect(**DB_CONFIG)
cursor = conn.cursor()

# Xóa và tạo lại admin
cursor.execute("DELETE FROM admin_users")

# Tạo password hash
password = 'admin123'
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

# Insert
cursor.execute("""
    INSERT INTO admin_users (username, password, full_name, email, is_active)
    VALUES (%s, %s, %s, %s, %s)
""", ('admin', hashed.decode('utf-8'), 'Administrator', 'admin@furniture.com', 1))

conn.commit()

# Verify ngay
cursor.execute("SELECT * FROM admin_users WHERE username = 'admin'")
admin = cursor.fetchone()

print("\n✅ ĐÃ TẠO ADMIN MỚI!")
print(f"Username: admin")
print(f"Password: admin123")
print(f"Hash: {hashed.decode('utf-8')[:50]}...")

# Test ngay
if bcrypt.checkpw(password.encode('utf-8'), hashed):
    print("\n✅ ✅ ✅ PASSWORD VERIFIED! ✅ ✅ ✅")
else:
    print("\n❌ CÓ VẤN ĐỀ!")

cursor.close()
conn.close()