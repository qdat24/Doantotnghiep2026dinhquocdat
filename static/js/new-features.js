// ============================================
// JAVASCRIPT CHO CÁC CHỨC NĂNG MỚI
// ============================================

// ==================== Wishlist Functions ====================
async function toggleWishlist(productId) {
    if (!isLoggedIn()) {
        alert('Vui lòng đăng nhập để thêm vào yêu thích');
        return;
    }
    
    try {
        // Kiểm tra trạng thái hiện tại
        const checkResponse = await fetch(`/api/wishlist/check/${productId}`);
        const checkData = await checkResponse.json();
        const isInWishlist = checkData.in_wishlist;
        
        // Toggle
        const endpoint = isInWishlist ? `/api/wishlist/remove/${productId}` : `/api/wishlist/add/${productId}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        if (data.success) {
            updateWishlistButton(productId, !isInWishlist);
            showNotification(data.message, 'success');
        } else {
            showNotification(data.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error toggling wishlist:', error);
        showNotification('Có lỗi xảy ra', 'error');
    }
}

function updateWishlistButton(productId, isInWishlist) {
    const button = document.querySelector(`[data-wishlist-product="${productId}"]`);
    if (button) {
        if (isInWishlist) {
            button.classList.add('active');
            button.innerHTML = '<i class="fas fa-heart"></i> Đã yêu thích';
        } else {
            button.classList.remove('active');
            button.innerHTML = '<i class="far fa-heart"></i> Yêu thích';
        }
    }
}

async function loadWishlistStatus(productId) {
    if (!isLoggedIn()) return;
    
    try {
        const response = await fetch(`/api/wishlist/check/${productId}`);
        const data = await response.json();
        if (data.success) {
            updateWishlistButton(productId, data.in_wishlist);
        }
    } catch (error) {
        console.error('Error loading wishlist status:', error);
    }
}

// ==================== Product Reviews Functions ====================
async function loadProductReviews(productId) {
    try {
        const response = await fetch(`/api/product/${productId}/reviews`);
        const data = await response.json();
        
        if (data.success && data.reviews) {
            displayReviews(data.reviews);
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
    }
}

function displayReviews(reviews) {
    const container = document.getElementById('reviews-container');
    if (!container) return;
    
    if (reviews.length === 0) {
        container.innerHTML = '<p class="no-reviews">Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá!</p>';
        return;
    }
    
    let html = '';
    reviews.forEach(review => {
        const stars = generateStars(review.rating);
        const verifiedBadge = review.is_verified_purchase ? '<span class="verified-badge">✓ Đã mua</span>' : '';
        const date = new Date(review.created_at).toLocaleDateString('vi-VN');
        
        html += `
            <div class="review-item">
                <div class="review-header">
                    <div class="reviewer-info">
                        <strong>${review.customer_name}</strong>
                        ${verifiedBadge}
                    </div>
                    <div class="review-rating">${stars}</div>
                </div>
                ${review.title ? `<h4 class="review-title">${review.title}</h4>` : ''}
                <p class="review-comment">${review.comment}</p>
                ${review.images && review.images.length > 0 ? `
                    <div class="review-images">
                        ${review.images.map(img => `<img src="${img}" alt="Review image" onclick="openImageModal('${img}')">`).join('')}
                    </div>
                ` : ''}
                <div class="review-footer">
                    <span class="review-date">${date}</span>
                    <button class="helpful-btn" onclick="markHelpful(${review.id})">
                        <i class="fas fa-thumbs-up"></i> Hữu ích (${review.helpful_count || 0})
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function generateStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            html += '<i class="fas fa-star"></i>';
        } else if (i - 0.5 <= rating) {
            html += '<i class="fas fa-star-half-alt"></i>';
        } else {
            html += '<i class="far fa-star"></i>';
        }
    }
    return html;
}

async function submitReview(productId) {
    if (!isLoggedIn()) {
        alert('Vui lòng đăng nhập để đánh giá');
        return;
    }
    
    const rating = document.getElementById('review-rating')?.value;
    const title = document.getElementById('review-title')?.value;
    const comment = document.getElementById('review-comment')?.value;
    
    if (!rating || !comment) {
        alert('Vui lòng điền đầy đủ thông tin');
        return;
    }
    
    try {
        const response = await fetch(`/api/product/${productId}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rating: parseInt(rating),
                title: title || '',
                comment: comment,
                images: [] // Có thể thêm upload ảnh sau
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Đánh giá đã được gửi. Cảm ơn bạn!', 'success');
            document.getElementById('review-form')?.reset();
            loadProductReviews(productId);
        } else {
            showNotification(data.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        showNotification('Có lỗi xảy ra', 'error');
    }
}

// ==================== Coupon Functions ====================
let appliedCoupon = null;

async function applyCouponCode() {
    const codeInput = document.getElementById('coupon-code');
    if (!codeInput) {
        console.error('Không tìm thấy coupon-code input');
        alert('Không tìm thấy ô nhập mã giảm giá');
        return;
    }
    
    const code = codeInput.value.trim().toUpperCase();
    
    if (!code) {
        alert('Vui lòng nhập mã giảm giá');
        return;
    }
    
    // Lấy tổng tiền đơn hàng
    const subtotal = getOrderSubtotal();
    
    if (subtotal <= 0) {
        alert('Không thể áp dụng mã giảm giá. Tổng tiền đơn hàng không hợp lệ.');
        return;
    }
    
    console.log('Applying coupon:', code, 'for amount:', subtotal);
    
    try {
        const response = await fetch('/api/coupon/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                order_amount: subtotal
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Coupon response:', data);
        
        if (data.valid) {
            appliedCoupon = data.coupon;
            
            // Hiển thị section applied coupon
            const inputSection = document.getElementById('coupon-input-section');
            const appliedSection = document.getElementById('applied-coupon-section');
            const couponName = document.getElementById('applied-coupon-name');
            
            if (inputSection) inputSection.style.display = 'none';
            if (appliedSection) {
                appliedSection.style.display = 'block';
                if (couponName) couponName.textContent = `${data.coupon.name} - Giảm ${data.discount.toLocaleString('vi-VN')}₫`;
            }
            
            // Cập nhật tổng tiền
            updateOrderSummary(data.discount, data.final_amount);
            showNotification(`Đã áp dụng mã giảm giá: ${code}`, 'success');
            codeInput.value = '';
        } else {
            showNotification(data.message || 'Mã giảm giá không hợp lệ', 'error');
        }
    } catch (error) {
        console.error('Error applying coupon:', error);
        showNotification('Có lỗi xảy ra khi áp dụng mã giảm giá: ' + error.message, 'error');
    }
}

function removeCoupon() {
    appliedCoupon = null;
    const subtotal = getOrderSubtotal();
    
    // Hiển thị lại input section
    const inputSection = document.getElementById('coupon-input-section');
    const appliedSection = document.getElementById('applied-coupon-section');
    
    if (inputSection) inputSection.style.display = 'block';
    if (appliedSection) appliedSection.style.display = 'none';
    
    // Reset tổng tiền
    updateOrderSummary(0, subtotal);
    showNotification('Đã xóa mã giảm giá', 'info');
}

function updateOrderSummary(discount, finalAmount) {
    const discountRow = document.getElementById('coupon-discount-row');
    const discountElement = document.getElementById('coupon-discount');
    const totalElement = document.getElementById('order-total');
    
    // Hiển thị/ẩn dòng giảm giá
    if (discountRow) {
        if (discount > 0) {
            discountRow.style.display = 'flex';
            if (discountElement) {
                discountElement.textContent = `-${discount.toLocaleString('vi-VN')}₫`;
            }
        } else {
            discountRow.style.display = 'none';
        }
    }
    
    // Cập nhật tổng tiền
    if (totalElement) {
        totalElement.textContent = `${finalAmount.toLocaleString('vi-VN')}₫`;
    }
    
    console.log('Updated order summary - Discount:', discount, 'Final:', finalAmount);
}

function getOrderSubtotal() {
    // Lấy tổng tiền từ giỏ hàng hoặc form
    const subtotalElement = document.getElementById('order-subtotal');
    if (subtotalElement) {
        // Lấy text và loại bỏ tất cả ký tự không phải số
        let text = subtotalElement.textContent || subtotalElement.innerText || '';
        // Loại bỏ dấu phẩy, dấu chấm, khoảng trắng và các ký tự khác
        text = text.replace(/[^\d]/g, '');
        const amount = parseInt(text) || 0;
        console.log('Order subtotal:', amount);
        return amount;
    }
    console.warn('Không tìm thấy order-subtotal element');
    return 0;
}

// ==================== Notifications Functions ====================
let notificationCheckInterval = null;

async function loadNotifications() {
    if (!isLoggedIn()) return;
    
    try {
        const response = await fetch('/api/notifications?limit=10');
        const data = await response.json();
        
        if (data.success) {
            displayNotifications(data.notifications);
            updateNotificationBadge(data.unread_count);
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function displayNotifications(notifications) {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = '<p class="no-notifications">Không có thông báo nào</p>';
        return;
    }
    
    let html = '';
    notifications.forEach(notif => {
        const unreadClass = notif.is_read ? '' : 'unread';
        html += `
            <div class="notification-item ${unreadClass}" onclick="openNotification('${notif.link || '#'}')">
                <div class="notification-content">
                    <h4>${notif.title}</h4>
                    <p>${notif.message}</p>
                    <span class="notification-time">${formatTime(notif.created_at)}</span>
                </div>
                ${!notif.is_read ? '<span class="unread-dot"></span>' : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

async function markNotificationRead(notificationId) {
    try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
            method: 'POST'
        });
        
        if (response.ok) {
            loadNotifications();
        }
    } catch (error) {
        console.error('Error marking notification read:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        const response = await fetch('/api/notifications/read-all', {
            method: 'POST'
        });
        
        if (response.ok) {
            loadNotifications();
        }
    } catch (error) {
        console.error('Error marking all read:', error);
    }
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN');
}

function openNotification(link) {
    if (link && link !== '#') {
        window.location.href = link;
    }
}

// ==================== Cart Sync Functions ====================
async function syncCartToDatabase() {
    if (!isLoggedIn()) return;
    
    try {
        const response = await fetch('/api/cart/sync', {
            method: 'POST'
        });
        
        const data = await response.json();
        if (data.success) {
            console.log('Cart synced to database');
        }
    } catch (error) {
        console.error('Error syncing cart:', error);
    }
}

async function loadCartFromDatabase() {
    if (!isLoggedIn()) return;
    
    try {
        const response = await fetch('/api/cart/load');
        const data = await response.json();
        
        if (data.success && data.cart) {
            // Reload cart display
            if (typeof updateCartDisplay === 'function') {
                updateCartDisplay();
            }
        }
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

// ==================== Order History Functions ====================
async function loadOrderHistory(orderId) {
    try {
        const response = await fetch(`/api/order/${orderId}/history`);
        const data = await response.json();
        
        if (data.success && data.history) {
            displayOrderHistory(data.history);
        }
    } catch (error) {
        console.error('Error loading order history:', error);
    }
}

function displayOrderHistory(history) {
    const container = document.getElementById('order-history');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = '<p>Chưa có lịch sử thay đổi</p>';
        return;
    }
    
    const statusMap = {
        'pending': { text: 'Chờ xác nhận', icon: 'clock', color: '#ff9800' },
        'confirmed': { text: 'Đã xác nhận', icon: 'check-circle', color: '#2196f3' },
        'shipping': { text: 'Đang giao hàng', icon: 'truck', color: '#9c27b0' },
        'delivered': { text: 'Đã giao hàng', icon: 'check-double', color: '#4caf50' },
        'cancelled': { text: 'Đã hủy', icon: 'times-circle', color: '#f44336' }
    };
    
    let html = '<div class="order-history-timeline">';
    history.forEach((item, index) => {
        const statusInfo = statusMap[item.status] || { text: item.status, icon: 'circle', color: '#666' };
        const isLast = index === history.length - 1;
        
        html += `
            <div class="history-item ${isLast ? 'current' : ''}">
                <div class="history-icon" style="background: ${statusInfo.color}">
                    <i class="fas fa-${statusInfo.icon}"></i>
                </div>
                <div class="history-content">
                    <h4>${statusInfo.text}</h4>
                    ${item.note ? `<p>${item.note}</p>` : ''}
                    <span class="history-time">${new Date(item.created_at).toLocaleString('vi-VN')}</span>
                    ${item.changed_by ? `<span class="history-by">Bởi: ${item.changed_by}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ==================== Helper Functions ====================
function isLoggedIn() {
    // Kiểm tra xem user đã đăng nhập chưa
    // Có thể check cookie, session, hoặc element trên page
    return document.cookie.includes('customer_logged_in') || 
           document.body.classList.contains('logged-in') ||
           sessionStorage.getItem('customer_email');
}

function showNotification(message, type = 'info') {
    // Tạo notification toast
    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', function() {
    // Load notifications nếu đã đăng nhập
    if (isLoggedIn()) {
        loadNotifications();
        // Check notifications mỗi 30 giây
        notificationCheckInterval = setInterval(loadNotifications, 30000);
        
        // Sync cart khi đăng nhập
        syncCartToDatabase();
    }
    
    // Load wishlist status cho tất cả products trên page
    document.querySelectorAll('[data-wishlist-product]').forEach(btn => {
        const productId = btn.getAttribute('data-wishlist-product');
        loadWishlistStatus(productId);
    });
    
    // Load order history if on order detail page
    const orderId = document.querySelector('[data-order-id]')?.getAttribute('data-order-id');
    if (orderId && typeof loadOrderHistory === 'function') {
        loadOrderHistory(orderId);
    }
});


// ============================================

// ==================== Wishlist Functions ====================
async function toggleWishlist(productId) {
    if (!isLoggedIn()) {
        alert('Vui lòng đăng nhập để thêm vào yêu thích');
        return;
    }
    
    try {
        // Kiểm tra trạng thái hiện tại
        const checkResponse = await fetch(`/api/wishlist/check/${productId}`);
        const checkData = await checkResponse.json();
        const isInWishlist = checkData.in_wishlist;
        
        // Toggle
        const endpoint = isInWishlist ? `/api/wishlist/remove/${productId}` : `/api/wishlist/add/${productId}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        if (data.success) {
            updateWishlistButton(productId, !isInWishlist);
            showNotification(data.message, 'success');
        } else {
            showNotification(data.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error toggling wishlist:', error);
        showNotification('Có lỗi xảy ra', 'error');
    }
}

function updateWishlistButton(productId, isInWishlist) {
    const button = document.querySelector(`[data-wishlist-product="${productId}"]`);
    if (button) {
        if (isInWishlist) {
            button.classList.add('active');
            button.innerHTML = '<i class="fas fa-heart"></i> Đã yêu thích';
        } else {
            button.classList.remove('active');
            button.innerHTML = '<i class="far fa-heart"></i> Yêu thích';
        }
    }
}

async function loadWishlistStatus(productId) {
    if (!isLoggedIn()) return;
    
    try {
        const response = await fetch(`/api/wishlist/check/${productId}`);
        const data = await response.json();
        if (data.success) {
            updateWishlistButton(productId, data.in_wishlist);
        }
    } catch (error) {
        console.error('Error loading wishlist status:', error);
    }
}

// ==================== Product Reviews Functions ====================
async function loadProductReviews(productId) {
    try {
        const response = await fetch(`/api/product/${productId}/reviews`);
        const data = await response.json();
        
        if (data.success && data.reviews) {
            displayReviews(data.reviews);
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
    }
}

function displayReviews(reviews) {
    const container = document.getElementById('reviews-container');
    if (!container) return;
    
    if (reviews.length === 0) {
        container.innerHTML = '<p class="no-reviews">Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá!</p>';
        return;
    }
    
    let html = '';
    reviews.forEach(review => {
        const stars = generateStars(review.rating);
        const verifiedBadge = review.is_verified_purchase ? '<span class="verified-badge">✓ Đã mua</span>' : '';
        const date = new Date(review.created_at).toLocaleDateString('vi-VN');
        
        html += `
            <div class="review-item">
                <div class="review-header">
                    <div class="reviewer-info">
                        <strong>${review.customer_name}</strong>
                        ${verifiedBadge}
                    </div>
                    <div class="review-rating">${stars}</div>
                </div>
                ${review.title ? `<h4 class="review-title">${review.title}</h4>` : ''}
                <p class="review-comment">${review.comment}</p>
                ${review.images && review.images.length > 0 ? `
                    <div class="review-images">
                        ${review.images.map(img => `<img src="${img}" alt="Review image" onclick="openImageModal('${img}')">`).join('')}
                    </div>
                ` : ''}
                <div class="review-footer">
                    <span class="review-date">${date}</span>
                    <button class="helpful-btn" onclick="markHelpful(${review.id})">
                        <i class="fas fa-thumbs-up"></i> Hữu ích (${review.helpful_count || 0})
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function generateStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            html += '<i class="fas fa-star"></i>';
        } else if (i - 0.5 <= rating) {
            html += '<i class="fas fa-star-half-alt"></i>';
        } else {
            html += '<i class="far fa-star"></i>';
        }
    }
    return html;
}

async function submitReview(productId) {
    if (!isLoggedIn()) {
        alert('Vui lòng đăng nhập để đánh giá');
        return;
    }
    
    const rating = document.getElementById('review-rating')?.value;
    const title = document.getElementById('review-title')?.value;
    const comment = document.getElementById('review-comment')?.value;
    
    if (!rating || !comment) {
        alert('Vui lòng điền đầy đủ thông tin');
        return;
    }
    
    try {
        const response = await fetch(`/api/product/${productId}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rating: parseInt(rating),
                title: title || '',
                comment: comment,
                images: [] // Có thể thêm upload ảnh sau
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Đánh giá đã được gửi. Cảm ơn bạn!', 'success');
            document.getElementById('review-form')?.reset();
            loadProductReviews(productId);
        } else {
            showNotification(data.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        showNotification('Có lỗi xảy ra', 'error');
    }
}

// ==================== Coupon Functions ====================
let appliedCoupon = null;

async function applyCouponCode() {
    const codeInput = document.getElementById('coupon-code');
    if (!codeInput) {
        console.error('Không tìm thấy coupon-code input');
        alert('Không tìm thấy ô nhập mã giảm giá');
        return;
    }
    
    const code = codeInput.value.trim().toUpperCase();
    
    if (!code) {
        alert('Vui lòng nhập mã giảm giá');
        return;
    }
    
    // Lấy tổng tiền đơn hàng
    const subtotal = getOrderSubtotal();
    
    if (subtotal <= 0) {
        alert('Không thể áp dụng mã giảm giá. Tổng tiền đơn hàng không hợp lệ.');
        return;
    }
    
    console.log('Applying coupon:', code, 'for amount:', subtotal);
    
    try {
        const response = await fetch('/api/coupon/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                order_amount: subtotal
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Coupon response:', data);
        
        if (data.valid) {
            appliedCoupon = data.coupon;
            
            // Hiển thị section applied coupon
            const inputSection = document.getElementById('coupon-input-section');
            const appliedSection = document.getElementById('applied-coupon-section');
            const couponName = document.getElementById('applied-coupon-name');
            
            if (inputSection) inputSection.style.display = 'none';
            if (appliedSection) {
                appliedSection.style.display = 'block';
                if (couponName) couponName.textContent = `${data.coupon.name} - Giảm ${data.discount.toLocaleString('vi-VN')}₫`;
            }
            
            // Cập nhật tổng tiền
            updateOrderSummary(data.discount, data.final_amount);
            showNotification(`Đã áp dụng mã giảm giá: ${code}`, 'success');
            codeInput.value = '';
        } else {
            showNotification(data.message || 'Mã giảm giá không hợp lệ', 'error');
        }
    } catch (error) {
        console.error('Error applying coupon:', error);
        showNotification('Có lỗi xảy ra khi áp dụng mã giảm giá: ' + error.message, 'error');
    }
}

function removeCoupon() {
    appliedCoupon = null;
    const subtotal = getOrderSubtotal();
    
    // Hiển thị lại input section
    const inputSection = document.getElementById('coupon-input-section');
    const appliedSection = document.getElementById('applied-coupon-section');
    
    if (inputSection) inputSection.style.display = 'block';
    if (appliedSection) appliedSection.style.display = 'none';
    
    // Reset tổng tiền
    updateOrderSummary(0, subtotal);
    showNotification('Đã xóa mã giảm giá', 'info');
}

function updateOrderSummary(discount, finalAmount) {
    const discountRow = document.getElementById('coupon-discount-row');
    const discountElement = document.getElementById('coupon-discount');
    const totalElement = document.getElementById('order-total');
    
    // Hiển thị/ẩn dòng giảm giá
    if (discountRow) {
        if (discount > 0) {
            discountRow.style.display = 'flex';
            if (discountElement) {
                discountElement.textContent = `-${discount.toLocaleString('vi-VN')}₫`;
            }
        } else {
            discountRow.style.display = 'none';
        }
    }
    
    // Cập nhật tổng tiền
    if (totalElement) {
        totalElement.textContent = `${finalAmount.toLocaleString('vi-VN')}₫`;
    }
    
    console.log('Updated order summary - Discount:', discount, 'Final:', finalAmount);
}

function getOrderSubtotal() {
    // Lấy tổng tiền từ giỏ hàng hoặc form
    const subtotalElement = document.getElementById('order-subtotal');
    if (subtotalElement) {
        // Lấy text và loại bỏ tất cả ký tự không phải số
        let text = subtotalElement.textContent || subtotalElement.innerText || '';
        // Loại bỏ dấu phẩy, dấu chấm, khoảng trắng và các ký tự khác
        text = text.replace(/[^\d]/g, '');
        const amount = parseInt(text) || 0;
        console.log('Order subtotal:', amount);
        return amount;
    }
    console.warn('Không tìm thấy order-subtotal element');
    return 0;
}

// ==================== Notifications Functions ====================
let notificationCheckInterval = null;

async function loadNotifications() {
    if (!isLoggedIn()) return;
    
    try {
        const response = await fetch('/api/notifications?limit=10');
        const data = await response.json();
        
        if (data.success) {
            displayNotifications(data.notifications);
            updateNotificationBadge(data.unread_count);
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function displayNotifications(notifications) {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = '<p class="no-notifications">Không có thông báo nào</p>';
        return;
    }
    
    let html = '';
    notifications.forEach(notif => {
        const unreadClass = notif.is_read ? '' : 'unread';
        html += `
            <div class="notification-item ${unreadClass}" onclick="openNotification('${notif.link || '#'}')">
                <div class="notification-content">
                    <h4>${notif.title}</h4>
                    <p>${notif.message}</p>
                    <span class="notification-time">${formatTime(notif.created_at)}</span>
                </div>
                ${!notif.is_read ? '<span class="unread-dot"></span>' : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

async function markNotificationRead(notificationId) {
    try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
            method: 'POST'
        });
        
        if (response.ok) {
            loadNotifications();
        }
    } catch (error) {
        console.error('Error marking notification read:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        const response = await fetch('/api/notifications/read-all', {
            method: 'POST'
        });
        
        if (response.ok) {
            loadNotifications();
        }
    } catch (error) {
        console.error('Error marking all read:', error);
    }
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN');
}

function openNotification(link) {
    if (link && link !== '#') {
        window.location.href = link;
    }
}

// ==================== Cart Sync Functions ====================
async function syncCartToDatabase() {
    if (!isLoggedIn()) return;
    
    try {
        const response = await fetch('/api/cart/sync', {
            method: 'POST'
        });
        
        const data = await response.json();
        if (data.success) {
            console.log('Cart synced to database');
        }
    } catch (error) {
        console.error('Error syncing cart:', error);
    }
}

async function loadCartFromDatabase() {
    if (!isLoggedIn()) return;
    
    try {
        const response = await fetch('/api/cart/load');
        const data = await response.json();
        
        if (data.success && data.cart) {
            // Reload cart display
            if (typeof updateCartDisplay === 'function') {
                updateCartDisplay();
            }
        }
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

// ==================== Order History Functions ====================
async function loadOrderHistory(orderId) {
    try {
        const response = await fetch(`/api/order/${orderId}/history`);
        const data = await response.json();
        
        if (data.success && data.history) {
            displayOrderHistory(data.history);
        }
    } catch (error) {
        console.error('Error loading order history:', error);
    }
}

function displayOrderHistory(history) {
    const container = document.getElementById('order-history');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = '<p>Chưa có lịch sử thay đổi</p>';
        return;
    }
    
    const statusMap = {
        'pending': { text: 'Chờ xác nhận', icon: 'clock', color: '#ff9800' },
        'confirmed': { text: 'Đã xác nhận', icon: 'check-circle', color: '#2196f3' },
        'shipping': { text: 'Đang giao hàng', icon: 'truck', color: '#9c27b0' },
        'delivered': { text: 'Đã giao hàng', icon: 'check-double', color: '#4caf50' },
        'cancelled': { text: 'Đã hủy', icon: 'times-circle', color: '#f44336' }
    };
    
    let html = '<div class="order-history-timeline">';
    history.forEach((item, index) => {
        const statusInfo = statusMap[item.status] || { text: item.status, icon: 'circle', color: '#666' };
        const isLast = index === history.length - 1;
        
        html += `
            <div class="history-item ${isLast ? 'current' : ''}">
                <div class="history-icon" style="background: ${statusInfo.color}">
                    <i class="fas fa-${statusInfo.icon}"></i>
                </div>
                <div class="history-content">
                    <h4>${statusInfo.text}</h4>
                    ${item.note ? `<p>${item.note}</p>` : ''}
                    <span class="history-time">${new Date(item.created_at).toLocaleString('vi-VN')}</span>
                    ${item.changed_by ? `<span class="history-by">Bởi: ${item.changed_by}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ==================== Helper Functions ====================
function isLoggedIn() {
    // Kiểm tra xem user đã đăng nhập chưa
    // Có thể check cookie, session, hoặc element trên page
    return document.cookie.includes('customer_logged_in') || 
           document.body.classList.contains('logged-in') ||
           sessionStorage.getItem('customer_email');
}

function showNotification(message, type = 'info') {
    // Tạo notification toast
    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', function() {
    // Load notifications nếu đã đăng nhập
    if (isLoggedIn()) {
        loadNotifications();
        // Check notifications mỗi 30 giây
        notificationCheckInterval = setInterval(loadNotifications, 30000);
        
        // Sync cart khi đăng nhập
        syncCartToDatabase();
    }
    
    // Load wishlist status cho tất cả products trên page
    document.querySelectorAll('[data-wishlist-product]').forEach(btn => {
        const productId = btn.getAttribute('data-wishlist-product');
        loadWishlistStatus(productId);
    });
    
    // Load order history if on order detail page
    const orderId = document.querySelector('[data-order-id]')?.getAttribute('data-order-id');
    if (orderId && typeof loadOrderHistory === 'function') {
        loadOrderHistory(orderId);
    }
});

