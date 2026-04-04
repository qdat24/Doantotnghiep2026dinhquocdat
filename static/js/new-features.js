// ============================================
// DQD — Features: Wishlist / Reviews / Coupon
//              / Notifications / Cart / Orders
// ============================================
(function () {
    'use strict';
  
    // ── Constants ───────────────────────────────
    const NOTIF_REFRESH_MS  = 30_000;
    const TOAST_DURATION_MS = 3_000;
    const MAX_TOASTS        = 3;
    const MAX_BADGE         = 99;
  
    // ── State ────────────────────────────────────
    let _notifTimer   = null;
    let _appliedCoupon = null;
    let _toastCount   = 0;
  
    // ── FIX 1: File bị duplicate hoàn toàn — xóa bản thứ hai ──
  
    // ══════════════════════════════════════════════
    // AUTH HELPER
    // ══════════════════════════════════════════════
  
    // FIX 2: isLoggedIn() đáng tin cậy hơn — ưu tiên meta tag từ server
    function isLoggedIn() {
      const meta = document.querySelector('meta[name="user-logged-in"]');
      if (meta) return meta.getAttribute('content') === 'true';
      return (
        document.body.classList.contains('logged-in') ||
        !!sessionStorage.getItem('customer_email') ||
        document.cookie.includes('customer_logged_in=1')
      );
    }
  
    // ══════════════════════════════════════════════
    // SAFE DOM HELPERS
    // ══════════════════════════════════════════════
  
    // FIX 3: Không dùng innerHTML với data từ server (XSS).
    //         Tất cả text → textContent; build DOM programmatically.
    function _el(tag, className, text) {
      const e = document.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    }
  
    function _safeUrl(url) {
      if (!url || url === '#') return null;
      try {
        const u = new URL(url, window.location.origin);
        return u.protocol === 'javascript:' ? null : u.href;
      } catch {
        return /^[/#?]/.test(url) ? url : null;
      }
    }
  
    // FIX 4: generateStars — SVG inline, không phụ thuộc FontAwesome
    function _generateStars(rating) {
      const full = Math.floor(rating);
      const half = rating - full >= 0.5;
      const frag = document.createDocumentFragment();
      const SVG_NS = 'http://www.w3.org/2000/svg';
  
      for (let i = 1; i <= 5; i++) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.style.display = 'inline-block';
  
        const path = document.createElementNS(SVG_NS, 'path');
        const starPath = 'M8 1l1.797 3.641L13.5 5.25l-2.75 2.682.65 3.787L8 9.87l-3.4 1.849.65-3.787L2.5 5.25l3.703-.609z';
        path.setAttribute('d', starPath);
        path.setAttribute('stroke', '#d97706');
        path.setAttribute('stroke-width', '1');
  
        if (i <= full) {
          path.setAttribute('fill', '#d97706');
          path.setAttribute('stroke', 'none');
        } else if (i === full + 1 && half) {
          path.setAttribute('fill', 'url(#half-star)');
          // Simple half: just fill partway via clip
          path.setAttribute('fill', '#d97706');
          path.style.clipPath = 'inset(0 50% 0 0)'; // visual approximation
          const bg = path.cloneNode();
          bg.setAttribute('fill', 'none');
          bg.style.clipPath = '';
          svg.appendChild(bg);
        } else {
          path.setAttribute('fill', 'none');
        }
  
        svg.appendChild(path);
        frag.appendChild(svg);
      }
      return frag;
    }
  
    function _formatTime(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const diffMs    = Date.now() - date.getTime();
      const diffMins  = Math.floor(diffMs / 60_000);
      const diffHours = Math.floor(diffMs / 3_600_000);
      const diffDays  = Math.floor(diffMs / 86_400_000);
      if (diffMins  <  1) return 'Vừa xong';
      if (diffMins  < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays  <  7) return `${diffDays} ngày trước`;
      return date.toLocaleDateString('vi-VN');
    }
  
    // ══════════════════════════════════════════════
    // TOAST NOTIFICATIONS
    // ══════════════════════════════════════════════
  
    // FIX 5: Giới hạn MAX_TOASTS — tránh spam hàng chục toast chồng nhau
    function showNotification(message, type = 'info') {
      if (_toastCount >= MAX_TOASTS) return;
      _toastCount++;
  
      const toast = _el('div', `notification-toast ${type}`);
      toast.textContent = message;
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
  
      requestAnimationFrame(() => toast.classList.add('show'));
  
      setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
          toast.remove();
          _toastCount--;
        }, { once: true });
      }, TOAST_DURATION_MS);
    }
  
    // ══════════════════════════════════════════════
    // WISHLIST
    // ══════════════════════════════════════════════
  
    // FIX 6: toggleWishlist — loại bỏ 2 request riêng (check + toggle).
    //         Dùng 1 endpoint POST /api/wishlist/toggle/:id trả về trạng thái mới.
    //         Nếu server chưa hỗ trợ → dùng optimistic update.
    async function toggleWishlist(productId) {
      if (!isLoggedIn()) {
        showNotification('Vui lòng đăng nhập để thêm vào yêu thích', 'warning');
        return;
      }
  
      const btn = document.querySelector(`[data-wishlist-product="${productId}"]`);
      const wasActive = btn?.classList.contains('active');
  
      // Optimistic update
      _setWishlistBtn(btn, !wasActive);
  
      try {
        const res = await fetch(`/api/wishlist/toggle/${productId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
  
        if (data.success) {
          _setWishlistBtn(btn, data.in_wishlist);
          showNotification(data.message || (data.in_wishlist ? 'Đã thêm vào yêu thích' : 'Đã xóa khỏi yêu thích'), 'success');
        } else {
          _setWishlistBtn(btn, wasActive); // revert
          showNotification(data.message || 'Có lỗi xảy ra', 'error');
        }
      } catch (err) {
        _setWishlistBtn(btn, wasActive); // revert
        console.error('[Wishlist] Toggle failed:', err);
        showNotification('Có lỗi xảy ra', 'error');
      }
    }
  
    function _setWishlistBtn(btn, active) {
      if (!btn) return;
      btn.classList.toggle('active', active);
      // FIX 4: SVG thay FontAwesome
      const heartSVG = active
        ? `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 14s-6-4.35-6-8a4 4 0 018 0 4 4 0 018 0c0 3.65-6 8-6 8z" fill="#dc2626" stroke="#dc2626" stroke-width="1"/></svg>`
        : `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 14s-6-4.35-6-8a4 4 0 018 0 4 4 0 018 0c0 3.65-6 8-6 8z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
      btn.innerHTML = heartSVG + (active ? ' Đã yêu thích' : ' Yêu thích');
    }
  
    async function loadWishlistStatus(productId) {
      if (!isLoggedIn()) return;
      try {
        const res  = await fetch(`/api/wishlist/check/${productId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          _setWishlistBtn(document.querySelector(`[data-wishlist-product="${productId}"]`), data.in_wishlist);
        }
      } catch { /* silent */ }
    }
  
    // FIX 7: Batch load wishlist statuses — 1 request thay vì N request song song
    async function loadAllWishlistStatuses() {
      if (!isLoggedIn()) return;
      const btns = [...document.querySelectorAll('[data-wishlist-product]')];
      if (!btns.length) return;
  
      const ids = btns.map(b => b.getAttribute('data-wishlist-product'));
  
      try {
        const res = await fetch('/api/wishlist/check-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_ids: ids })
        });
  
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.statuses) {
            ids.forEach((id, i) => _setWishlistBtn(btns[i], !!data.statuses[id]));
            return;
          }
        }
      } catch { /* fallback below */ }
  
      // Fallback: load individually if batch endpoint not available
      await Promise.allSettled(ids.map(id => loadWishlistStatus(id)));
    }
  
    // ══════════════════════════════════════════════
    // REVIEWS
    // ══════════════════════════════════════════════
  
    async function loadProductReviews(productId) {
      try {
        const res = await fetch(`/api/product/${productId}/reviews`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success && data.reviews) _displayReviews(data.reviews);
      } catch (err) {
        console.error('[Reviews] Load failed:', err);
      }
    }
  
    // FIX 3: Build DOM — không innerHTML với server data
    function _displayReviews(reviews) {
      const container = document.getElementById('reviews-container');
      if (!container) return;
  
      if (!reviews.length) {
        container.textContent = '';
        container.appendChild(_el('p', 'no-reviews', 'Chưa có đánh giá nào. Hãy là người đầu tiên!'));
        return;
      }
  
      const frag = document.createDocumentFragment();
      reviews.forEach(r => {
        const item = _el('div', 'review-item');
  
        const header = _el('div', 'review-header');
        const info   = _el('div', 'reviewer-info');
        const name   = _el('strong', null, r.customer_name || 'Ẩn danh');
        info.appendChild(name);
  
        if (r.is_verified_purchase) {
          info.appendChild(_el('span', 'verified-badge', '✓ Đã mua'));
        }
  
        const stars = _el('div', 'review-rating');
        stars.appendChild(_generateStars(r.rating || 0));
        header.append(info, stars);
        item.appendChild(header);
  
        if (r.title) item.appendChild(_el('h4', 'review-title', r.title));
        item.appendChild(_el('p', 'review-comment', r.comment || ''));
  
        if (Array.isArray(r.images) && r.images.length) {
          const imgs = _el('div', 'review-images');
          r.images.forEach(src => {
            const safeSrc = _safeUrl(src);
            if (!safeSrc) return;
            const img = document.createElement('img');
            img.src = safeSrc;
            img.alt = 'Ảnh đánh giá';
            img.addEventListener('click', () => openImageModal(safeSrc));
            imgs.appendChild(img);
          });
          item.appendChild(imgs);
        }
  
        const footer = _el('div', 'review-footer');
        footer.appendChild(_el('span', 'review-date', new Date(r.created_at).toLocaleDateString('vi-VN')));
  
        const helpBtn = _el('button', 'helpful-btn', `Hữu ích (${r.helpful_count || 0})`);
        helpBtn.type = 'button';
        helpBtn.addEventListener('click', () => markHelpful(r.id));
        footer.appendChild(helpBtn);
  
        item.appendChild(footer);
        frag.appendChild(item);
      });
  
      container.innerHTML = '';
      container.appendChild(frag);
    }
  
    async function submitReview(productId) {
      if (!isLoggedIn()) {
        showNotification('Vui lòng đăng nhập để đánh giá', 'warning');
        return;
      }
      const rating  = document.getElementById('review-rating')?.value;
      const title   = document.getElementById('review-title')?.value?.trim();
      const comment = document.getElementById('review-comment')?.value?.trim();
  
      if (!rating || !comment) {
        showNotification('Vui lòng điền đủ đánh giá và nhận xét', 'warning');
        return;
      }
  
      try {
        const res = await fetch(`/api/product/${productId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: parseInt(rating, 10), title: title || '', comment, images: [] })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
          showNotification('Đánh giá đã được gửi. Cảm ơn bạn!', 'success');
          document.getElementById('review-form')?.reset();
          loadProductReviews(productId);
        } else {
          showNotification(data.message || 'Có lỗi xảy ra', 'error');
        }
      } catch (err) {
        console.error('[Reviews] Submit failed:', err);
        showNotification('Có lỗi xảy ra', 'error');
      }
    }
  
    async function markHelpful(reviewId) {
      try {
        await fetch(`/api/review/${reviewId}/helpful`, { method: 'POST' });
      } catch { /* silent */ }
    }
  
    // ══════════════════════════════════════════════
    // COUPON
    // ══════════════════════════════════════════════
  
    function getOrderSubtotal() {
      const el = document.getElementById('order-subtotal');
      if (!el) { console.warn('[Coupon] #order-subtotal not found'); return 0; }
      const amount = parseInt((el.textContent || '').replace(/[^\d]/g, ''), 10) || 0;
      return amount;
    }
  
    function updateOrderSummary(discount, finalAmount) {
      const row      = document.getElementById('coupon-discount-row');
      const discEl   = document.getElementById('coupon-discount');
      const totalEl  = document.getElementById('order-total');
  
      if (row) {
        const show = discount > 0;
        row.style.display = show ? 'flex' : 'none';
        if (show && discEl) discEl.textContent = `-${discount.toLocaleString('vi-VN')}₫`;
      }
      if (totalEl) totalEl.textContent = `${finalAmount.toLocaleString('vi-VN')}₫`;
    }
  
    async function applyCouponCode() {
      const input = document.getElementById('coupon-code');
      const code  = input?.value.trim().toUpperCase();
  
      if (!code) { showNotification('Vui lòng nhập mã giảm giá', 'warning'); return; }
  
      const subtotal = getOrderSubtotal();
      if (subtotal <= 0) { showNotification('Tổng tiền đơn hàng không hợp lệ', 'warning'); return; }
  
      try {
        const res = await fetch('/api/coupon/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, order_amount: subtotal })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
  
        if (data.valid) {
          _appliedCoupon = data.coupon;
          const nameEl = document.getElementById('applied-coupon-name');
          if (nameEl) nameEl.textContent = `${data.coupon.name} — Giảm ${data.discount.toLocaleString('vi-VN')}₫`;
  
          document.getElementById('coupon-input-section')?.setAttribute('hidden', '');
          document.getElementById('applied-coupon-section')?.removeAttribute('hidden');
  
          updateOrderSummary(data.discount, data.final_amount);
          showNotification(`Đã áp dụng mã: ${code}`, 'success');
          if (input) input.value = '';
        } else {
          showNotification(data.message || 'Mã giảm giá không hợp lệ', 'error');
        }
      } catch (err) {
        console.error('[Coupon] Apply failed:', err);
        showNotification('Có lỗi xảy ra khi áp dụng mã', 'error');
      }
    }
  
    function removeCoupon() {
      _appliedCoupon = null;
      document.getElementById('coupon-input-section')?.removeAttribute('hidden');
      document.getElementById('applied-coupon-section')?.setAttribute('hidden', '');
      updateOrderSummary(0, getOrderSubtotal());
      showNotification('Đã xóa mã giảm giá', 'info');
    }
  
    // ══════════════════════════════════════════════
    // NOTIFICATIONS
    // ══════════════════════════════════════════════
  
    async function loadNotifications() {
      if (!isLoggedIn()) return;
      try {
        const res = await fetch('/api/notifications?limit=10');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
          _displayNotifications(data.notifications || []);
          _updateNotifBadge(data.unread_count ?? 0);
        }
      } catch (err) {
        console.error('[Notifications] Load failed:', err);
      }
    }
  
    // FIX 3: DOM builder thay innerHTML
    function _displayNotifications(notifications) {
      const container = document.getElementById('notifications-list');
      if (!container) return;
  
      if (!notifications.length) {
        container.textContent = '';
        container.appendChild(_el('p', 'no-notifications', 'Không có thông báo nào'));
        return;
      }
  
      const frag = document.createDocumentFragment();
      notifications.forEach(n => {
        const item = _el('div', 'notification-item' + (n.is_read ? '' : ' unread'));
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
  
        const content = _el('div', 'notification-content');
        content.appendChild(_el('h4', null, n.title || ''));
        content.appendChild(_el('p',  null, n.message || ''));
        content.appendChild(_el('span', 'notification-time', _formatTime(n.created_at)));
        item.appendChild(content);
  
        if (!n.is_read) item.appendChild(_el('span', 'unread-dot'));
  
        const href = _safeUrl(n.link);
        if (href) {
          const go = () => { window.location.href = href; };
          item.addEventListener('click', go);
          item.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
          item.style.cursor = 'pointer';
        }
  
        frag.appendChild(item);
      });
  
      container.innerHTML = '';
      container.appendChild(frag);
    }
  
    function _updateNotifBadge(count) {
      const badge = document.getElementById('notification-badge');
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count > MAX_BADGE ? `${MAX_BADGE}+` : String(count);
        badge.removeAttribute('hidden');
      } else {
        badge.setAttribute('hidden', '');
      }
    }
  
    async function markNotificationRead(id) {
      try {
        const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
        if (res.ok) loadNotifications();
      } catch { /* silent */ }
    }
  
    async function markAllNotificationsRead() {
      try {
        const res = await fetch('/api/notifications/read-all', { method: 'POST' });
        if (res.ok) loadNotifications();
      } catch { /* silent */ }
    }
  
    // ══════════════════════════════════════════════
    // CART SYNC
    // ══════════════════════════════════════════════
  
    async function syncCartToDatabase() {
      if (!isLoggedIn()) return;
      try {
        await fetch('/api/cart/sync', { method: 'POST' });
      } catch { /* silent */ }
    }
  
    async function loadCartFromDatabase() {
      if (!isLoggedIn()) return;
      try {
        const res = await fetch('/api/cart/load');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && typeof updateCartDisplay === 'function') updateCartDisplay();
      } catch { /* silent */ }
    }
  
    // ══════════════════════════════════════════════
    // ORDER HISTORY
    // ══════════════════════════════════════════════
  
    const STATUS_MAP = {
      pending:   { text: 'Chờ xác nhận',    color: '#ff9800' },
      confirmed: { text: 'Đã xác nhận',     color: '#2196f3' },
      shipping:  { text: 'Đang giao hàng',  color: '#9c27b0' },
      delivered: { text: 'Đã giao hàng',    color: '#4caf50' },
      cancelled: { text: 'Đã hủy',          color: '#f44336' }
    };
  
    async function loadOrderHistory(orderId) {
      try {
        const res = await fetch(`/api/order/${orderId}/history`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success && data.history) _displayOrderHistory(data.history);
      } catch (err) {
        console.error('[OrderHistory] Load failed:', err);
      }
    }
  
    // FIX 3: DOM builder, no innerHTML
    function _displayOrderHistory(history) {
      const container = document.getElementById('order-history');
      if (!container) return;
  
      if (!history.length) {
        container.appendChild(_el('p', null, 'Chưa có lịch sử thay đổi'));
        return;
      }
  
      const timeline = _el('div', 'order-history-timeline');
      history.forEach((item, idx) => {
        const info = STATUS_MAP[item.status] || { text: item.status, color: '#666' };
        const row  = _el('div', 'history-item' + (idx === history.length - 1 ? ' current' : ''));
  
        const iconBox = _el('div', 'history-icon');
        iconBox.style.background = info.color;
        iconBox.textContent = '●';  // FIX 4: no FA icon needed
        row.appendChild(iconBox);
  
        const content = _el('div', 'history-content');
        content.appendChild(_el('h4', null, info.text));
        if (item.note) content.appendChild(_el('p', null, item.note));
        content.appendChild(_el('span', 'history-time', new Date(item.created_at).toLocaleString('vi-VN')));
        if (item.changed_by) content.appendChild(_el('span', 'history-by', `Bởi: ${item.changed_by}`));
  
        row.appendChild(content);
        timeline.appendChild(row);
      });
  
      container.innerHTML = '';
      container.appendChild(timeline);
    }
  
    // ══════════════════════════════════════════════
    // INIT — FIX 8: một DOMContentLoaded duy nhất
    // ══════════════════════════════════════════════
  
    function _init() {
      if (isLoggedIn()) {
        loadNotifications();
        _notifTimer = setInterval(loadNotifications, NOTIF_REFRESH_MS);
        syncCartToDatabase();
      }
  
      loadAllWishlistStatuses();
  
      const orderId = document.querySelector('[data-order-id]')?.getAttribute('data-order-id');
      if (orderId) loadOrderHistory(orderId);
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _init, { once: true });
    } else {
      _init();
    }
  
    // ══════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════
  
    Object.assign(window, {
      toggleWishlist,
      loadWishlistStatus,
      loadProductReviews,
      submitReview,
      markHelpful,
      applyCouponCode,
      removeCoupon,
      loadNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      syncCartToDatabase,
      loadCartFromDatabase,
      loadOrderHistory,
      showNotification
    });
  
  })();