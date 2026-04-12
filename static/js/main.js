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

      // Lấy variant đã chọn từ trang (nếu có)
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
          // Hiện mini cart popup
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
async function removeFromCart(productId) {
  if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;

  // FIX: hỗ trợ cả 2 data attribute (data-product-id và data-cart-product)
  const row = document.querySelector(
      `[data-product-id="${productId}"], [data-cart-product="${productId}"]`
  );
  const qty = parseInt(
      row?.querySelector('.qty-input, input[type="number"]')?.value || 1, 10
  );

  try {
      const response = await fetch('/api/remove-from-cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: productId })
      });

      const data = await response.json();

      if (data.success) {
          showToast('Đã xóa sản phẩm khỏi giỏ hàng', 'success');

          // FIX: xóa DOM trực tiếp — không reload trang
          if (row) {
              row.style.transition = 'opacity .2s ease, transform .2s ease';
              row.style.opacity    = '0';
              row.style.transform  = 'translateX(20px)';
              setTimeout(() => row.remove(), 220);
          }

          // FIX: cập nhật badge
          if (data.cart_count !== undefined) {
              updateCartCount(data.cart_count);
          } else {
              const cur = parseInt(
                  document.querySelector('#cartBadge, .dqd-cart-badge, .cart-count')?.textContent || '0', 10
              );
              updateCartCount(Math.max(0, cur - qty));
          }

          // Chỉ reload khi giỏ trống (để hiện empty state)
          const remaining = document.querySelectorAll(
              '[data-product-id], [data-cart-product]'
          ).length - 1;
          if (remaining <= 0) setTimeout(() => location.reload(), 400);

      } else {
          showToast(data.message || 'Có lỗi xảy ra!', 'error');
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
      console.warn('[Cart] Badge element not found. Check #cartBadge in base.html');
      return;
  }

  if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = 'flex';   // force — override :empty và display:none
  } else {
      badge.textContent = '';
      badge.style.display = 'none';
  }

  // Animation pop
  badge.style.transform = 'scale(1.4)';
  setTimeout(() => { badge.style.transform = 'scale(1)'; }, 200);
}

// Quantity selector for product detail page
function initQuantitySelector() {
  const minusBtn       = document.querySelector('.quantity-minus');
  const plusBtn        = document.querySelector('.quantity-plus');
  const quantityInput  = document.querySelector('.quantity-input');
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

// Search functionality
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

// Initialize animations on scroll
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('fade-in');
      });
  }, { threshold: 0.1 });

  document.querySelectorAll('.product-card, .feature-card').forEach(el => observer.observe(el));
}

// Initialize dropdowns for mobile
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

// Global
window.addToCart          = addToCart;
window.removeFromCart     = removeFromCart;
window.updateCartQuantity = updateCartQuantity;
window.filterByCategory   = filterByCategory;

// ══════════════════════════════════════
// MINI CART POPUP
// ══════════════════════════════════════
function initMiniCart() {
  // Tạo HTML mini cart nếu chưa có
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
              <a href="/cart" class="mc-btn mc-btn-view" onclick="closeMiniCart()">Xem giỏ hàng</a>
              <a href="/checkout" class="mc-btn mc-btn-checkout" onclick="closeMiniCart()">Thanh toán →</a>
          </div>
      </div>
  `;
  document.body.appendChild(popup);

  // CSS
  const style = document.createElement('style');
  style.textContent = `
      #miniCartPopup {
          position: fixed;
          top: 68px;
          right: 20px;
          width: 360px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,.15), 0 4px 16px rgba(0,0,0,.08);
          z-index: 99999;
          display: none;
          flex-direction: column;
          max-height: 480px;
          overflow: hidden;
          font-family: 'Be Vietnam Pro', sans-serif;
          border: 1px solid #e8e3db;
      }
      #miniCartPopup::before {
          content: '';
          position: absolute;
          top: -6px;
          right: 28px;
          width: 12px; height: 12px;
          background: #1a1a18;
          transform: rotate(45deg);
          border-radius: 2px;
          z-index: 1;
      }
      #miniCartPopup.show { display: flex; animation: mcSlideIn .22s cubic-bezier(.4,0,.2,1); }
      @keyframes mcSlideIn {
          from { opacity: 0; transform: translateY(-8px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Header */
      .mc-header {
          background: #1a1a18;
          color: #fff;
          padding: .875rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          border-radius: 12px 12px 0 0;
          position: relative; z-index: 2;
      }
      .mc-header-left { display: flex; align-items: center; gap: .625rem; }
      .mc-header-icon { font-size: 1rem; }
      .mc-title { font-size: .8125rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
      .mc-count {
          background: #b8922a; color: #fff;
          border-radius: 99px; font-size: .65rem; font-weight: 700;
          padding: 1px 7px; min-width: 20px; text-align: center;
      }
      .mc-close {
          width: 28px; height: 28px;
          background: rgba(255,255,255,.1); border: none; color: rgba(255,255,255,.8);
          border-radius: 50%; font-size: .875rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .15s;
      }
      .mc-close:hover { background: rgba(255,255,255,.2); color: #fff; }

      /* Items */
      .mc-items {
          flex: 1;
          overflow-y: auto;
          padding: .5rem 0;
          display: flex;
          flex-direction: column;
      }
      .mc-items::-webkit-scrollbar { width: 4px; }
      .mc-items::-webkit-scrollbar-track { background: transparent; }
      .mc-items::-webkit-scrollbar-thumb { background: #e0dbd4; border-radius: 4px; }

      .mc-item {
          display: flex;
          gap: .75rem;
          align-items: center;
          padding: .75rem 1.25rem;
          transition: background .15s;
          position: relative;
      }
      .mc-item:hover { background: #faf9f7; }
      .mc-item + .mc-item::before {
          content: '';
          position: absolute;
          top: 0; left: 1.25rem; right: 1.25rem;
          height: 1px; background: #f0ede8;
      }
      .mc-item-img {
          width: 56px; height: 56px; border-radius: 8px;
          object-fit: cover; flex-shrink: 0;
          border: 1.5px solid #e8e3db;
      }
      .mc-item-info { flex: 1; min-width: 0; }
      .mc-item-name {
          font-size: .8125rem; font-weight: 600; color: #1a1a18;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: .25rem; line-height: 1.3;
      }
      .mc-item-meta {
          display: flex; align-items: center; justify-content: space-between;
      }
      .mc-item-qty {
          font-size: .72rem; color: #7a7060;
          background: #f5f4f1; border-radius: 4px;
          padding: 1px 6px; font-weight: 500;
      }
      .mc-item-price { font-size: .875rem; font-weight: 700; color: #b8922a; }
      .mc-item-remove {
          width: 24px; height: 24px;
          background: none; border: none; color: #c0b9ae;
          font-size: .75rem; cursor: pointer;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          transition: all .15s; flex-shrink: 0; margin-left: .25rem;
      }
      .mc-item-remove:hover { background: #fff0f0; color: #dc2626; }

      /* Empty */
      .mc-empty {
          text-align: center; padding: 2.5rem 1rem;
          color: #a09880; font-size: .875rem;
      }
      .mc-empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }

      /* Footer */
      .mc-footer {
          background: #faf9f7;
          border-top: 1.5px solid #f0ede8;
          padding: 1rem 1.25rem;
          flex-shrink: 0;
          border-radius: 0 0 12px 12px;
      }
      .mc-total-row {
          display: flex; justify-content: space-between;
          align-items: center; margin-bottom: 1rem;
      }
      .mc-total-label {
          font-size: .75rem; font-weight: 700; color: #7a7060;
          text-transform: uppercase; letter-spacing: .08em;
      }
      .mc-total-val { font-size: 1.25rem; font-weight: 800; color: #1a1a18; letter-spacing: -.01em; }
      .mc-btns { display: grid; grid-template-columns: 1fr 1fr; gap: .625rem; }
      .mc-btn {
          display: flex; align-items: center; justify-content: center;
          padding: .7rem .5rem; border-radius: 8px;
          font-size: .78rem; font-weight: 700; letter-spacing: .04em;
          text-decoration: none; transition: all .18s; text-align: center;
          font-family: 'Be Vietnam Pro', sans-serif;
      }
      .mc-btn-view {
          background: #1a1a18; color: #fff; border: 2px solid #1a1a18;
      }
      .mc-btn-view:hover { background: #2e2e2a; border-color: #2e2e2a; color: #fff; }
      .mc-btn-checkout {
          background: #b8922a; color: #fff; border: 2px solid #b8922a;
      }
      .mc-btn-checkout:hover { background: #9d7b22; border-color: #9d7b22; color: #fff; }

      /* Highlight item mới thêm */
      .mc-item-new { background: #fffbeb !important; }
      .mc-item-new .mc-item-name { color: #b8922a; }

      @media(max-width: 480px) {
          #miniCartPopup { width: calc(100vw - 28px); right: 14px; }
      }
  `;
  document.head.appendChild(style);

  // Đóng khi click ngoài
  document.addEventListener('click', function(e) {
      const popup = document.getElementById('miniCartPopup');
      const cartLink = document.querySelector('.dqd-cart-link');
      if (popup && popup.classList.contains('show') &&
          !popup.contains(e.target) &&
          !cartLink?.contains(e.target)) {
          closeMiniCart();
      }
  });
}

async function showMiniCart(lastAddedId) {
  const popup = document.getElementById('miniCartPopup');
  if (!popup) { initMiniCart(); }

  // Load cart từ session
  try {
      const res  = await fetch('/cart', { headers: { 'Accept': 'text/html' } });
      // Dùng API riêng nếu có, fallback dùng DOM parse
      await loadMiniCartItems(lastAddedId);
  } catch(e) {
      await loadMiniCartItems(lastAddedId);
  }

  document.getElementById('miniCartPopup')?.classList.add('show');

  // Tự đóng sau 5 giây không tương tác
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
  const totalEl   = document.getElementById('mcTotal');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:1rem;color:#a09880;font-size:.8rem">Đang tải...</div>';

  try {
      const res  = await fetch('/api/cart/summary');
      if (res.ok) {
          const data = await res.json();
          renderMiniCartItems(data.items || [], data.total || 0, highlightId);
          return;
      }
  } catch(e) {}

  // Fallback: đọc từ page cart nếu có, hoặc hiện empty
  container.innerHTML = `
      <div class="mc-empty">
          <div style="font-size:2rem;margin-bottom:.5rem">🛒</div>
          Giỏ hàng của bạn<br>
          <a href="/cart" style="color:#1a97ff;font-weight:600" onclick="closeMiniCart()">Xem giỏ hàng →</a>
      </div>`;
  if (totalEl) totalEl.textContent = '0 ₫';
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
          <img class="mc-item-img"
               src="${item.image || ''}"
               alt="${item.name || ''}"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 56 56%22><rect fill=%22%23f5f4f1%22 width=%2256%22 height=%2256%22 rx=%228%22/></svg>'">
          <div class="mc-item-info">
              <div class="mc-item-name">${item.name || 'Sản phẩm'}</div>
              <div class="mc-item-meta">
                  <span class="mc-item-qty">SL: ${item.quantity || 1}</span>
                  <span class="mc-item-price">${fmtPrice(item.price * (item.quantity || 1))}</span>
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