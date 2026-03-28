// Toast notification function
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Add to cart function
async function addToCart(productId, quantity = 1) {
    try {
        productId = parseInt(productId);
        quantity = parseInt(quantity) || 1;
        
        if (isNaN(productId) || productId <= 0) {
            showToast('ID sản phẩm không hợp lệ!', 'error');
            return;
        }
        
        const response = await fetch('/api/add-to-cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity
            })
        });
        
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            showToast('Có lỗi xảy ra từ server!', 'error');
            return;
        }
        
        if (!response.ok) {
            const errorMessage = data.message || `Lỗi ${response.status}: ${response.statusText}`;
            showToast(errorMessage, 'error');
            return;
        }
        
        if (data.success) {
            showToast('Đã thêm sản phẩm vào giỏ hàng!', 'success');
            if (data.cart_count !== undefined) {
                updateCartCount(data.cart_count);
            }
        } else {
            showToast(data.message || 'Có lỗi xảy ra!', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Có lỗi xảy ra! Vui lòng thử lại.', 'error');
    }
}

// Remove from cart
async function removeFromCart(productId) {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/remove-from-cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product_id: productId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Đã xóa sản phẩm khỏi giỏ hàng', 'success');
            location.reload();
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Có lỗi xảy ra!', 'error');
    }
}

// Update cart quantity
async function updateCartQuantity(productId, quantity) {
    try {
        const response = await fetch('/api/update-cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            location.reload();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Update cart count in header
function updateCartCount(count) {
    const cartCountElement = document.querySelector('.cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = count;
        // Thêm animation khi cập nhật
        cartCountElement.style.transform = 'scale(1.3)';
        setTimeout(() => {
            cartCountElement.style.transform = 'scale(1)';
        }, 200);
    }
}

// Quantity selector for product detail page
function initQuantitySelector() {
    const minusBtn = document.querySelector('.quantity-minus');
    const plusBtn = document.querySelector('.quantity-plus');
    const quantityInput = document.querySelector('.quantity-input');
    
    if (minusBtn && plusBtn && quantityInput) {
        minusBtn.addEventListener('click', () => {
            const currentValue = parseInt(quantityInput.value) || 1;
            if (currentValue > 1) {
                quantityInput.value = currentValue - 1;
            }
        });
        
        plusBtn.addEventListener('click', () => {
            const currentValue = parseInt(quantityInput.value) || 1;
            quantityInput.value = currentValue + 1;
        });
    }
}

// Search functionality
function initSearch() {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const searchTerm = searchInput.value;
                window.location.href = `/products?search=${encodeURIComponent(searchTerm)}`;
            }
        });
    }
}

// Category filter
function filterByCategory(category) {
    window.location.href = `/products?category=${encodeURIComponent(category)}`;
}

// Smooth scroll
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            // Bỏ qua nếu href chỉ là "#" hoặc rỗng
            if (!href || href === '#' || href.length <= 1) {
                return;
            }
            
            e.preventDefault();
            try {
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            } catch (error) {
                // Bỏ qua lỗi nếu selector không hợp lệ
                console.warn('Invalid selector for smooth scroll:', href);
            }
        });
    });
}

// Initialize animations on scroll
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, {
        threshold: 0.1
    });
    
    document.querySelectorAll('.product-card, .feature-card').forEach(el => {
        observer.observe(el);
    });
}

// Initialize dropdowns for mobile
function initDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
        const dropbtn = dropdown.querySelector('.dropbtn');
        if (!dropbtn) return;
        
        // Xử lý click trên mobile/tablet
        dropbtn.addEventListener('click', function(e) {
            // Chỉ xử lý trên mobile/tablet (màn hình < 1024px)
            if (window.innerWidth < 1024) {
                e.preventDefault();
                e.stopPropagation();
                
                // Đóng các dropdown khác
                dropdowns.forEach(otherDropdown => {
                    if (otherDropdown !== dropdown) {
                        otherDropdown.classList.remove('active');
                    }
                });
                
                // Toggle dropdown hiện tại
                dropdown.classList.toggle('active');
            }
        });
    });
    
    // Đóng dropdown khi click bên ngoài
    document.addEventListener('click', function(e) {
        if (window.innerWidth < 1024) {
            if (!e.target.closest('.dropdown')) {
                dropdowns.forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            }
        }
    });
}

// Initialize all functions when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initQuantitySelector();
    initSearch();
    initSmoothScroll();
    initScrollAnimations();
    initDropdowns();
});

// Make functions globally available
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartQuantity = updateCartQuantity;
window.filterByCategory = filterByCategory;
