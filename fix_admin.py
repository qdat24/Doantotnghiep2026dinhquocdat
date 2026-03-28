"""
Script để fix và tạo lại admin user
Chạy: python fix_admin.py
"""
import sys
import io
# Fix encoding cho Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import bcrypt
from db_helper import execute_query, get_db_connection

def fix_admin():
    """Tạo lại admin user với password: admin123"""
    try:
        # Xóa admin cũ nếu có
        print("[*] Dang kiem tra admin hien tai...")
        query = "DELETE FROM admin_users WHERE username = 'admin'"
        execute_query(query)
        print("[OK] Da xoa admin cu (neu co)")
        
        # Tạo password hash mới
        password = 'admin123'
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        hashed_str = hashed.decode('utf-8')
        
        print(f"\n[*] Dang tao admin moi...")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"   Hash: {hashed_str[:50]}...")
        
        # Tạo admin mới
        insert_query = """
            INSERT INTO admin_users (username, password, full_name, email, is_active)
            VALUES (%s, %s, %s, %s, %s)
        """
        params = ('admin', hashed_str, 'Administrator', 'admin@furniture.com', 1)
        execute_query(insert_query, params)
        
        print("[OK] Da tao admin moi thanh cong!")
        
        # Verify ngay
        print("\n[*] Dang verify password...")
        verify_query = "SELECT * FROM admin_users WHERE username = 'admin' AND is_active = 1"
        admin = execute_query(verify_query, fetch=True, fetch_one=True)
        
        if admin:
            stored_hash = admin['password']
            if bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
                print("[OK] [OK] [OK] PASSWORD VERIFIED! [OK] [OK] [OK]")
                print(f"\n[*] Thong tin admin:")
                print(f"   ID: {admin['id']}")
                print(f"   Username: {admin['username']}")
                print(f"   Full Name: {admin['full_name']}")
                print(f"   Email: {admin['email']}")
                print(f"   Is Active: {admin['is_active']}")
                return True
            else:
                print("[ERROR] Password verification FAILED!")
                return False
        else:
            print("[ERROR] Khong tim thay admin sau khi tao!")
            return False
            
    except Exception as e:
        print(f"[ERROR] Loi: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("=" * 50)
    print("FIX ADMIN USER SCRIPT")
    print("=" * 50)
    
    success = fix_admin()
    
    print("\n" + "=" * 50)
    if success:
        print("[OK] HOAN TAT! Ban co the dang nhap voi:")
        print("   Username: admin")
        print("   Password: admin123")
    else:
        print("[ERROR] CO LOI XAY RA! Vui long kiem tra lai.")
    print("=" * 50)
