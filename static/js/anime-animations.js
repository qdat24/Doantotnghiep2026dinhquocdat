/**
 * Anime.js CSS Animations Integration
 * Tích hợp Anime.js với CSS để tạo các animation mượt mà
 * 
 * Anime.js có thể animate các thuộc tính CSS như:
 * - transform (translateX, translateY, scale, rotate)
 * - opacity
 * - color, backgroundColor
 * - width, height
 * - borderRadius
 * - boxShadow
 * - và nhiều thuộc tính CSS khác
 */

// Khởi tạo animations khi DOM đã load
document.addEventListener('DOMContentLoaded', function() {
    initAnimeAnimations();
});

/**
 * Khởi tạo tất cả animations với Anime.js
 */
function initAnimeAnimations() {
    // Animation cho hero section
    animateHeroSection();
    
    // Animation cho product cards khi scroll
    animateProductCards();
    
    // Animation cho category items
    animateCategoryItems();
    
    // Animation cho buttons khi hover
    animateButtons();
    
    // Animation cho cart count khi thay đổi
    animateCartCount();
}

/**
 * Animation cho Hero Section
 * Animate các phần tử trong hero với CSS properties
 */
function animateHeroSection() {
    const heroTitle = document.querySelector('.hero-modern h1');
    const heroSubtitle = document.querySelector('.hero-modern p');
    const heroButtons = document.querySelector('.hero-buttons');
    
    if (heroTitle) {
        anime({
            targets: heroTitle,
            opacity: [0, 1],
            translateY: [-50, 0],
            duration: 1000,
            easing: 'easeOutExpo',
            delay: 200
        });
    }
    
    if (heroSubtitle) {
        anime({
            targets: heroSubtitle,
            opacity: [0, 1],
            translateY: [30, 0],
            duration: 800,
            easing: 'easeOutExpo',
            delay: 400
        });
    }
    
    if (heroButtons) {
        anime({
            targets: heroButtons,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 800,
            easing: 'easeOutExpo',
            delay: 600
        });
    }
}

/**
 * Animation cho Product Cards khi scroll vào view
 * Sử dụng Intersection Observer kết hợp với Anime.js
 */
function animateProductCards() {
    const productCards = document.querySelectorAll('.product-new');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Animate CSS properties với Anime.js
                anime({
                    targets: entry.target,
                    opacity: [0, 1],
                    translateY: [50, 0],
                    scale: [0.9, 1],
                    duration: 600,
                    delay: index * 100,
                    easing: 'easeOutExpo'
                });
                
                // Không cần observe nữa sau khi đã animate
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    
    productCards.forEach(card => observer.observe(card));
}

/**
 * Animation cho Category Items
 * Animate khi hover và khi load
 */
function animateCategoryItems() {
    const categoryItems = document.querySelectorAll('.cat-item');
    
    categoryItems.forEach((item, index) => {
        // Animation khi load
        anime({
            targets: item,
            opacity: [0, 1],
            translateX: [-30, 0],
            duration: 500,
            delay: index * 100,
            easing: 'easeOutExpo'
        });
        
        // Animation khi hover - sử dụng CSS transform
        item.addEventListener('mouseenter', function() {
            anime({
                targets: this,
                translateY: -12,
                scale: 1.02,
                duration: 300,
                easing: 'easeOutQuad'
            });
            
            // Animate icon bên trong
            const icon = this.querySelector('.cat-icon');
            if (icon) {
                anime({
                    targets: icon,
                    rotate: 8,
                    scale: 1.15,
                    duration: 300,
                    easing: 'easeOutQuad'
                });
            }
        });
        
        item.addEventListener('mouseleave', function() {
            anime({
                targets: this,
                translateY: 0,
                scale: 1,
                duration: 300,
                easing: 'easeOutQuad'
            });
            
            const icon = this.querySelector('.cat-icon');
            if (icon) {
                anime({
                    targets: icon,
                    rotate: 0,
                    scale: 1,
                    duration: 300,
                    easing: 'easeOutQuad'
                });
            }
        });
    });
}

/**
 * Animation cho Buttons
 * Animate khi click và hover
 */
function animateButtons() {
    const buttons = document.querySelectorAll('.btn');
    
    buttons.forEach(button => {
        // Animation khi click
        button.addEventListener('click', function(e) {
            anime({
                targets: this,
                scale: [1, 0.95, 1],
                duration: 200,
                easing: 'easeInOutQuad'
            });
        });
        
        // Animation khi hover
        button.addEventListener('mouseenter', function() {
            anime({
                targets: this,
                translateY: -3,
                boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                duration: 300,
                easing: 'easeOutQuad'
            });
        });
        
        button.addEventListener('mouseleave', function() {
            anime({
                targets: this,
                translateY: 0,
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                duration: 300,
                easing: 'easeOutQuad'
            });
        });
    });
}

/**
 * Animation cho Cart Count
 * Animate khi số lượng giỏ hàng thay đổi
 */
function animateCartCount() {
    const cartCountElement = document.querySelector('.cart-count');
    
    if (cartCountElement) {
        // Override hàm updateCartCount trong main.js để sử dụng Anime.js
        const originalUpdateCartCount = window.updateCartCount;
        
        window.updateCartCount = function(count) {
            if (cartCountElement) {
                // Animate số lượng thay đổi
                anime({
                    targets: cartCountElement,
                    scale: [1, 1.5, 1],
                    rotate: [0, 360],
                    duration: 600,
                    easing: 'easeOutElastic(1, .8)'
                });
                
                // Update text sau khi animation bắt đầu
                setTimeout(() => {
                    cartCountElement.textContent = count;
                }, 100);
            }
        };
    }
}

/**
 * Animation cho Product Images khi hover
 * Scale và rotate image
 */
function animateProductImages() {
    const productImages = document.querySelectorAll('.prod-img-wrap img');
    
    productImages.forEach(img => {
        const wrap = img.closest('.prod-img-wrap');
        
        wrap.addEventListener('mouseenter', function() {
            anime({
                targets: img,
                scale: 1.1,
                rotate: [0, 2],
                duration: 500,
                easing: 'easeOutQuad'
            });
        });
        
        wrap.addEventListener('mouseleave', function() {
            anime({
                targets: img,
                scale: 1,
                rotate: 0,
                duration: 500,
                easing: 'easeOutQuad'
            });
        });
    });
}

/**
 * Animation cho Search Input khi focus
 */
function animateSearchInput() {
    const searchInput = document.querySelector('.search-box-new input');
    
    if (searchInput) {
        searchInput.addEventListener('focus', function() {
            anime({
                targets: this,
                scale: [1, 1.02],
                translateY: -2,
                boxShadow: '0 0 0 4px rgba(157, 184, 146, 0.3)',
                duration: 300,
                easing: 'easeOutQuad'
            });
        });
        
        searchInput.addEventListener('blur', function() {
            anime({
                targets: this,
                scale: 1,
                translateY: 0,
                boxShadow: '0 0 0 0px rgba(157, 184, 146, 0)',
                duration: 300,
                easing: 'easeOutQuad'
            });
        });
    }
}

/**
 * Animation cho Testimonial Cards
 */
function animateTestimonials() {
    const testimonialCards = document.querySelectorAll('.testi-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                anime({
                    targets: entry.target,
                    opacity: [0, 1],
                    translateY: [30, 0],
                    rotateX: [15, 0],
                    duration: 800,
                    delay: index * 150,
                    easing: 'easeOutExpo'
                });
                
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2
    });
    
    testimonialCards.forEach(card => observer.observe(card));
}

/**
 * Animation cho Promo Boxes
 */
function animatePromoBoxes() {
    const promoBoxes = document.querySelectorAll('.promo-box');
    
    promoBoxes.forEach((box, index) => {
        // Animation khi load
        anime({
            targets: box,
            opacity: [0, 1],
            scale: [0.8, 1],
            rotateY: [45, 0],
            duration: 800,
            delay: index * 200,
            easing: 'easeOutExpo'
        });
        
        // Animation khi hover
        box.addEventListener('mouseenter', function() {
            anime({
                targets: this,
                translateY: -8,
                scale: 1.02,
                rotateZ: [0, 2, -2, 0],
                duration: 400,
                easing: 'easeOutQuad'
            });
        });
        
        box.addEventListener('mouseleave', function() {
            anime({
                targets: this,
                translateY: 0,
                scale: 1,
                rotateZ: 0,
                duration: 400,
                easing: 'easeOutQuad'
            });
        });
    });
}

/**
 * Animation cho Feature Items
 */
function animateFeatureItems() {
    const featureItems = document.querySelectorAll('.feat-item');
    
    featureItems.forEach((item, index) => {
        // Animation khi load
        anime({
            targets: item,
            opacity: [0, 1],
            translateX: [-20, 0],
            duration: 500,
            delay: index * 100,
            easing: 'easeOutExpo'
        });
        
        // Animation khi hover
        item.addEventListener('mouseenter', function() {
            anime({
                targets: this,
                translateX: 8,
                duration: 300,
                easing: 'easeOutQuad'
            });
            
            const icon = this.querySelector('.feat-icon');
            if (icon) {
                anime({
                    targets: icon,
                    rotate: 5,
                    scale: 1.1,
                    duration: 300,
                    easing: 'easeOutQuad'
                });
            }
        });
        
        item.addEventListener('mouseleave', function() {
            anime({
                targets: this,
                translateX: 0,
                duration: 300,
                easing: 'easeOutQuad'
            });
            
            const icon = this.querySelector('.feat-icon');
            if (icon) {
                anime({
                    targets: icon,
                    rotate: 0,
                    scale: 1,
                    duration: 300,
                    easing: 'easeOutQuad'
                });
            }
        });
    });
}

/**
 * Animation cho Cart Page
 */
function animateCartPage() {
    // Animate cart items khi load
    const cartItems = document.querySelectorAll('.cart-item');
    cartItems.forEach((item, index) => {
        anime({
            targets: item,
            opacity: [0, 1],
            translateX: [-30, 0],
            duration: 500,
            delay: index * 100,
            easing: 'easeOutExpo'
        });
    });
    
    // Animate cart steps
    const steps = document.querySelectorAll('.step');
    steps.forEach((step, index) => {
        anime({
            targets: step,
            opacity: [0, 1],
            scale: [0.8, 1],
            duration: 400,
            delay: index * 150,
            easing: 'easeOutExpo'
        });
    });
    
    // Animate remove button khi hover
    const removeButtons = document.querySelectorAll('.remove-item-btn');
    removeButtons.forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            anime({
                targets: this,
                scale: 1.1,
                rotate: 5,
                duration: 200,
                easing: 'easeOutQuad'
            });
        });
        
        btn.addEventListener('mouseleave', function() {
            anime({
                targets: this,
                scale: 1,
                rotate: 0,
                duration: 200,
                easing: 'easeOutQuad'
            });
        });
    });
}

/**
 * Animation cho Product Detail Page
 */
function animateProductDetail() {
    // Animate product image
    const productImage = document.querySelector('.product-image-large');
    if (productImage) {
        anime({
            targets: productImage,
            opacity: [0, 1],
            scale: [0.9, 1],
            duration: 800,
            easing: 'easeOutExpo'
        });
    }
    
    // Animate product info
    const productInfo = document.querySelector('.product-detail-info');
    if (productInfo) {
        anime({
            targets: productInfo,
            opacity: [0, 1],
            translateX: [30, 0],
            duration: 800,
            delay: 200,
            easing: 'easeOutExpo'
        });
    }
    
    // Animate quantity selector
    const quantityInput = document.querySelector('.quantity-input');
    if (quantityInput) {
        quantityInput.addEventListener('focus', function() {
            anime({
                targets: this,
                scale: 1.05,
                borderColor: '#9db892',
                duration: 300,
                easing: 'easeOutQuad'
            });
        });
        
        quantityInput.addEventListener('blur', function() {
            anime({
                targets: this,
                scale: 1,
                borderColor: '#e0e0e0',
                duration: 300,
                easing: 'easeOutQuad'
            });
        });
    }
    
    // Animate add to cart button
    const addToCartBtn = document.querySelector('.add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', function() {
            anime({
                targets: this,
                scale: [1, 0.95, 1],
                duration: 200,
                easing: 'easeInOutQuad'
            });
        });
    }
}

/**
 * Animation cho Checkout Page
 */
function animateCheckoutPage() {
    // Animate form sections
    const formSections = document.querySelectorAll('.checkout-section, .form-section');
    formSections.forEach((section, index) => {
        anime({
            targets: section,
            opacity: [0, 1],
            translateY: [30, 0],
            duration: 600,
            delay: index * 150,
            easing: 'easeOutExpo'
        });
    });
    
    // Animate input fields khi focus
    const inputs = document.querySelectorAll('.checkout-section input, .checkout-section select, .checkout-section textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            anime({
                targets: this,
                scale: 1.02,
                borderColor: '#9db892',
                duration: 300,
                easing: 'easeOutQuad'
            });
        });
        
        input.addEventListener('blur', function() {
            anime({
                targets: this,
                scale: 1,
                borderColor: '#e0e0e0',
                duration: 300,
                easing: 'easeOutQuad'
            });
        });
    });
}

/**
 * Animation cho Admin Pages
 */
function animateAdminPages() {
    // Animate sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        anime({
            targets: sidebar,
            translateX: [-300, 0],
            opacity: [0, 1],
            duration: 500,
            easing: 'easeOutExpo'
        });
    }
    
    // Animate dashboard cards
    const dashboardCards = document.querySelectorAll('.dashboard-card, .stat-card');
    dashboardCards.forEach((card, index) => {
        anime({
            targets: card,
            opacity: [0, 1],
            translateY: [30, 0],
            scale: [0.9, 1],
            duration: 600,
            delay: index * 100,
            easing: 'easeOutExpo'
        });
    });
    
    // Animate table rows
    const tableRows = document.querySelectorAll('table tbody tr');
    tableRows.forEach((row, index) => {
        anime({
            targets: row,
            opacity: [0, 1],
            translateX: [-20, 0],
            duration: 400,
            delay: index * 50,
            easing: 'easeOutExpo'
        });
    });
    
    // Animate admin buttons
    const adminButtons = document.querySelectorAll('.admin-btn, .btn-primary, .btn-danger');
    adminButtons.forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            anime({
                targets: this,
                scale: 1.05,
                translateY: -2,
                duration: 200,
                easing: 'easeOutQuad'
            });
        });
        
        btn.addEventListener('mouseleave', function() {
            anime({
                targets: this,
                scale: 1,
                translateY: 0,
                duration: 200,
                easing: 'easeOutQuad'
            });
        });
    });
}

/**
 * Animation cho Customer Pages (Login, Register, Account)
 */
function animateCustomerPages() {
    // Animate form containers
    const formContainers = document.querySelectorAll('.login-container, .register-container, .account-container');
    formContainers.forEach(container => {
        anime({
            targets: container,
            opacity: [0, 1],
            scale: [0.95, 1],
            duration: 600,
            easing: 'easeOutExpo'
        });
    });
    
    // Animate form inputs
    const formInputs = document.querySelectorAll('.form-group input, .form-group select, .form-group textarea');
    formInputs.forEach((input, index) => {
        anime({
            targets: input,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 400,
            delay: index * 50,
            easing: 'easeOutExpo'
        });
    });
    
    // Animate submit buttons
    const submitButtons = document.querySelectorAll('.btn-submit, button[type="submit"]');
    submitButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            anime({
                targets: this,
                scale: [1, 0.95, 1],
                duration: 200,
                easing: 'easeInOutQuad'
            });
        });
    });
}

/**
 * Animation cho Landing Page
 */
function animateLandingPage() {
    const mainCard = document.querySelector('.main-card');
    if (mainCard) {
        anime({
            targets: mainCard,
            opacity: [0, 1],
            translateY: [50, 0],
            scale: [0.9, 1],
            duration: 1000,
            easing: 'easeOutExpo'
        });
    }
    
    const logoIcon = document.querySelector('.logo-icon');
    if (logoIcon) {
        anime({
            targets: logoIcon,
            scale: [0, 1],
            rotate: [0, 360],
            duration: 800,
            delay: 200,
            easing: 'easeOutElastic(1, .8)'
        });
    }
    
    const featureItems = document.querySelectorAll('.feature-item');
    featureItems.forEach((item, index) => {
        anime({
            targets: item,
            opacity: [0, 1],
            translateY: [30, 0],
            duration: 600,
            delay: 400 + (index * 100),
            easing: 'easeOutExpo'
        });
    });
    
    const enterButton = document.querySelector('.btn-enter');
    if (enterButton) {
        anime({
            targets: enterButton,
            opacity: [0, 1],
            scale: [0.8, 1],
            duration: 600,
            delay: 800,
            easing: 'easeOutElastic(1, .8)'
        });
    }
}

/**
 * Animation cho Maintenance Page
 */
function animateMaintenancePage() {
    const maintenanceContainer = document.querySelector('.maintenance-container');
    if (maintenanceContainer) {
        anime({
            targets: maintenanceContainer,
            opacity: [0, 1],
            translateY: [50, 0],
            scale: [0.9, 1],
            duration: 800,
            easing: 'easeOutExpo'
        });
    }
    
    const maintenanceIcon = document.querySelector('.maintenance-icon');
    if (maintenanceIcon) {
        anime({
            targets: maintenanceIcon,
            scale: [0, 1],
            rotate: [0, 360],
            duration: 1000,
            delay: 200,
            easing: 'easeOutElastic(1, .8)'
        });
    }
    
    // Animate floating shapes
    const shapes = document.querySelectorAll('.shape');
    shapes.forEach((shape, index) => {
        anime({
            targets: shape,
            translateX: function() {
                return anime.random(-50, 50);
            },
            translateY: function() {
                return anime.random(-50, 50);
            },
            rotate: function() {
                return anime.random(0, 360);
            },
            duration: 20000,
            delay: index * 2000,
            easing: 'linear',
            loop: true
        });
    });
}

/**
 * Animation cho các trang khác (About, Contact, FAQ, etc.)
 */
function animateOtherPages() {
    // Animate section headers
    const sectionHeaders = document.querySelectorAll('section h1, section h2, .section-head h2');
    sectionHeaders.forEach((header, index) => {
        anime({
            targets: header,
            opacity: [0, 1],
            translateY: [-30, 0],
            duration: 600,
            delay: index * 100,
            easing: 'easeOutExpo'
        });
    });
    
    // Animate content blocks
    const contentBlocks = document.querySelectorAll('.content-block, .info-card, .faq-item');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                anime({
                    targets: entry.target,
                    opacity: [0, 1],
                    translateY: [30, 0],
                    duration: 600,
                    delay: index * 100,
                    easing: 'easeOutExpo'
                });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    contentBlocks.forEach(block => observer.observe(block));
}

// Gọi các animation functions dựa trên trang hiện tại
document.addEventListener('DOMContentLoaded', function() {
    // Detect current page
    const path = window.location.pathname;
    
    // Common animations cho tất cả trang
    animateProductImages();
    animateSearchInput();
    animateTestimonials();
    animatePromoBoxes();
    animateFeatureItems();
    animateButtons();
    animateOtherPages();
    
    // Page-specific animations
    if (path.includes('/cart')) {
        animateCartPage();
    }
    
    if (path.includes('/product/') || path.includes('/products')) {
        animateProductDetail();
    }
    
    if (path.includes('/checkout')) {
        animateCheckoutPage();
    }
    
    if (path.includes('/admin')) {
        animateAdminPages();
    }
    
    if (path.includes('/login') || path.includes('/register') || path.includes('/account') || path.includes('/customer')) {
        animateCustomerPages();
    }
    
    if (path === '/landing' || path === '/') {
        // Check if it's landing page
        if (document.querySelector('.main-card')) {
            animateLandingPage();
        }
    }
    
    if (path.includes('/maintenance')) {
        animateMaintenancePage();
    }
});

/**
 * Utility function: Animate bất kỳ element nào với CSS properties
 * 
 * @param {string|Element} selector - CSS selector hoặc DOM element
 * @param {object} properties - Object chứa CSS properties cần animate
 * @param {object} options - Options cho animation (duration, delay, easing, etc.)
 * 
 * @example
 * animateCSS('.my-element', {
 *     opacity: [0, 1],
 *     translateY: [-50, 0],
 *     scale: [0.8, 1]
 * }, {
 *     duration: 1000,
 *     delay: 200,
 *     easing: 'easeOutExpo'
 * });
 */
function animateCSS(selector, properties, options = {}) {
    const defaultOptions = {
        duration: 800,
        delay: 0,
        easing: 'easeOutExpo'
    };
    
    const config = Object.assign({}, defaultOptions, options, {
        targets: selector,
        ...properties
    });
    
    return anime(config);
}

// Export function để sử dụng ở nơi khác
window.animateCSS = animateCSS;
window.initAnimeAnimations = initAnimeAnimations;
