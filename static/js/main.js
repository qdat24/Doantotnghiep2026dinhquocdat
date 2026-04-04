// ============================================
// DQD — Main App JS
// Cart / Search / UI / Animations
// ============================================
(function () {
    'use strict';
  
    // ── Constants ───────────────────────────────
    const CART_API = {
      add:    '/api/add-to-cart',
      remove: '/api/remove-from-cart',
      update: '/api/update-cart'
    };
    const MAX_TOASTS   = 3;
    const TOAST_MS     = 3000;
    const MOBILE_BP    = 1024;
  
    let _toastCount = 0;
  
    // ══════════════════════════════════════════════
    // TOAST
    // ══════════════════════════════════════════════
  
    // FIX 1: Toast dùng class show/hide + limit MAX_TOASTS
    function showToast(message, type = 'success') {
      if (_toastCount >= MAX_TOASTS) return;
      _toastCount++;
  
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
  
      // Force reflow để transition chạy
      requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
      });
  
      setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
          toast.remove();
          _toastCount--;
        }, { once: true });
      }, TOAST_MS);
    }
  
    // ══════════════════════════════════════════════
    // CART — ADD
    // ══════════════════════════════════════════════
  
    async function addToCart(productId, quantity = 1) {
      const id  = parseInt(productId, 10);
      const qty = Math.max(1, parseInt(quantity, 10) || 1);
  
      if (!id || id <= 0) { showToast('ID sản phẩm không hợp lệ', 'error'); return; }
  
      try {
        const res = await fetch(CART_API.add, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body:    JSON.stringify({ product_id: id, quantity: qty })
        });
  
        const ct   = res.headers.get('content-type') || '';
        const data = ct.includes('application/json')
          ? await res.json()
          : (() => { throw new Error('Non-JSON response'); })();
  
        if (!res.ok) {
          showToast(data.message || `Lỗi ${res.status}`, 'error');
          return;
        }
  
        if (data.success) {
          showToast('Đã thêm sản phẩm vào giỏ hàng!', 'success');
          if (data.cart_count !== undefined) _updateCartBadge(data.cart_count);
        } else {
          showToast(data.message || 'Có lỗi xảy ra', 'error');
        }
      } catch (err) {
        console.error('[Cart] addToCart:', err);
        showToast('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
      }
    }
  
    // ══════════════════════════════════════════════
    // CART — REMOVE
    // ══════════════════════════════════════════════
  
    // FIX 2: Thay confirm() bằng dialog inline (không block thread).
    //         Xóa DOM trực tiếp thay vì location.reload().
    function removeFromCart(productId) {
      const row = document.querySelector(`[data-cart-product="${productId}"]`);
  
      _showConfirm('Xóa sản phẩm này khỏi giỏ hàng?', async () => {
        try {
          const res = await fetch(CART_API.remove, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ product_id: productId })
          });
  
          // FIX 3: check res.ok
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
  
          if (data.success) {
            showToast('Đã xóa sản phẩm khỏi giỏ hàng', 'success');
            // FIX 2: Xóa DOM, không reload
            row?.remove();
            if (data.cart_count !== undefined) _updateCartBadge(data.cart_count);
            if (data.subtotal   !== undefined) _updateSubtotal(data.subtotal);
            // Nếu giỏ trống → reload một lần để render empty state
            if (data.cart_count === 0) location.reload();
          } else {
            showToast(data.message || 'Có lỗi xảy ra', 'error');
          }
        } catch (err) {
          console.error('[Cart] removeFromCart:', err);
          showToast('Có lỗi xảy ra', 'error');
        }
      });
    }
  
    // ══════════════════════════════════════════════
    // CART — UPDATE QUANTITY
    // ══════════════════════════════════════════════
  
    // FIX 4: Validate quantity + debounce + cập nhật DOM thay vì reload
    const _updateDebounce = {};
  
    function updateCartQuantity(productId, quantity) {
      const qty = parseInt(quantity, 10);
  
      // FIX 4a: validate
      if (!qty || qty < 1) {
        showToast('Số lượng không hợp lệ', 'warning');
        return;
      }
  
      // FIX 4b: debounce 400ms — tránh gửi liên tục khi user nhấn +/-
      clearTimeout(_updateDebounce[productId]);
      _updateDebounce[productId] = setTimeout(async () => {
        try {
          const res = await fetch(CART_API.update, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ product_id: productId, quantity: qty })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
  
          if (data.success) {
            if (data.cart_count !== undefined) _updateCartBadge(data.cart_count);
            if (data.subtotal   !== undefined) _updateSubtotal(data.subtotal);
            // Chỉ cập nhật dòng total của item nếu server trả về
            if (data.item_total !== undefined) {
              const itemTotalEl = document.querySelector(`[data-cart-total="${productId}"]`);
              if (itemTotalEl) itemTotalEl.textContent = _fmtVND(data.item_total);
            }
          } else {
            showToast(data.message || 'Có lỗi cập nhật', 'error');
          }
        } catch (err) {
          console.error('[Cart] updateQuantity:', err);
          showToast('Có lỗi xảy ra', 'error');
        }
      }, 400);
    }
  
    // ── Cart badge ────────────────────────────────
    // FIX 5: Animation dùng class thay inline style
    function _updateCartBadge(count) {
      const el = document.querySelector('.cart-count');
      if (!el) return;
      el.textContent = count > 99 ? '99+' : String(count);
      el.classList.remove('cart-badge-pop');
      void el.offsetWidth; // reflow
      el.classList.add('cart-badge-pop');
    }
  
    function _updateSubtotal(amount) {
      const el = document.getElementById('cart-subtotal');
      if (el) el.textContent = _fmtVND(amount);
    }
  
    function _fmtVND(amount) {
      return `${Number(amount).toLocaleString('vi-VN')}₫`;
    }
  
    // ── Confirm dialog (thay confirm()) ───────────
    // FIX 2: Non-blocking, styled, accessible
    function _showConfirm(message, onConfirm) {
      const existing = document.getElementById('dqd-confirm');
      if (existing) existing.remove();
  
      const overlay = document.createElement('div');
      overlay.id = 'dqd-confirm';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Xác nhận');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  
      const box = document.createElement('div');
      box.style.cssText = 'background:#fff;border-radius:12px;padding:1.5rem;max-width:320px;width:90%;text-align:center;font-family:inherit';
  
      const msg = document.createElement('p');
      msg.style.cssText = 'margin:0 0 1.25rem;font-size:.9375rem;color:#2a2520';
      msg.textContent = message;
  
      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:.75rem;justify-content:center';
  
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Hủy';
      cancelBtn.style.cssText = 'flex:1;padding:.65rem;border:1.5px solid #e8e3db;border-radius:8px;background:#fff;cursor:pointer;font-size:.875rem;font-weight:600;color:#7a7060';
      cancelBtn.addEventListener('click', () => overlay.remove());
  
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.textContent = 'Xác nhận';
      confirmBtn.style.cssText = 'flex:1;padding:.65rem;border:none;border-radius:8px;background:#dc2626;color:#fff;cursor:pointer;font-size:.875rem;font-weight:600';
      confirmBtn.addEventListener('click', () => { overlay.remove(); onConfirm(); });
  
      btns.append(cancelBtn, confirmBtn);
      box.append(msg, btns);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
  
      // Escape to cancel
      const onKey = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); } };
      document.addEventListener('keydown', onKey);
      confirmBtn.focus();
    }
  
    // ══════════════════════════════════════════════
    // QUANTITY SELECTOR
    // ══════════════════════════════════════════════
  
    function _initQuantitySelector() {
      const minus = document.querySelector('.quantity-minus');
      const plus  = document.querySelector('.quantity-plus');
      const input = document.querySelector('.quantity-input');
      if (!minus || !plus || !input) return;
  
      const max = parseInt(input.getAttribute('max'), 10) || 999;
      const min = parseInt(input.getAttribute('min'), 10) || 1;
  
      minus.addEventListener('click', () => {
        const v = parseInt(input.value, 10) || min;
        input.value = Math.max(min, v - 1);
        input.dispatchEvent(new Event('change'));
      });
      plus.addEventListener('click', () => {
        const v = parseInt(input.value, 10) || min;
        // FIX 6: Respect max (stock)
        input.value = Math.min(max, v + 1);
        input.dispatchEvent(new Event('change'));
      });
  
      // Sanitize manual input
      input.addEventListener('change', () => {
        const v = parseInt(input.value, 10);
        if (isNaN(v) || v < min) input.value = min;
        else if (v > max) input.value = max;
      });
    }
  
    // ══════════════════════════════════════════════
    // SEARCH
    // ══════════════════════════════════════════════
  
    function _initSearch() {
      const input  = document.querySelector('.search-input');
      const button = document.querySelector('.search-btn, .search-submit');
      if (!input) return;
  
      function doSearch() {
        const q = input.value.trim();
        if (!q) return;
        window.location.href = `/products?search=${encodeURIComponent(q)}`;
      }
  
      // FIX 7: keypress deprecated → keydown; также handle search button
      input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
      button?.addEventListener('click', doSearch);
    }
  
    // ══════════════════════════════════════════════
    // SMOOTH SCROLL
    // ══════════════════════════════════════════════
  
    function _initSmoothScroll() {
      document.addEventListener('click', e => {
        const anchor = e.target.closest('a[href^="#"]');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href || href === '#' || href.length <= 1) return;
        try {
          const target = document.querySelector(href);
          if (!target) return;
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
          console.warn('[SmoothScroll] Invalid selector:', href);
        }
      });
    }
  
    // ══════════════════════════════════════════════
    // SCROLL ANIMATIONS
    // ══════════════════════════════════════════════
  
    function _initScrollAnimations() {
      // FIX 8: Disconnect observer sau khi tất cả phần tử đã animate
      const targets = [...document.querySelectorAll('.product-card, .feature-card')];
      if (!targets.length) return;
  
      let remaining = targets.length;
  
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
          remaining--;
          if (remaining <= 0) observer.disconnect();
        });
      }, { threshold: 0.1 });
  
      targets.forEach(el => observer.observe(el));
    }
  
    // ══════════════════════════════════════════════
    // DROPDOWNS
    // ══════════════════════════════════════════════
  
    function _initDropdowns() {
      const dropdowns = [...document.querySelectorAll('.dropdown')];
      if (!dropdowns.length) return;
  
      // FIX 9: Một listener trên document (event delegation) thay vì N listeners
      document.addEventListener('click', e => {
        if (window.innerWidth >= MOBILE_BP) return;
  
        const dropdown = e.target.closest('.dropdown');
        const isTrigger = e.target.closest('.dropbtn');
  
        if (isTrigger && dropdown) {
          e.preventDefault();
          e.stopPropagation();
          const isOpen = dropdown.classList.contains('active');
          // Đóng tất cả
          dropdowns.forEach(d => d.classList.remove('active'));
          // Toggle cái được click
          if (!isOpen) dropdown.classList.add('active');
          return;
        }
  
        // Click ngoài → đóng tất cả
        if (!dropdown) dropdowns.forEach(d => d.classList.remove('active'));
      });
    }
  
    // ══════════════════════════════════════════════
    // INIT
    // ══════════════════════════════════════════════
  
    function _init() {
      _initQuantitySelector();
      _initSearch();
      _initSmoothScroll();
      _initScrollAnimations();
      _initDropdowns();
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _init, { once: true });
    } else {
      _init();
    }
  
    // ── Public API ────────────────────────────────
    Object.assign(window, {
      addToCart,
      removeFromCart,
      updateCartQuantity,
      filterByCategory: cat => { window.location.href = `/products?category=${encodeURIComponent(cat)}`; },
      showToast
    });
  
  })();