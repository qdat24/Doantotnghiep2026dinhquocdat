// ============================================
// ACCOUNT PAGE — Shipping Addresses
// ============================================

/* ── Toast notification (DQD style) ── */
(function () {
    const CSS_ID = 'dqd-notif-styles';
    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement('style');
      s.id = CSS_ID;
      s.textContent = `
        .dqd-notif {
          position: fixed;
          top: 1.25rem;
          right: 1.25rem;
          display: flex;
          align-items: center;
          gap: .625rem;
          padding: .75rem 1.125rem;
          border-radius: 9px;
          font-family: 'Be Vietnam Pro', ui-sans-serif, sans-serif;
          font-size: .875rem;
          font-weight: 600;
          color: #fff;
          box-shadow: 0 4px 16px rgba(0,0,0,.18);
          z-index: 10000;
          max-width: 340px;
          animation: dqd-in .25s cubic-bezier(.4,0,.2,1) forwards;
        }
        .dqd-notif.out { animation: dqd-out .2s cubic-bezier(.4,0,.2,1) forwards; }
        .dqd-notif-success { background: #1a1a18; border-left: 3px solid #b8922a; }
        .dqd-notif-error   { background: #1a1a18; border-left: 3px solid #dc2626; }
        .dqd-notif-warning { background: #1a1a18; border-left: 3px solid #d97706; }
        .dqd-notif svg { width: 16px; height: 16px; flex-shrink: 0; }
        @keyframes dqd-in  { from { opacity:0; transform:translateX(110%) } to { opacity:1; transform:translateX(0) } }
        @keyframes dqd-out { from { opacity:1; transform:translateX(0) } to { opacity:0; transform:translateX(110%) } }
      `;
      document.head.appendChild(s);
    }
  })();
  
  function showNotification(message, type = 'success') {
    const icons = {
      success: '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#b8922a" stroke-width="1.3"/><path d="M5 8l2 2 4-4" stroke="#b8922a" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      error:   '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#dc2626" stroke-width="1.3"/><path d="M5 5l6 6M11 5l-6 6" stroke="#dc2626" stroke-width="1.3" stroke-linecap="round"/></svg>',
      warning: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 2l6.5 12H1.5L8 2z" stroke="#d97706" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 7v3m0 2v.5" stroke="#d97706" stroke-width="1.3" stroke-linecap="round"/></svg>',
    };
    const el = document.createElement('div');
    el.className = `dqd-notif dqd-notif-${type}`;
    el.innerHTML = (icons[type] || icons.success) + `<span>${message}</span>`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    }, 3000);
  }
  
  /* ── Modal HTML template ── */
  function _modalHTML() {
    return `
      <div class="am-content">
        <div class="am-header">
          <h3 id="am-title">Thêm địa chỉ mới</h3>
          <button type="button" class="am-close" onclick="closeAddressModal()" aria-label="Đóng">
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4L4 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          </button>
        </div>
        <form id="address-form" onsubmit="saveAddress(event)" novalidate>
          <div class="am-body">
            <div class="am-row">
              <div class="am-f">
                <label>Họ và tên <span class="am-req">*</span></label>
                <input type="text" name="full_name" required placeholder="Nguyễn Văn A">
              </div>
              <div class="am-f">
                <label>Số điện thoại <span class="am-req">*</span></label>
                <input type="tel" name="phone" required placeholder="0901 234 567">
              </div>
            </div>
            <div class="am-f">
              <label>Địa chỉ <span class="am-req">*</span></label>
              <textarea name="address" rows="2" required placeholder="Số nhà, tên đường..."></textarea>
            </div>
            <div class="am-row">
              <div class="am-f">
                <label>Phường / Xã</label>
                <input type="text" name="ward" placeholder="Phường / Xã">
              </div>
              <div class="am-f">
                <label>Quận / Huyện</label>
                <input type="text" name="district" placeholder="Quận / Huyện">
              </div>
            </div>
            <div class="am-f">
              <label>Tỉnh / Thành phố</label>
              <input type="text" name="city" placeholder="Hà Nội, TP. HCM...">
            </div>
            <label class="am-check">
              <input type="checkbox" name="is_default">
              <span>Đặt làm địa chỉ mặc định</span>
            </label>
          </div>
          <div class="am-footer">
            <button type="button" class="am-btn am-btn-cancel" onclick="closeAddressModal()">Hủy</button>
            <button type="submit" class="am-btn am-btn-save">Lưu địa chỉ</button>
          </div>
        </form>
      </div>`;
  }
  
  function _ensureModalStyles() {
    if (document.getElementById('am-styles')) return;
    const s = document.createElement('style');
    s.id = 'am-styles';
    s.textContent = `
      #address-modal {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.5);
        z-index: 1000;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      #address-modal.open { display: flex; }
      .am-content {
        background: #fff;
        border-radius: 12px;
        width: 100%;
        max-width: 560px;
        max-height: 92vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,.2);
        font-family: 'Be Vietnam Pro', ui-sans-serif, sans-serif;
      }
      .am-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.125rem 1.375rem;
        border-bottom: 1.5px solid #e8e3db;
      }
      .am-header h3 { font-size: 1rem; font-weight: 700; color: #1a1a18; margin: 0; }
      .am-close {
        width: 32px; height: 32px;
        border: 1.5px solid #e8e3db;
        border-radius: 7px;
        background: #f5f4f1;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: #7a7060;
        transition: all .15s;
      }
      .am-close svg { width: 14px; height: 14px; }
      .am-close:hover { border-color: #1a1a18; color: #1a1a18; }
      .am-body { padding: 1.25rem 1.375rem; display: flex; flex-direction: column; gap: .875rem; }
      .am-row { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; }
      .am-f { display: flex; flex-direction: column; gap: .375rem; }
      .am-f label { font-size: .78rem; font-weight: 600; color: #2a2520; }
      .am-req { color: #dc2626; }
      .am-f input, .am-f textarea {
        padding: .65rem .875rem;
        border: 1.5px solid #e8e3db;
        border-radius: 8px;
        font-family: inherit;
        font-size: .875rem;
        color: #2a2520;
        outline: none;
        transition: border-color .18s, box-shadow .18s;
        width: 100%;
        resize: vertical;
      }
      .am-f input:focus, .am-f textarea:focus {
        border-color: #b8922a;
        box-shadow: 0 0 0 3px rgba(184,146,42,.1);
      }
      .am-f input::placeholder, .am-f textarea::placeholder { color: #c0b9ae; }
      .am-check {
        display: flex;
        align-items: center;
        gap: .625rem;
        padding: .75rem 1rem;
        background: #f5f4f1;
        border: 1.5px solid #e8e3db;
        border-radius: 8px;
        cursor: pointer;
        user-select: none;
      }
      .am-check input[type=checkbox] { width: 16px; height: 16px; accent-color: #b8922a; flex-shrink: 0; margin: 0; }
      .am-check span { font-size: .8125rem; font-weight: 500; color: #2a2520; }
      .am-footer {
        display: flex;
        gap: .625rem;
        justify-content: flex-end;
        padding: .875rem 1.375rem;
        border-top: 1.5px solid #e8e3db;
      }
      .am-btn {
        display: inline-flex; align-items: center; gap: .375rem;
        padding: .65rem 1.25rem;
        border-radius: 8px;
        font-family: inherit;
        font-size: .875rem;
        font-weight: 600;
        cursor: pointer;
        border: 1.5px solid transparent;
        transition: all .18s;
      }
      .am-btn-cancel { background: #f5f4f1; color: #7a7060; border-color: #e8e3db; }
      .am-btn-cancel:hover { border-color: #dc2626; color: #dc2626; }
      .am-btn-save { background: #1a1a18; color: #fff; border-color: #1a1a18; }
      .am-btn-save:hover { background: #2e2e2a; }
      .am-btn-save:disabled { opacity: .6; cursor: not-allowed; }
      @media (max-width: 480px) { .am-row { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  
  function _getOrCreateModal() {
    let modal = document.getElementById('address-modal');
    if (!modal) {
      _ensureModalStyles();
      modal = document.createElement('div');
      modal.id = 'address-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = _modalHTML();
      document.body.appendChild(modal);
      // Close on backdrop click
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeAddressModal();
      });
    }
    return modal;
  }
  
  /* ── Public API ── */
  
  function showAddAddressModal() {
    const modal = _getOrCreateModal();
    document.getElementById('am-title').textContent = 'Thêm địa chỉ mới';
    const form = document.getElementById('address-form');
    form.reset();
    form.removeAttribute('data-address-id');
    modal.classList.add('open');
    form.querySelector('input[name="full_name"]').focus();
  }
  
  function closeAddressModal() {
    const modal = document.getElementById('address-modal');
    if (modal) modal.classList.remove('open');
  }
  
  async function loadShippingAddresses() {
    const container = document.getElementById('address-list');
    if (!container) return;
    try {
      const res  = await fetch('/api/shipping-addresses');
      const data = await res.json();
      if (data.success && data.addresses) {
        displayAddresses(data.addresses);
      } else {
        _emptyState(container, 'Chưa có địa chỉ nào. Hãy thêm địa chỉ mới!');
      }
    } catch {
      _emptyState(container, 'Có lỗi xảy ra khi tải địa chỉ.');
    }
  }
  
  function _emptyState(container, msg) {
    container.innerHTML = `<p style="text-align:center;color:#7a7060;padding:2rem;font-size:.875rem">${msg}</p>`;
  }
  
  function displayAddresses(addresses) {
    const container = document.getElementById('address-list');
    if (!container) return;
    if (!addresses.length) { _emptyState(container, 'Chưa có địa chỉ nào. Hãy thêm địa chỉ mới!'); return; }
  
    container.innerHTML = addresses.map(a => `
      <div class="address-card${a.is_default ? ' default' : ''}">
        <div class="address-card-header">
          <h4>${a.full_name}${a.is_default ? ' <span class="default-badge">Mặc định</span>' : ''}</h4>
        </div>
        <div class="address-info">
          <p><strong>Điện thoại:</strong> ${a.phone}</p>
          <p><strong>Địa chỉ:</strong> ${a.address}</p>
          ${a.ward     ? `<p><strong>Phường/Xã:</strong> ${a.ward}</p>` : ''}
          ${a.district ? `<p><strong>Quận/Huyện:</strong> ${a.district}</p>` : ''}
          ${a.city     ? `<p><strong>Tỉnh/Thành phố:</strong> ${a.city}</p>` : ''}
        </div>
        <div class="address-actions">
          <button onclick="editAddress(${a.id})">Sửa</button>
          <button onclick="setDefaultAddress(${a.id})" ${a.is_default ? 'disabled' : ''}>Đặt mặc định</button>
          <button class="delete" onclick="deleteAddress(${a.id})">Xóa</button>
        </div>
      </div>
    `).join('');
  }
  
  async function saveAddress(event) {
    event.preventDefault();
    const form      = event.target;
    const saveBtn   = form.querySelector('.am-btn-save');
    const addressId = form.getAttribute('data-address-id');
    const fd        = new FormData(form);
  
    const payload = {
      full_name:  fd.get('full_name'),
      phone:      fd.get('phone'),
      address:    fd.get('address'),
      ward:       fd.get('ward')     || '',
      district:   fd.get('district') || '',
      city:       fd.get('city')     || '',
      is_default: fd.get('is_default') === 'on',
    };
  
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu...';
  
    try {
      const url    = addressId ? `/api/shipping-address/${addressId}` : '/api/shipping-address';
      const method = addressId ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        showNotification(result.message || 'Đã lưu địa chỉ', 'success');
        closeAddressModal();
        loadShippingAddresses();
      } else {
        showNotification(result.message || 'Có lỗi xảy ra', 'error');
      }
    } catch {
      showNotification('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lưu địa chỉ';
    }
  }
  
  async function editAddress(addressId) {
    try {
      const res  = await fetch('/api/shipping-addresses');
      const data = await res.json();
      if (!data.success || !data.addresses) return;
      const a = data.addresses.find(x => x.id == addressId);
      if (!a) return;
  
      const modal = _getOrCreateModal();
      document.getElementById('am-title').textContent = 'Sửa địa chỉ';
  
      const form = document.getElementById('address-form');
      form.setAttribute('data-address-id', addressId);
      form.full_name.value  = a.full_name;
      form.phone.value      = a.phone;
      form.address.value    = a.address;
      form.ward.value       = a.ward     || '';
      form.district.value   = a.district || '';
      form.city.value       = a.city     || '';
      form.is_default.checked = a.is_default;
  
      modal.classList.add('open');
      form.querySelector('input[name="full_name"]').focus();
    } catch {
      showNotification('Không thể tải địa chỉ', 'error');
    }
  }
  
  async function setDefaultAddress(addressId) {
    try {
      const res  = await fetch('/api/shipping-addresses');
      const data = await res.json();
      if (!data.success || !data.addresses) return;
      const a = data.addresses.find(x => x.id == addressId);
      if (!a) return;
  
      const upd = await fetch(`/api/shipping-address/${addressId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...a, is_default: true }),
      });
      const result = await upd.json();
      if (result.success) {
        showNotification('Đã đặt làm địa chỉ mặc định', 'success');
        loadShippingAddresses();
      } else {
        showNotification(result.message || 'Có lỗi xảy ra', 'error');
      }
    } catch {
      showNotification('Có lỗi xảy ra', 'error');
    }
  }
  
  async function deleteAddress(addressId) {
    if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;
    try {
      const res    = await fetch(`/api/shipping-address/${addressId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        showNotification('Đã xóa địa chỉ', 'success');
        loadShippingAddresses();
      } else {
        showNotification(result.message || 'Có lỗi xảy ra', 'error');
      }
    } catch {
      showNotification('Có lỗi xảy ra', 'error');
    }
  }
  
  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function () {
    // Load addresses only when section is visible
    const section = document.getElementById('addresses');
    if (section && section.style.display !== 'none') {
      loadShippingAddresses();
    }
  
    // Escape key closes modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAddressModal();
    });
  });