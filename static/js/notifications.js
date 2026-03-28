// ============================================
// NOTIFICATIONS DROPDOWN
// ============================================

function toggleNotifications() {
    const panel = document.getElementById('notifications-panel');
    if (panel) {
        if (panel.style.display === 'none' || !panel.classList.contains('show')) {
            panel.style.display = 'block';
            panel.classList.add('show');
            loadNotifications();
        } else {
            panel.style.display = 'none';
            panel.classList.remove('show');
        }
    }
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        const data = await response.json();
        
        const listContainer = document.getElementById('notifications-list');
        const badge = document.getElementById('notification-badge');
        
        if (!listContainer) return;
        
        if (data.success && data.notifications && data.notifications.length > 0) {
            let html = '';
            let unreadCount = 0;
            
            data.notifications.forEach(notification => {
                if (!notification.is_read) unreadCount++;
                
                const timeAgo = getTimeAgo(notification.created_at);
                const link = notification.link || '#';
                
                html += `
                    <div class="notification-item ${notification.is_read ? '' : 'unread'}" 
                         onclick="window.location.href='${link}'" 
                         style="cursor: pointer;">
                        <div class="notification-content">
                            <div class="notification-title">${escapeHtml(notification.title)}</div>
                            <div class="notification-message">${escapeHtml(notification.message)}</div>
                            <div class="notification-time">${timeAgo}</div>
                        </div>
                        ${!notification.is_read ? '<div class="unread-dot"></div>' : ''}
                    </div>
                `;
            });
            
            listContainer.innerHTML = html;
            
            // Update badge
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.style.display = 'block';
                } else {
                    badge.style.display = 'none';
                }
            }
        } else {
            listContainer.innerHTML = '<p class="no-notifications">Chưa có thông báo nào</p>';
            if (badge) badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        const listContainer = document.getElementById('notifications-list');
        if (listContainer) {
            listContainer.innerHTML = '<p class="no-notifications">Có lỗi khi tải thông báo</p>';
        }
    }
}

async function markAllNotificationsRead() {
    try {
        const response = await fetch('/api/notifications/read-all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        if (data.success) {
            loadNotifications(); // Reload to update UI
        }
    } catch (error) {
        console.error('Error marking all as read:', error);
    }
}

function getTimeAgo(dateString) {
    if (!dateString) return '';
    
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    // Format date
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load notifications on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const notificationIcon = document.querySelector('.notification-icon');
    if (notificationIcon) {
        // Load notifications count on page load
        loadNotifications();
        
        // Auto-refresh notifications every 30 seconds
        setInterval(loadNotifications, 30000);
    }
});

// Close notifications when clicking outside
document.addEventListener('click', function(event) {
    const panel = document.getElementById('notifications-panel');
    const icon = document.querySelector('.notification-icon');
    
    if (panel && icon && !panel.contains(event.target) && !icon.contains(event.target)) {
        panel.style.display = 'none';
        panel.classList.remove('show');
    }
});


// ============================================

function toggleNotifications() {
    const panel = document.getElementById('notifications-panel');
    if (panel) {
        if (panel.style.display === 'none' || !panel.classList.contains('show')) {
            panel.style.display = 'block';
            panel.classList.add('show');
            loadNotifications();
        } else {
            panel.style.display = 'none';
            panel.classList.remove('show');
        }
    }
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        const data = await response.json();
        
        const listContainer = document.getElementById('notifications-list');
        const badge = document.getElementById('notification-badge');
        
        if (!listContainer) return;
        
        if (data.success && data.notifications && data.notifications.length > 0) {
            let html = '';
            let unreadCount = 0;
            
            data.notifications.forEach(notification => {
                if (!notification.is_read) unreadCount++;
                
                const timeAgo = getTimeAgo(notification.created_at);
                const link = notification.link || '#';
                
                html += `
                    <div class="notification-item ${notification.is_read ? '' : 'unread'}" 
                         onclick="window.location.href='${link}'" 
                         style="cursor: pointer;">
                        <div class="notification-content">
                            <div class="notification-title">${escapeHtml(notification.title)}</div>
                            <div class="notification-message">${escapeHtml(notification.message)}</div>
                            <div class="notification-time">${timeAgo}</div>
                        </div>
                        ${!notification.is_read ? '<div class="unread-dot"></div>' : ''}
                    </div>
                `;
            });
            
            listContainer.innerHTML = html;
            
            // Update badge
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.style.display = 'block';
                } else {
                    badge.style.display = 'none';
                }
            }
        } else {
            listContainer.innerHTML = '<p class="no-notifications">Chưa có thông báo nào</p>';
            if (badge) badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        const listContainer = document.getElementById('notifications-list');
        if (listContainer) {
            listContainer.innerHTML = '<p class="no-notifications">Có lỗi khi tải thông báo</p>';
        }
    }
}

async function markAllNotificationsRead() {
    try {
        const response = await fetch('/api/notifications/read-all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        if (data.success) {
            loadNotifications(); // Reload to update UI
        }
    } catch (error) {
        console.error('Error marking all as read:', error);
    }
}

function getTimeAgo(dateString) {
    if (!dateString) return '';
    
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    // Format date
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load notifications on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const notificationIcon = document.querySelector('.notification-icon');
    if (notificationIcon) {
        // Load notifications count on page load
        loadNotifications();
        
        // Auto-refresh notifications every 30 seconds
        setInterval(loadNotifications, 30000);
    }
});

// Close notifications when clicking outside
document.addEventListener('click', function(event) {
    const panel = document.getElementById('notifications-panel');
    const icon = document.querySelector('.notification-icon');
    
    if (panel && icon && !panel.contains(event.target) && !icon.contains(event.target)) {
        panel.style.display = 'none';
        panel.classList.remove('show');
    }
});

