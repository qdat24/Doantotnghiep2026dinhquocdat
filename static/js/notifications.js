// ============================================
// DQD — Notifications Dropdown
// ============================================
(function () {
    'use strict';
  
    // ── State ───────────────────────────────────
    let _refreshTimer   = null;   // setInterval handle
    let _fetchController = null;  // AbortController cho fetch đang chạy
    const REFRESH_MS    = 30_000;
    const MAX_BADGE     = 99;
  
    // ── FIX 1: Đã xóa toàn bộ đoạn duplicate (file bị copy 2 lần) ──
  
    // ── Toggle panel ─────────────────────────────
    function toggleNotifications() {
      const panel = _getPanel();
      if (!panel) return;
  
      // FIX 2: Chỉ dùng class, không mix style.display + classList
      const isOpen = panel.classList.contains('show');
      if (isOpen) {
        _closePanel(panel);
      } else {
        _openPanel(panel);
      }
    }
  
    function _openPanel(panel) {
      panel.classList.add('show');
      panel.removeAttribute('hidden');
      loadNotifications();
    }
  
    function _closePanel(panel) {
      panel.classList.remove('show');
      panel.setAttribute('hidden', '');
      // FIX 3: Huỷ request đang chờ khi đóng panel
      _fetchController?.abort();
    }
  
    // ── Load notifications ────────────────────────
    async function loadNotifications() {
      const list  = document.getElementById('notifications-list');
      const badge = document.getElementById('notification-badge');
      if (!list) return;
  
      // FIX 3: AbortController — tránh race condition khi gọi liên tiếp
      _fetchController?.abort();
      _fetchController = new AbortController();
  
      try {
        const res  = await fetch('/api/notifications', { signal: _fetchController.signal });
  
        // FIX 4: Kiểm tra HTTP status trước khi parse JSON
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
        const data = await res.json();
  
        if (data.success && Array.isArray(data.notifications) && data.notifications.length > 0) {
          _renderList(list, data.notifications);
          _updateBadge(badge, data.notifications.filter(n => !n.is_read).length);
        } else {
          list.innerHTML = '<p class="no-notifications">Chưa có thông báo nào</p>';
          _updateBadge(badge, 0);
        }
  
      } catch (err) {
        if (err.name === 'AbortError') return; // cancelled — không phải lỗi thật
        console.error('[Notifications] Load failed:', err);
        list.innerHTML = '<p class="no-notifications">Có lỗi khi tải thông báo</p>';
      }
    }
  
    function _renderList(container, notifications) {
      // FIX 5: Không dùng onclick inline với URL không sanitized (XSS).
      //         Dùng DocumentFragment + addEventListener thay vì innerHTML thuần.
      const frag = document.createDocumentFragment();
  
      notifications.forEach(n => {
        const item = document.createElement('div');
        item.className = 'notification-item' + (n.is_read ? '' : ' unread');
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
  
        const content = document.createElement('div');
        content.className = 'notification-content';
  
        const title = document.createElement('div');
        title.className = 'notification-title';
        title.textContent = n.title || '';   // textContent = safe, không cần escapeHtml
  
        const msg = document.createElement('div');
        msg.className = 'notification-message';
        msg.textContent = n.message || '';
  
        const time = document.createElement('div');
        time.className = 'notification-time';
        time.textContent = getTimeAgo(n.created_at);
  
        content.append(title, msg, time);
        item.appendChild(content);
  
        if (!n.is_read) {
          const dot = document.createElement('div');
          dot.className = 'unread-dot';
          dot.setAttribute('aria-label', 'Chưa đọc');
          item.appendChild(dot);
        }
  
        // Safe navigation — validate URL trước khi dùng
        const href = _safeUrl(n.link);
        if (href) {
          item.style.cursor = 'pointer';
          const navigate = () => { window.location.href = href; };
          item.addEventListener('click', navigate);
          item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') navigate(); });
        }
  
        frag.appendChild(item);
      });
  
      container.innerHTML = '';
      container.appendChild(frag);
    }
  
    // FIX 5: Validate URL để tránh javascript: injection
    function _safeUrl(url) {
      if (!url || url === '#') return '#';
      try {
        const u = new URL(url, window.location.origin);
        if (u.protocol === 'javascript:') return null;
        return u.href;
      } catch {
        // relative path
        return /^[/#?]/.test(url) ? url : null;
      }
    }
  
    function _updateBadge(badge, count) {
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count > MAX_BADGE ? `${MAX_BADGE}+` : String(count);
        badge.removeAttribute('hidden');
      } else {
        badge.setAttribute('hidden', '');
      }
    }
  
    // ── Mark all read ─────────────────────────────
    async function markAllNotificationsRead() {
      try {
        const res = await fetch('/api/notifications/read-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) loadNotifications();
      } catch (err) {
        console.error('[Notifications] Mark-all failed:', err);
      }
    }
  
    // ── Time formatting ───────────────────────────
    function getTimeAgo(dateString) {
      if (!dateString) return '';
  
      // FIX 6: Validate date — new Date('garbage') → Invalid Date
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
  
      return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    }
  
    // ── Helpers ───────────────────────────────────
    function _getPanel() { return document.getElementById('notifications-panel'); }
  
    // ── Init ─────────────────────────────────────
    function _init() {
      const icon = document.querySelector('.notification-icon');
      if (!icon) return; // user chưa đăng nhập / không có icon → không làm gì
  
      // Panel khởi động hidden
      const panel = _getPanel();
      if (panel && !panel.hasAttribute('hidden')) panel.setAttribute('hidden', '');
  
      // Chỉ load count (badge) khi init, không load full list
      // FIX 7: setInterval giữ reference → có thể clearInterval khi cần
      loadNotifications();
      _refreshTimer = setInterval(loadNotifications, REFRESH_MS);
  
      // Toggle khi click icon
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotifications();
      });
  
      // Đóng khi click ngoài
      // FIX 2: Một listener duy nhất, không duplicate
      document.addEventListener('click', (e) => {
        const panel = _getPanel();
        if (!panel) return;
        if (!panel.classList.contains('show')) return;
        if (!panel.contains(e.target) && !icon.contains(e.target)) {
          _closePanel(panel);
        }
      });
  
      // Escape để đóng
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const p = _getPanel();
          if (p?.classList.contains('show')) _closePanel(p);
        }
      });
    }
  
    // ── Public API ────────────────────────────────
    window.toggleNotifications        = toggleNotifications;
    window.markAllNotificationsRead   = markAllNotificationsRead;
    window.loadNotifications          = loadNotifications;
  
    // ── Boot ─────────────────────────────────────
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _init);
    } else {
      _init();
    }
  
  })();