// Toast notification function
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
  
  // Add to cart function
  async function addToCart(productId, quantity = 1, variantInfo = null) {
    try {
      productId = parseInt(productId);
      quantity  = parseInt(quantity) || 1;
  
      if (isNaN(productId) || productId <= 0) {
        showToast('ID sản phẩm không hợp lệ!', 'error');
        return;
      }
  
      // Lấy variant đã chọn từ trang detail (nếu có)
      if (!variantInfo && window._getSelectedVariants) {
        variantInfo = window._getSelectedVariants();
      }
  
      const body = { product_id: productId, quantity: quantity };
      if (variantInfo) body.variant_info = variantInfo;
  
      const response = await fetch('/api/add-to-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      });
  
      const contentType = response.headers.get('content-type');
      let data;
  
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        showToast('Có lỗi xảy ra từ server!', 'error');
        return;
      }
  
      if (!response.ok) {
        showToast(data.message || `Lỗi ${response.status}`, 'error');
        return;
      }
  
      if (data.success) {
        showToast('Đã thêm sản phẩm vào giỏ hàng!', 'success');
        if (data.cart_count !== undefined) {
          updateCartCount(data.cart_count);
        } else {
          const cur = parseInt(
            document.querySelector('#cartBadge, .dqd-cart-badge, .cart-count')?.textContent || '0', 10
          );
          updateCartCount(cur + quantity);
        }
        showMiniCart(productId);
      } else {
        showToast(data.message || 'Có lỗi xảy ra!', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Có lỗi xảy ra! Vui lòng thử lại.', 'error');
    }
  }
  
  // Remove from cart
  function removeFromCart(productId) {
    const row = document.querySelector(
      '[data-product-id="' + productId + '"], [data-cart-product="' + productId + '"]'
    );
    const qty = parseInt(row && row.querySelector('.qty-input, input[type="number"]') &&
      row.querySelector('.qty-input, input[type="number"]').value || 1, 10);
  
    // Dùng custom modal nếu cart.html đã tạo, fallback modal riêng
    function doRemove() {
      fetch('/api/remove-from-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          showToast('Đã xóa sản phẩm khỏi giỏ hàng', 'success');
          if (row) {
            row.style.transition = 'opacity .2s ease, transform .2s ease';
            row.style.opacity = '0';
            row.style.transform = 'translateX(20px)';
            setTimeout(function() { row.remove(); }, 220);
          }
          if (data.cart_count !== undefined) {
            updateCartCount(data.cart_count);
          } else {
            var cur = parseInt(
              (document.querySelector('#cartBadge, .dqd-cart-badge, .cart-count') || {}).textContent || '0', 10
            );
            updateCartCount(Math.max(0, cur - qty));
          }
          var remaining = document.querySelectorAll('[data-product-id], [data-cart-product]').length - 1;
          if (remaining <= 0) setTimeout(function() { location.reload(); }, 400);
        } else {
          showToast(data.message || 'Có lỗi xảy ra!', 'error');
        }
      })
      .catch(function() { showToast('Có lỗi xảy ra!', 'error'); });
    }
  
    // Ưu tiên _cartConfirm (cart.html) nếu có, fallback modal riêng
    if (typeof _cartConfirm === 'function') {
      _cartConfirm('Bạn có chắc muốn xóa sản phẩm này không?', doRemove);
      return;
    }
  
    // Fallback: custom modal nhỏ gọn
    _showRemoveModal('Bạn có chắc muốn xóa sản phẩm này không?', doRemove);
  }
  
  function _showRemoveModal(msg, cb) {
    var existing = document.getElementById('_rmModal');
    if (existing) existing.remove();
  
    var m = document.createElement('div');
    m.id = '_rmModal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
    m.innerHTML =
      '<div style="background:#fff;border-radius:16px;max-width:360px;width:100%;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.22);animation:_rmPop .22s cubic-bezier(.22,.68,0,1.2)">'
      + '<div style="padding:1.5rem 1.5rem 1.25rem;text-align:center;border-bottom:1.5px solid #f0ede8">'
      + '<div style="width:44px;height:44px;border-radius:50%;background:#fff5f5;display:flex;align-items:center;justify-content:center;margin:0 auto .75rem">'
      + '<svg viewBox="0 0 24 24" fill="none" style="width:22px;height:22px;color:#dc2626"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11v4M14 11v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
      + '</div>'
      + '<div style="font-size:.9375rem;font-weight:700;color:#1a1a18;margin-bottom:.3rem">Xóa sản phẩm</div>'
      + '<div style="font-size:.8125rem;color:#7a7060;line-height:1.6">' + msg + '</div>'
      + '</div>'
      + '<div style="padding:1rem 1.5rem;display:flex;gap:.625rem">'
      + '<button id="_rmCancel" style="flex:1;padding:.7rem;background:#f5f4f1;border:1.5px solid #e8e3db;border-radius:9px;font-family:inherit;font-size:.875rem;font-weight:600;color:#7a7060;cursor:pointer">Không</button>'
      + '<button id="_rmConfirm" style="flex:1;padding:.7rem;background:#dc2626;border:none;border-radius:9px;font-family:inherit;font-size:.875rem;font-weight:600;color:#fff;cursor:pointer">Xóa bỏ</button>'
      + '</div>'
      + '</div>';
  
    var st = document.createElement('style');
    st.textContent = '@keyframes _rmPop{from{opacity:0;transform:scale(.92) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}';
    document.head.appendChild(st);
    document.body.appendChild(m);
    document.body.style.overflow = 'hidden';
  
    function close() { m.remove(); document.body.style.overflow = ''; }
    document.getElementById('_rmCancel').onclick = close;
    document.getElementById('_rmConfirm').onclick = function() { close(); cb(); };
    m.addEventListener('click', function(e) { if (e.target === m) close(); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
    });
  }
  
  // Update cart quantity
  async function updateCartQuantity(productId, quantity) {
    try {
      const response = await fetch('/api/update-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, quantity: quantity })
      });
      const data = await response.json();
      if (data.success) location.reload();
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  // Update cart count in header
  function updateCartCount(count) {
    count = parseInt(count, 10) || 0;
  
    const badge = document.getElementById('cartBadge')
               || document.querySelector('.dqd-cart-badge')
               || document.querySelector('.cart-count');
  
    if (!badge) {
      console.warn('[Cart] Badge element not found.');
      return;
    }
  
    if (count > 0) {
      badge.textContent    = count > 99 ? '99+' : String(count);
      badge.style.display  = 'flex';
    } else {
      badge.textContent    = '';
      badge.style.display  = 'none';
    }
  
    badge.style.transform = 'scale(1.4)';
    setTimeout(() => { badge.style.transform = 'scale(1)'; }, 200);
  }
  
  // Quantity selector
  function initQuantitySelector() {
    const minusBtn      = document.querySelector('.quantity-minus');
    const plusBtn       = document.querySelector('.quantity-plus');
    const quantityInput = document.querySelector('.quantity-input');
    if (!minusBtn || !plusBtn || !quantityInput) return;
  
    minusBtn.addEventListener('click', () => {
      const v = parseInt(quantityInput.value) || 1;
      if (v > 1) quantityInput.value = v - 1;
    });
  
    plusBtn.addEventListener('click', () => {
      const v   = parseInt(quantityInput.value) || 1;
      const max = parseInt(quantityInput.getAttribute('max'), 10) || 999;
      quantityInput.value = Math.min(max, v + 1);
    });
  }
  
  // Search
  function initSearch() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput) return;
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.location.href = `/products?search=${encodeURIComponent(searchInput.value)}`;
      }
    });
  }
  
  // Category filter
  function filterByCategory(category) {
    window.location.href = `/products?category=${encodeURIComponent(category)}`;
  }
  
  // Smooth scroll
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (!href || href === '#' || href.length <= 1) return;
        e.preventDefault();
        try {
          const target = document.querySelector(href);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
          console.warn('Invalid selector for smooth scroll:', href);
        }
      });
    });
  }
  
  // Scroll animations
  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('fade-in');
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.product-card, .feature-card').forEach(el => observer.observe(el));
  }
  
  // Dropdowns
  function initDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
      const dropbtn = dropdown.querySelector('.dropbtn');
      if (!dropbtn) return;
      dropbtn.addEventListener('click', function(e) {
        if (window.innerWidth < 1024) {
          e.preventDefault();
          e.stopPropagation();
          dropdowns.forEach(d => { if (d !== dropdown) d.classList.remove('active'); });
          dropdown.classList.toggle('active');
        }
      });
    });
    document.addEventListener('click', function(e) {
      if (window.innerWidth < 1024 && !e.target.closest('.dropdown')) {
        dropdowns.forEach(d => d.classList.remove('active'));
      }
    });
  }
  
  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    initQuantitySelector();
    initSearch();
    initSmoothScroll();
    initScrollAnimations();
    initDropdowns();
    initMiniCart();
  });
  
  // Globals
  window.addToCart          = addToCart;
  window.removeFromCart     = removeFromCart;
  window.updateCartQuantity = updateCartQuantity;
  window.filterByCategory   = filterByCategory;
  
  // ══════════════════════════════════════
  // MINI CART POPUP
  // ══════════════════════════════════════
  function initMiniCart() {
    if (document.getElementById('miniCartPopup')) return;
  
    const popup = document.createElement('div');
    popup.id = 'miniCartPopup';
    popup.innerHTML = `
      <div class="mc-header">
        <div class="mc-header-left">
          <span class="mc-header-icon">🛒</span>
          <span class="mc-title">Giỏ hàng</span>
          <span class="mc-count" id="mcCount">0</span>
        </div>
        <button class="mc-close" onclick="closeMiniCart()" title="Đóng">✕</button>
      </div>
      <div class="mc-items" id="mcItems"></div>
      <div class="mc-footer">
        <div class="mc-total-row">
          <span class="mc-total-label">Tổng cộng</span>
          <span class="mc-total-val" id="mcTotal">0 ₫</span>
        </div>
        <div class="mc-btns">
          <a href="/cart"     class="mc-btn mc-btn-view"     onclick="closeMiniCart()">Xem giỏ hàng</a>
          <a href="/checkout" class="mc-btn mc-btn-checkout" onclick="closeMiniCart()">Thanh toán →</a>
        </div>
      </div>`;
    document.body.appendChild(popup);
  
    const style = document.createElement('style');
    style.textContent = `
      #miniCartPopup {
        position:fixed;top:68px;right:20px;width:360px;
        background:#fff;border-radius:12px;
        box-shadow:0 20px 60px rgba(0,0,0,.15),0 4px 16px rgba(0,0,0,.08);
        z-index:99999;display:none;flex-direction:column;
        max-height:480px;overflow:hidden;
        font-family:'Be Vietnam Pro',sans-serif;
        border:1px solid #e8e3db;
      }
      #miniCartPopup::before {
        content:'';position:absolute;top:-6px;right:28px;
        width:12px;height:12px;background:#1a1a18;
        transform:rotate(45deg);border-radius:2px;z-index:1;
      }
      #miniCartPopup.show{display:flex;animation:mcSlideIn .22s cubic-bezier(.4,0,.2,1)}
      @keyframes mcSlideIn{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
      .mc-header{background:#1a1a18;color:#fff;padding:.875rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-radius:12px 12px 0 0;position:relative;z-index:2}
      .mc-header-left{display:flex;align-items:center;gap:.625rem}
      .mc-header-icon{font-size:1rem}
      .mc-title{font-size:.8125rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
      .mc-count{background:#b8922a;color:#fff;border-radius:99px;font-size:.65rem;font-weight:700;padding:1px 7px;min-width:20px;text-align:center}
      .mc-close{width:28px;height:28px;background:rgba(255,255,255,.1);border:none;color:rgba(255,255,255,.8);border-radius:50%;font-size:.875rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
      .mc-close:hover{background:rgba(255,255,255,.2);color:#fff}
      .mc-items{flex:1;overflow-y:auto;padding:.5rem 0;display:flex;flex-direction:column}
      .mc-items::-webkit-scrollbar{width:4px}
      .mc-items::-webkit-scrollbar-thumb{background:#e0dbd4;border-radius:4px}
      .mc-item{display:flex;gap:.75rem;align-items:center;padding:.75rem 1.25rem;transition:background .15s;position:relative}
      .mc-item:hover{background:#faf9f7}
      .mc-item+.mc-item::before{content:'';position:absolute;top:0;left:1.25rem;right:1.25rem;height:1px;background:#f0ede8}
      .mc-item-img{width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0;border:1.5px solid #e8e3db}
      .mc-item-info{flex:1;min-width:0}
      .mc-item-name{font-size:.8125rem;font-weight:600;color:#1a1a18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.25rem;line-height:1.3}
      .mc-item-variant{font-size:.7rem;color:#7a7060;margin-bottom:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mc-item-meta{display:flex;align-items:center;justify-content:space-between}
      .mc-item-qty{font-size:.72rem;color:#7a7060;background:#f5f4f1;border-radius:4px;padding:1px 6px;font-weight:500}
      .mc-item-price{font-size:.875rem;font-weight:700;color:#b8922a}
      .mc-item-remove{width:24px;height:24px;background:none;border:none;color:#c0b9ae;font-size:.75rem;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;margin-left:.25rem}
      .mc-item-remove:hover{background:#fff0f0;color:#dc2626}
      .mc-empty{text-align:center;padding:2.5rem 1rem;color:#a09880;font-size:.875rem}
      .mc-empty-icon{font-size:2.5rem;margin-bottom:.75rem}
      .mc-footer{background:#faf9f7;border-top:1.5px solid #f0ede8;padding:1rem 1.25rem;flex-shrink:0;border-radius:0 0 12px 12px}
      .mc-total-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
      .mc-total-label{font-size:.75rem;font-weight:700;color:#7a7060;text-transform:uppercase;letter-spacing:.08em}
      .mc-total-val{font-size:1.25rem;font-weight:800;color:#1a1a18;letter-spacing:-.01em}
      .mc-btns{display:grid;grid-template-columns:1fr 1fr;gap:.625rem}
      .mc-btn{display:flex;align-items:center;justify-content:center;padding:.7rem .5rem;border-radius:8px;font-size:.78rem;font-weight:700;letter-spacing:.04em;text-decoration:none;transition:all .18s;text-align:center;font-family:'Be Vietnam Pro',sans-serif}
      .mc-btn-view{background:#1a1a18;color:#fff;border:2px solid #1a1a18}
      .mc-btn-view:hover{background:#2e2e2a;border-color:#2e2e2a;color:#fff}
      .mc-btn-checkout{background:#b8922a;color:#fff;border:2px solid #b8922a}
      .mc-btn-checkout:hover{background:#9d7b22;border-color:#9d7b22;color:#fff}
      .mc-item-new{background:#fffbeb!important}
      .mc-item-new .mc-item-name{color:#b8922a}
      @media(max-width:480px){#miniCartPopup{width:calc(100vw - 28px);right:14px}}
    `;
    document.head.appendChild(style);
  
    document.addEventListener('click', function(e) {
      const popup   = document.getElementById('miniCartPopup');
      const cartLink = document.querySelector('.dqd-cart-link');
      if (popup && popup.classList.contains('show') &&
          !popup.contains(e.target) && !cartLink?.contains(e.target)) {
        closeMiniCart();
      }
    });
  }
  
  async function showMiniCart(lastAddedId) {
    if (!document.getElementById('miniCartPopup')) initMiniCart();
    await loadMiniCartItems(lastAddedId);
    document.getElementById('miniCartPopup')?.classList.add('show');
  
    clearTimeout(window._mcAutoClose);
    window._mcAutoClose = setTimeout(closeMiniCart, 5000);
  
    const p = document.getElementById('miniCartPopup');
    if (p) {
      p.addEventListener('mouseenter', () => clearTimeout(window._mcAutoClose));
      p.addEventListener('mouseleave', () => {
        window._mcAutoClose = setTimeout(closeMiniCart, 2000);
      });
    }
  }
  
  async function loadMiniCartItems(highlightId) {
    const container = document.getElementById('mcItems');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:1rem;color:#a09880;font-size:.8rem">Đang tải...</div>';
    try {
      const res = await fetch('/api/cart/summary');
      if (res.ok) {
        const data = await res.json();
        renderMiniCartItems(data.items || [], data.total || 0, highlightId);
        return;
      }
    } catch(e) {}
    container.innerHTML = `
      <div class="mc-empty">
        <div style="font-size:2rem;margin-bottom:.5rem">🛒</div>
        Giỏ hàng của bạn<br>
        <a href="/cart" style="color:#1a97ff;font-weight:600" onclick="closeMiniCart()">Xem giỏ hàng →</a>
      </div>`;
  }
  
  function renderMiniCartItems(items, total, highlightId) {
    const container = document.getElementById('mcItems');
    const totalEl   = document.getElementById('mcTotal');
    const countEl   = document.getElementById('mcCount');
  
    const totalQty = items.reduce((s, i) => s + (i.quantity || 1), 0);
    if (countEl) countEl.textContent = totalQty;
  
    if (!items.length) {
      container.innerHTML = `
        <div class="mc-empty">
          <div class="mc-empty-icon">🛒</div>
          <div style="font-weight:600;color:#2a2520;margin-bottom:.25rem">Giỏ hàng trống</div>
          <div style="font-size:.75rem">Hãy thêm sản phẩm vào giỏ hàng</div>
        </div>`;
      if (totalEl) totalEl.textContent = '0 ₫';
      return;
    }
  
    container.innerHTML = items.map(item => `
      <div class="mc-item ${item.product_id == highlightId ? 'mc-item-new' : ''}">
        <img class="mc-item-img" src="${item.image||''}" alt="${item.name||''}"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 56 56%22><rect fill=%22%23f5f4f1%22 width=%2256%22 height=%2256%22 rx=%228%22/></svg>'">
        <div class="mc-item-info">
          <div class="mc-item-name">${item.name||'Sản phẩm'}</div>
          ${item.variant_info ? `<div class="mc-item-variant">🎨 ${item.variant_info}</div>` : ''}
          <div class="mc-item-meta">
            <span class="mc-item-qty">SL: ${item.quantity||1}</span>
            <span class="mc-item-price">${fmtPrice(item.price*(item.quantity||1))}</span>
          </div>
        </div>
        <button class="mc-item-remove" onclick="removeMiniCartItem(${item.product_id})" title="Xóa">✕</button>
      </div>
    `).join('');
  
    if (totalEl) totalEl.textContent = fmtPrice(total);
  }
  
  function fmtPrice(n) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
  }
  
  function closeMiniCart() {
    clearTimeout(window._mcAutoClose);
    document.getElementById('miniCartPopup')?.classList.remove('show');
  }
  
  async function removeMiniCartItem(productId) {
    try {
      await fetch('/api/remove-from-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId })
      });
      const cur = parseInt(document.querySelector('#cartBadge, .dqd-cart-badge')?.textContent || '0');
      updateCartCount(Math.max(0, cur - 1));
      await loadMiniCartItems(null);
    } catch(e) {}
  }
  
  window.closeMiniCart      = closeMiniCart;
  window.showMiniCart       = showMiniCart;
  window.removeMiniCartItem = removeMiniCartItem;
  
  // ══════════════════════════════════════════════
  // VARIANT PICKER MODAL
  // Hiển thị khi addToCartWithPicker() được gọi
  // từ trang danh sách / trang chủ
  // ══════════════════════════════════════════════
  window.addToCartWithPicker = function(productId, productName, productImage) {
    // Nếu không truyền image, tìm từ card trên page
    if (!productImage) {
      var card = document.querySelector(
        '.fp-card[data-id="'+productId+'"], .sp-card[data-id="'+productId+'"], [data-product-id="'+productId+'"]'
      );
      if (card) {
        var img = card.querySelector('img');
        productImage = img ? img.src : '';
      }
    }
  
    fetch('/api/products/' + productId + '/variants')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var variants  = (data && data.variants) ? data.variants : [];
        var colors    = variants.filter(function(v) { return v.type === 'color'; });
        var materials = variants.filter(function(v) { return v.type === 'material'; });
  
        if (colors.length === 0 && materials.length === 0) {
          addToCart(productId, 1);
          return;
        }
        _openVariantPicker(productId, productName || '', colors, materials, productImage || '');
      })
      .catch(function() {
        addToCart(productId, 1);
      });
  };
  
  function _openVariantPicker(productId, productName, colors, materials, productImage) {
    var modal = document.getElementById('variantPickerModal');
  
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'variantPickerModal';
      modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(5px);z-index:99998;align-items:flex-end;justify-content:center;padding:0';
      modal.innerHTML =
        '<div id="vpBox" style="background:#fff;border-radius:18px 18px 0 0;max-width:480px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,.18);padding-bottom:env(safe-area-inset-bottom,0)">'
        + '<div style="display:flex;align-items:center;gap:1rem;padding:1.25rem 1.5rem;border-bottom:1.5px solid #f0ede8">'
        +   '<div id="vpImgWrap" style="width:72px;height:72px;border-radius:10px;overflow:hidden;flex-shrink:0;border:1.5px solid #e8e3db;background:#f5f4f1;display:flex;align-items:center;justify-content:center">'
        +     '<img id="vpProductImg" style="width:100%;height:100%;object-fit:cover" src="" alt="" onerror="this.parentNode.style.display=\"none\"">'
        +   '</div>'
        +   '<div style="flex:1;min-width:0"><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#b8922a;margin-bottom:.2rem">Tùy chọn sản phẩm</div>'
        +   '<div id="vpProductName" style="font-size:.9375rem;font-weight:700;color:#1a1a18;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical"></div></div>'
        +   '<button onclick="_closeVariantPicker()" style="width:34px;height:34px;border:none;background:#f5f4f1;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#7a7060;font-size:1.125rem;font-family:inherit">×</button>'
        + '</div>'
        + '<div id="vpBody" style="padding:1.25rem 1.5rem"></div>'
        + '<div style="padding:.875rem 1.5rem 1.5rem;border-top:1.5px solid #f0ede8">'
        +   '<button id="vpAddBtn" onclick="_vpConfirm()" style="width:100%;padding:.9rem;background:#1a1a18;color:#fff;border:none;border-radius:11px;font-family:\'Be Vietnam Pro\',sans-serif;font-size:.9375rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.5rem;transition:background .15s">'
        +   '<svg viewBox="0 0 20 20" fill="none" style="width:18px;height:18px"><path d="M6 16a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2zM2 2h1.5l1.5 9h9l1.5-6H5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        +   'Thêm vào giỏ hàng</button>'
        + '</div>'
        + '</div>';
  
      document.body.appendChild(modal);
      modal.addEventListener('click', function(e) { if (e.target === modal) _closeVariantPicker(); });
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape') _closeVariantPicker(); });
  
      var st = document.createElement('style');
      st.textContent =
        '@keyframes vpSlide{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}'
        + '#vpBox{animation:vpSlide .28s cubic-bezier(.22,.68,0,1.1)}'
        + '.vp-swatch{width:36px;height:36px;border-radius:50%;cursor:pointer;border:2.5px solid transparent;box-shadow:0 2px 6px rgba(0,0,0,.14);transition:all .18s;outline:none;flex-shrink:0}'
        + '.vp-swatch:hover{transform:scale(1.12)}'
        + '.vp-swatch.vp-active{border-color:#1a1a18!important;box-shadow:0 0 0 3px rgba(26,26,24,.18)}'
        + '.vp-chip{padding:.4rem .875rem;border-radius:8px;border:1.5px solid #e8e3db;background:#fff;font-size:.8rem;font-weight:600;color:#3a3530;cursor:pointer;transition:all .18s;display:flex;align-items:center;gap:.375rem;font-family:"Be Vietnam Pro",sans-serif}'
        + '.vp-chip:hover{border-color:#1a1a18}'
        + '.vp-chip.vp-active{border-color:#1a1a18;background:#1a1a18;color:#fff}'
        + '.vp-chip img{width:20px;height:20px;border-radius:3px;object-fit:cover}'
        + '.vp-group{margin-bottom:1.25rem}'
        + '.vp-label{font-size:.8rem;font-weight:700;color:#1a1a18;margin-bottom:.625rem;display:flex;align-items:center;gap:.3rem}'
        + '.vp-label .vp-req{color:#dc2626}'
        + '.vp-label .vp-sel{font-weight:400;color:#7a7060;font-size:.75rem}'
        + '.vp-opts{display:flex;flex-wrap:wrap;gap:.5rem}'
        + '.vp-group.vp-error .vp-label{color:#dc2626}'
        + '.vp-group.vp-error .vp-opts{animation:vpShake .3s ease}'
        + '.vp-hint{font-size:.72rem;font-weight:600;color:#dc2626;margin-top:.375rem;display:flex;align-items:center;gap:.3rem}'
        + '@keyframes vpShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}';
      document.head.appendChild(st);
    }
  
    // Set product info
    document.getElementById('vpProductName').textContent = productName;
    var vpImg = document.getElementById('vpProductImg');
    var vpImgWrap = document.getElementById('vpImgWrap');
    if (vpImg && productImage) {
      vpImg.src = productImage;
      vpImg.alt = productName;
      if (vpImgWrap) vpImgWrap.style.display = 'flex';
    } else if (vpImgWrap) {
      vpImgWrap.style.display = 'none';
    }
    modal._productId = productId;
  
    // Build body
    var body = document.getElementById('vpBody');
    body.innerHTML = '';
  
    // Color group
    if (colors.length > 0) {
      var cg = document.createElement('div');
      cg.className = 'vp-group'; cg.id = 'vpColorGroup';
      cg.innerHTML = '<div class="vp-label">Màu sắc <span class="vp-req">*</span><span class="vp-sel" id="vpColorLabel"> — Chưa chọn</span></div>'
                   + '<div class="vp-opts" id="vpColorOpts"></div>';
      body.appendChild(cg);
  
      colors.forEach(function(v) {
        var btn = document.createElement('button');
        btn.className = 'vp-swatch';
        btn.style.background = v.value;
        btn.title = v.name;
        btn.dataset.name = v.name;
        btn.dataset.priceDiff = v.price_diff || 0;
        btn.dataset.imgUrl = v.image_url || '';
        if (!v.stock) { btn.style.opacity = '.35'; btn.disabled = true; }
        btn.addEventListener('click', function() {
          document.querySelectorAll('#vpColorOpts .vp-swatch').forEach(function(b) { b.classList.remove('vp-active'); });
          btn.classList.add('vp-active');
          var lbl = document.getElementById('vpColorLabel');
          if (lbl) lbl.textContent = ' — ' + v.name;
          var grp = document.getElementById('vpColorGroup');
          if (grp) { grp.classList.remove('vp-error'); var h = grp.querySelector('.vp-hint'); if (h) h.remove(); }
          // Đổi ảnh header khi chọn màu
          if (v.image_url) {
            var vpImg = document.getElementById('vpProductImg');
            var vpWrap = document.getElementById('vpImgWrap');
            if (vpImg) {
              vpImg.style.opacity = '0';
              vpImg.style.transition = 'opacity .2s';
              setTimeout(function() {
                vpImg.src = v.image_url;
                vpImg.style.opacity = '1';
              }, 150);
              if (vpWrap) vpWrap.style.display = 'flex';
            }
          }
          _vpUpdatePrice();
        });
        document.getElementById('vpColorOpts').appendChild(btn);
      });
    }
  
    // Material group
    if (materials.length > 0) {
      var mg = document.createElement('div');
      mg.className = 'vp-group'; mg.id = 'vpMaterialGroup';
      mg.innerHTML = '<div class="vp-label">Chất liệu <span class="vp-req">*</span><span class="vp-sel" id="vpMatLabel"> — Chưa chọn</span></div>'
                   + '<div class="vp-opts" id="vpMatOpts"></div>';
      body.appendChild(mg);
  
      materials.forEach(function(v) {
        var btn = document.createElement('button');
        btn.className = 'vp-chip';
        btn.dataset.name = v.name;
        btn.dataset.priceDiff = v.price_diff || 0;
        btn.dataset.imgUrl = v.image_url || '';
        if (v.image_url) {
          var img = document.createElement('img');
          img.src = v.image_url; img.alt = v.name;
          img.onerror = function() { this.style.display = 'none'; };
          btn.appendChild(img);
        }
        btn.appendChild(document.createTextNode(v.name));
        if (!v.stock) { btn.style.opacity = '.4'; btn.disabled = true; }
        btn.addEventListener('click', function() {
          document.querySelectorAll('#vpMatOpts .vp-chip').forEach(function(b) { b.classList.remove('vp-active'); });
          btn.classList.add('vp-active');
          var lbl = document.getElementById('vpMatLabel');
          if (lbl) lbl.textContent = ' — ' + v.name;
          var grp = document.getElementById('vpMaterialGroup');
          if (grp) { grp.classList.remove('vp-error'); var h = grp.querySelector('.vp-hint'); if (h) h.remove(); }
          _vpUpdatePrice();
        });
        document.getElementById('vpMatOpts').appendChild(btn);
      });
    }
  
    // Quantity
    var qDiv = document.createElement('div');
    qDiv.style.cssText = 'display:flex;align-items:center;gap:.875rem;margin-top:.375rem;padding-top:1rem;border-top:1.5px solid #f0ede8';
    qDiv.innerHTML =
      '<span style="font-size:.78rem;font-weight:700;color:#1a1a18;flex-shrink:0">Số lượng</span>'
      + '<div style="display:flex;align-items:center;border:1.5px solid #e8e3db;border-radius:8px;overflow:hidden">'
      + '<button onclick="_vpQty(-1)" style="width:36px;height:36px;border:none;background:none;font-size:1.125rem;cursor:pointer;color:#2a2520" onmouseover="this.style.background=\'#f5f4f1\'" onmouseout="this.style.background=\'none\'">−</button>'
      + '<span id="vpQty" style="min-width:36px;text-align:center;font-size:.875rem;font-weight:600;color:#1a1a18">1</span>'
      + '<button onclick="_vpQty(1)"  style="width:36px;height:36px;border:none;background:none;font-size:1.125rem;cursor:pointer;color:#2a2520" onmouseover="this.style.background=\'#f5f4f1\'" onmouseout="this.style.background=\'none\'">+</button>'
      + '</div>'
      + '<span id="vpPriceNote" style="font-size:.75rem;margin-left:auto"></span>';
    body.appendChild(qDiv);
  
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  
  function _vpQty(delta) {
    var el = document.getElementById('vpQty');
    if (!el) return;
    el.textContent = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
  }
  
  function _vpUpdatePrice() {
    var diff = 0;
    var ac = document.querySelector('#vpColorOpts .vp-active');
    var am = document.querySelector('#vpMatOpts .vp-active');
    if (ac) diff += parseFloat(ac.dataset.priceDiff || 0);
    if (am) diff += parseFloat(am.dataset.priceDiff || 0);
    var note = document.getElementById('vpPriceNote');
    if (note) {
      if (diff !== 0) {
        note.style.color = diff > 0 ? '#dc2626' : '#16a34a';
        note.style.fontWeight = '600';
        note.textContent = (diff > 0 ? '+' : '') + diff.toLocaleString('vi-VN') + ' ₫';
      } else {
        note.textContent = '';
      }
    }
  }
  
  function _vpConfirm() {
    var modal = document.getElementById('variantPickerModal');
    if (!modal) return;
  
    var hasColors    = document.querySelectorAll('#vpColorOpts .vp-swatch').length > 0;
    var hasMaterials = document.querySelectorAll('#vpMatOpts .vp-chip').length  > 0;
    var selColor     = document.querySelector('#vpColorOpts .vp-swatch.vp-active');
    var selMat       = document.querySelector('#vpMatOpts .vp-chip.vp-active');
    var valid = true;
  
    if (hasColors && !selColor) {
      valid = false;
      var cg = document.getElementById('vpColorGroup');
      if (cg) {
        cg.classList.add('vp-error');
        if (!cg.querySelector('.vp-hint')) {
          var h = document.createElement('div');
          h.className = 'vp-hint';
          h.innerHTML = '<svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px;flex-shrink:0"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3"/><path d="M8 5v3m0 2v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg> Vui lòng chọn màu sắc';
          cg.appendChild(h);
        }
      }
    }
    if (hasMaterials && !selMat) {
      valid = false;
      var mg = document.getElementById('vpMaterialGroup');
      if (mg) {
        mg.classList.add('vp-error');
        if (!mg.querySelector('.vp-hint')) {
          var h2 = document.createElement('div');
          h2.className = 'vp-hint';
          h2.innerHTML = '<svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px;flex-shrink:0"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3"/><path d="M8 5v3m0 2v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg> Vui lòng chọn chất liệu';
          mg.appendChild(h2);
        }
      }
    }
    if (!valid) return;
  
    var parts = [];
    if (selColor) parts.push('Màu: ' + selColor.dataset.name);
    if (selMat)   parts.push('Chất liệu: ' + selMat.dataset.name);
    var variantInfo = parts.length ? parts.join(' | ') : null;
    var qty = parseInt(document.getElementById('vpQty').textContent) || 1;
  
    _closeVariantPicker();
    addToCart(modal._productId, qty, variantInfo);
  }
  
  function _closeVariantPicker() {
    var m = document.getElementById('variantPickerModal');
    if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
  }
  
  window._closeVariantPicker = _closeVariantPicker;
  window._vpConfirm          = _vpConfirm;
  window._vpQty              = _vpQty;
  
  // Signal that variant picker is ready
  window._vpReady = true;
  
  // Safe alias — works even before full init
  // Safe alias handled above