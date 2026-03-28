// ============================================
// JAVASCRIPT CHO ACCOUNT PAGE
// ============================================

// ==================== Shipping Addresses ====================
async function loadShippingAddresses() {
    try {
        const response = await fetch('/api/shipping-addresses');
        const data = await response.json();
        
        if (data.success && data.addresses) {
            displayAddresses(data.addresses);
        } else {
            document.getElementById('address-list').innerHTML = '<p>Chưa có địa chỉ nào. Hãy thêm địa chỉ mới!</p>';
        }
    } catch (error) {
        console.error('Error loading addresses:', error);
        document.getElementById('address-list').innerHTML = '<p>Có lỗi xảy ra khi tải địa chỉ</p>';
    }
}

function displayAddresses(addresses) {
    const container = document.getElementById('address-list');
    if (!container) return;
    
    if (addresses.length === 0) {
        container.innerHTML = '<p>Chưa có địa chỉ nào. Hãy thêm địa chỉ mới!</p>';
        return;
    }
    
    let html = '';
    addresses.forEach(address => {
        const defaultClass = address.is_default ? 'default' : '';
        html += `
            <div class="address-card ${defaultClass}">
                <div class="address-card-header">
                    <h4>${address.full_name}</h4>
                    ${address.is_default ? '<span class="default-badge">Mặc định</span>' : ''}
                </div>
                <div class="address-info">
                    <p><strong>Điện thoại:</strong> ${address.phone}</p>
                    <p><strong>Địa chỉ:</strong> ${address.address}</p>
                    ${address.ward ? `<p><strong>Phường/Xã:</strong> ${address.ward}</p>` : ''}
                    ${address.district ? `<p><strong>Quận/Huyện:</strong> ${address.district}</p>` : ''}
                    ${address.city ? `<p><strong>Tỉnh/Thành phố:</strong> ${address.city}</p>` : ''}
                </div>
                <div class="address-actions">
                    <button onclick="editAddress(${address.id})">Sửa</button>
                    <button onclick="setDefaultAddress(${address.id})" ${address.is_default ? 'disabled' : ''}>
                        Đặt mặc định
                    </button>
                    <button class="delete" onclick="deleteAddress(${address.id})">Xóa</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function showAddAddressModal() {
    const modal = document.getElementById('address-modal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('address-form').reset();
        document.getElementById('address-form').setAttribute('data-address-id', '');
    } else {
        // Tạo modal nếu chưa có
        createAddressModal();
        showAddAddressModal();
    }
}

function createAddressModal() {
    const modal = document.createElement('div');
    modal.id = 'address-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Thêm Địa Chỉ Mới</h3>
                <span class="close" onclick="closeAddressModal()">&times;</span>
            </div>
            <form id="address-form" onsubmit="saveAddress(event)">
                <div class="form-group">
                    <label>Họ và tên *</label>
                    <input type="text" name="full_name" required>
                </div>
                <div class="form-group">
                    <label>Số điện thoại *</label>
                    <input type="tel" name="phone" required>
                </div>
                <div class="form-group">
                    <label>Địa chỉ *</label>
                    <textarea name="address" rows="3" required></textarea>
                </div>
                <div class="form-group">
                    <label>Phường/Xã</label>
                    <input type="text" name="ward">
                </div>
                <div class="form-group">
                    <label>Quận/Huyện</label>
                    <input type="text" name="district">
                </div>
                <div class="form-group">
                    <label>Tỉnh/Thành phố</label>
                    <input type="text" name="city">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="is_default">
                        Đặt làm địa chỉ mặc định
                    </label>
                </div>
                <div class="form-actions">
                    <button type="button" onclick="closeAddressModal()">Hủy</button>
                    <button type="submit">Lưu</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Add modal styles
    if (!document.getElementById('address-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'address-modal-styles';
        style.textContent = `
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
            }
            .modal-content {
                background: white;
                margin: 5% auto;
                padding: 0;
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
            }
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .modal-header h3 {
                margin: 0;
            }
            .close {
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
                color: #999;
            }
            .close:hover {
                color: #333;
            }
            .form-actions {
                padding: 20px;
                border-top: 1px solid #e0e0e0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .form-actions button {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            }
            .form-actions button[type="submit"] {
                background: #667eea;
                color: white;
            }
        `;
        document.head.appendChild(style);
    }
}

function closeAddressModal() {
    const modal = document.getElementById('address-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveAddress(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const addressId = form.getAttribute('data-address-id');
    
    const data = {
        full_name: formData.get('full_name'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        ward: formData.get('ward'),
        district: formData.get('district'),
        city: formData.get('city'),
        is_default: formData.get('is_default') === 'on'
    };
    
    try {
        let response;
        if (addressId) {
            // Update
            response = await fetch(`/api/shipping-address/${addressId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } else {
            // Create
            response = await fetch('/api/shipping-address', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        }
        
        const result = await response.json();
        if (result.success) {
            showNotification(result.message || 'Đã lưu địa chỉ', 'success');
            closeAddressModal();
            loadShippingAddresses();
        } else {
            showNotification(result.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error saving address:', error);
        showNotification('Có lỗi xảy ra', 'error');
    }
}

async function editAddress(addressId) {
    try {
        const response = await fetch(`/api/shipping-addresses`);
        const data = await response.json();
        
        if (data.success && data.addresses) {
            const address = data.addresses.find(a => a.id == addressId);
            if (address) {
                const modal = document.getElementById('address-modal');
                if (!modal) {
                    createAddressModal();
                }
                
                const form = document.getElementById('address-form');
                form.setAttribute('data-address-id', addressId);
                form.full_name.value = address.full_name;
                form.phone.value = address.phone;
                form.address.value = address.address;
                form.ward.value = address.ward || '';
                form.district.value = address.district || '';
                form.city.value = address.city || '';
                form.is_default.checked = address.is_default;
                
                document.querySelector('#address-modal .modal-header h3').textContent = 'Sửa Địa Chỉ';
                document.getElementById('address-modal').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading address:', error);
    }
}

async function setDefaultAddress(addressId) {
    try {
        const response = await fetch(`/api/shipping-addresses`);
        const data = await response.json();
        
        if (data.success && data.addresses) {
            const address = data.addresses.find(a => a.id == addressId);
            if (address) {
                address.is_default = true;
                const updateResponse = await fetch(`/api/shipping-address/${addressId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(address)
                });
                
                const result = await updateResponse.json();
                if (result.success) {
                    showNotification('Đã đặt làm địa chỉ mặc định', 'success');
                    loadShippingAddresses();
                }
            }
        }
    } catch (error) {
        console.error('Error setting default address:', error);
    }
}

async function deleteAddress(addressId) {
    if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/shipping-address/${addressId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Đã xóa địa chỉ', 'success');
            loadShippingAddresses();
        } else {
            showNotification(data.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error deleting address:', error);
        showNotification('Có lỗi xảy ra', 'error');
    }
}

// Helper function for notifications
function showNotification(message, type = 'success') {
    // Tạo notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    
    // Add animation
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Load addresses if on addresses section
    if (document.getElementById('address-list')) {
        // Chỉ load nếu section đang hiển thị
        const addressesSection = document.getElementById('addresses');
        if (addressesSection && addressesSection.style.display !== 'none') {
            loadShippingAddresses();
        }
    }
});


// ============================================

// ==================== Shipping Addresses ====================
async function loadShippingAddresses() {
    try {
        const response = await fetch('/api/shipping-addresses');
        const data = await response.json();
        
        if (data.success && data.addresses) {
            displayAddresses(data.addresses);
        } else {
            document.getElementById('address-list').innerHTML = '<p>Chưa có địa chỉ nào. Hãy thêm địa chỉ mới!</p>';
        }
    } catch (error) {
        console.error('Error loading addresses:', error);
        document.getElementById('address-list').innerHTML = '<p>Có lỗi xảy ra khi tải địa chỉ</p>';
    }
}

function displayAddresses(addresses) {
    const container = document.getElementById('address-list');
    if (!container) return;
    
    if (addresses.length === 0) {
        container.innerHTML = '<p>Chưa có địa chỉ nào. Hãy thêm địa chỉ mới!</p>';
        return;
    }
    
    let html = '';
    addresses.forEach(address => {
        const defaultClass = address.is_default ? 'default' : '';
        html += `
            <div class="address-card ${defaultClass}">
                <div class="address-card-header">
                    <h4>${address.full_name}</h4>
                    ${address.is_default ? '<span class="default-badge">Mặc định</span>' : ''}
                </div>
                <div class="address-info">
                    <p><strong>Điện thoại:</strong> ${address.phone}</p>
                    <p><strong>Địa chỉ:</strong> ${address.address}</p>
                    ${address.ward ? `<p><strong>Phường/Xã:</strong> ${address.ward}</p>` : ''}
                    ${address.district ? `<p><strong>Quận/Huyện:</strong> ${address.district}</p>` : ''}
                    ${address.city ? `<p><strong>Tỉnh/Thành phố:</strong> ${address.city}</p>` : ''}
                </div>
                <div class="address-actions">
                    <button onclick="editAddress(${address.id})">Sửa</button>
                    <button onclick="setDefaultAddress(${address.id})" ${address.is_default ? 'disabled' : ''}>
                        Đặt mặc định
                    </button>
                    <button class="delete" onclick="deleteAddress(${address.id})">Xóa</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function showAddAddressModal() {
    const modal = document.getElementById('address-modal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('address-form').reset();
        document.getElementById('address-form').setAttribute('data-address-id', '');
    } else {
        // Tạo modal nếu chưa có
        createAddressModal();
        showAddAddressModal();
    }
}

function createAddressModal() {
    const modal = document.createElement('div');
    modal.id = 'address-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Thêm Địa Chỉ Mới</h3>
                <span class="close" onclick="closeAddressModal()">&times;</span>
            </div>
            <form id="address-form" onsubmit="saveAddress(event)">
                <div class="form-group">
                    <label>Họ và tên *</label>
                    <input type="text" name="full_name" required>
                </div>
                <div class="form-group">
                    <label>Số điện thoại *</label>
                    <input type="tel" name="phone" required>
                </div>
                <div class="form-group">
                    <label>Địa chỉ *</label>
                    <textarea name="address" rows="3" required></textarea>
                </div>
                <div class="form-group">
                    <label>Phường/Xã</label>
                    <input type="text" name="ward">
                </div>
                <div class="form-group">
                    <label>Quận/Huyện</label>
                    <input type="text" name="district">
                </div>
                <div class="form-group">
                    <label>Tỉnh/Thành phố</label>
                    <input type="text" name="city">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="is_default">
                        Đặt làm địa chỉ mặc định
                    </label>
                </div>
                <div class="form-actions">
                    <button type="button" onclick="closeAddressModal()">Hủy</button>
                    <button type="submit">Lưu</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Add modal styles
    if (!document.getElementById('address-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'address-modal-styles';
        style.textContent = `
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
            }
            .modal-content {
                background: white;
                margin: 5% auto;
                padding: 0;
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
            }
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .modal-header h3 {
                margin: 0;
            }
            .close {
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
                color: #999;
            }
            .close:hover {
                color: #333;
            }
            .form-actions {
                padding: 20px;
                border-top: 1px solid #e0e0e0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .form-actions button {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            }
            .form-actions button[type="submit"] {
                background: #667eea;
                color: white;
            }
        `;
        document.head.appendChild(style);
    }
}

function closeAddressModal() {
    const modal = document.getElementById('address-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveAddress(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const addressId = form.getAttribute('data-address-id');
    
    const data = {
        full_name: formData.get('full_name'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        ward: formData.get('ward'),
        district: formData.get('district'),
        city: formData.get('city'),
        is_default: formData.get('is_default') === 'on'
    };
    
    try {
        let response;
        if (addressId) {
            // Update
            response = await fetch(`/api/shipping-address/${addressId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } else {
            // Create
            response = await fetch('/api/shipping-address', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        }
        
        const result = await response.json();
        if (result.success) {
            showNotification(result.message || 'Đã lưu địa chỉ', 'success');
            closeAddressModal();
            loadShippingAddresses();
        } else {
            showNotification(result.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error saving address:', error);
        showNotification('Có lỗi xảy ra', 'error');
    }
}

async function editAddress(addressId) {
    try {
        const response = await fetch(`/api/shipping-addresses`);
        const data = await response.json();
        
        if (data.success && data.addresses) {
            const address = data.addresses.find(a => a.id == addressId);
            if (address) {
                const modal = document.getElementById('address-modal');
                if (!modal) {
                    createAddressModal();
                }
                
                const form = document.getElementById('address-form');
                form.setAttribute('data-address-id', addressId);
                form.full_name.value = address.full_name;
                form.phone.value = address.phone;
                form.address.value = address.address;
                form.ward.value = address.ward || '';
                form.district.value = address.district || '';
                form.city.value = address.city || '';
                form.is_default.checked = address.is_default;
                
                document.querySelector('#address-modal .modal-header h3').textContent = 'Sửa Địa Chỉ';
                document.getElementById('address-modal').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading address:', error);
    }
}

async function setDefaultAddress(addressId) {
    try {
        const response = await fetch(`/api/shipping-addresses`);
        const data = await response.json();
        
        if (data.success && data.addresses) {
            const address = data.addresses.find(a => a.id == addressId);
            if (address) {
                address.is_default = true;
                const updateResponse = await fetch(`/api/shipping-address/${addressId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(address)
                });
                
                const result = await updateResponse.json();
                if (result.success) {
                    showNotification('Đã đặt làm địa chỉ mặc định', 'success');
                    loadShippingAddresses();
                }
            }
        }
    } catch (error) {
        console.error('Error setting default address:', error);
    }
}

async function deleteAddress(addressId) {
    if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/shipping-address/${addressId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Đã xóa địa chỉ', 'success');
            loadShippingAddresses();
        } else {
            showNotification(data.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error deleting address:', error);
        showNotification('Có lỗi xảy ra', 'error');
    }
}

// Helper function for notifications
function showNotification(message, type = 'success') {
    // Tạo notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    
    // Add animation
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Load addresses if on addresses section
    if (document.getElementById('address-list')) {
        // Chỉ load nếu section đang hiển thị
        const addressesSection = document.getElementById('addresses');
        if (addressesSection && addressesSection.style.display !== 'none') {
            loadShippingAddresses();
        }
    }
});

