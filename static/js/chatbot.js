// ============================================
// DQD Chatbot Widget — Pro Edition
// ============================================
(function () {
    'use strict';
  
    // ── Config ───────────────────────────────────
    const CFG = {
      brandName:    'DQD Nội Thất',
      maxHistory:   30,
      typingMs:     700,
      toastMs:      3000,
      storageKey:   'dqd_chat_v2',
      saveApi:      '/api/chatbot-message',
      searchApi:    '/api/products/search',
      rateLimit:    { max: 6, windowMs: 10_000 },  // max 6 tin / 10s
      sessionExpMs: 24 * 60 * 60_000,              // clear sau 24h
    };
  
    // ── Knowledge base ───────────────────────────
    // Mỗi entry: { patterns: string[], reply: string | fn, tags?: string[] }
    const KB = [
      {
        patterns: ['xin chào','hello','hi','chào','hey','good morning','good afternoon'],
        reply: () => `Xin chào! 👋 Tôi là trợ lý ảo của **${CFG.brandName}**.\nTôi có thể giúp bạn:\n\n• 🛋️ Tư vấn & tìm sản phẩm\n• 💰 Thông tin giá cả & khuyến mãi\n• 🚚 Chính sách vận chuyển\n• 🔄 Đổi trả & bảo hành\n• 📞 Kết nối nhân viên\n\nBạn cần hỗ trợ gì?`,
        tags: ['greet']
      },
      {
        patterns: ['tư vấn','sản phẩm','mua','chọn','phù hợp','gợi ý','recommend'],
        reply: `Tôi rất vui được tư vấn! 🛋️ Bạn đang tìm kiếm nội thất cho không gian nào?\n\n**1.** Phòng khách\n**2.** Phòng ngủ\n**3.** Nhà bếp\n**4.** Văn phòng\n**5.** Phòng ăn\n\nHoặc bạn có thể **nhập tên sản phẩm** để tôi tìm kiếm ngay! 🔍`,
        tags: ['product']
      },
      {
        patterns: ['phòng khách','sofa','ghế','bàn trà','kệ tivi'],
        reply: `Nội thất **Phòng Khách** 🛋️\n\nChúng tôi có:\n• Sofa góc L, sofa văng, sofa da cao cấp\n• Bàn trà kính, gỗ, đá marble\n• Kệ tivi hiện đại, tủ trang trí\n• Thảm trải sàn, đèn trang trí\n\nGiá từ **2.5 triệu → 85 triệu** tùy mẫu.\nBạn muốn tôi tìm mẫu cụ thể nào không? 🔍`,
        tags: ['product', 'living']
      },
      {
        patterns: ['phòng ngủ','giường','tủ quần áo','đầu giường','nệm'],
        reply: `Nội thất **Phòng Ngủ** 🛏️\n\nChúng tôi có:\n• Giường gỗ, giường bọc da, giường hộp\n• Tủ quần áo 2-6 cánh, có gương\n• Bàn đầu giường, bàn trang điểm\n• Nệm lò xo, nệm foam, nệm latex\n\nGiá từ **3 triệu → 120 triệu**.\nBạn cần kích thước giường nào? (1m2, 1m4, 1m6, 1m8) 📐`,
        tags: ['product', 'bedroom']
      },
      {
        patterns: ['văn phòng','bàn làm việc','ghế văn phòng','gaming','máy tính'],
        reply: `Nội thất **Văn Phòng** 💼\n\nChúng tôi có:\n• Bàn làm việc đơn, bàn góc L\n• Ghế văn phòng ergonomic, gaming\n• Tủ hồ sơ, kệ sách\n• Bàn họp, ghế họp\n\nGiá từ **1.5 triệu → 45 triệu**.\nBạn ưu tiên thiết kế hiện đại hay cổ điển? 🎨`,
        tags: ['product', 'office']
      },
      {
        patterns: ['giá','bao nhiêu tiền','chi phí','rẻ','đắt','budget','ngân sách'],
        reply: `**Bảng giá tham khảo** 💰\n\n| Loại | Khoảng giá |\n|------|------------|\n| Sofa | 3.5 – 85tr |\n| Giường | 3 – 120tr |\n| Tủ quần áo | 4 – 60tr |\n| Bàn làm việc | 1.5 – 45tr |\n| Bàn ăn | 2.5 – 40tr |\n\n✨ Đơn hàng từ **5 triệu** → Miễn phí vận chuyển!\n🎁 Đang có **khuyến mãi 15-30%** sản phẩm mới\n\nBạn có ngân sách cụ thể không?`,
        tags: ['price']
      },
      {
        patterns: ['khuyến mãi','giảm giá','sale','ưu đãi','voucher','mã giảm','coupon'],
        reply: `🎉 **Ưu đãi đang có:**\n\n• **NEW15** — Giảm 15% cho khách hàng mới\n• **SHIP5M** — Miễn phí ship đơn từ 5 triệu\n• **SALE30** — Giảm 30% sản phẩm được chọn\n• **VIPKHACH** — Thêm 5% cho khách hàng VIP\n\n⏰ Áp dụng đến hết tháng này.\nBạn muốn dùng mã nào? Tôi kiểm tra ngay!`,
        tags: ['promo']
      },
      {
        patterns: ['vận chuyển','giao hàng','ship','thời gian','khi nào nhận','bao lâu'],
        reply: `**Chính sách vận chuyển** 🚚\n\n📍 **Nội thành HN/HCM:**\n• 1-3 ngày làm việc\n• Phí: 0đ (đơn ≥ 5tr) / 150k\n\n📍 **Tỉnh thành khác:**\n• 3-7 ngày làm việc\n• Phí: 0đ (đơn ≥ 5tr) / 200-350k\n\n🏗️ **Lắp đặt:**\n• Miễn phí lắp đặt tại nhà\n• Thợ có kinh nghiệm, bảo hành công lắp\n\n📦 Đóng gói cẩn thận, có bảo hiểm hàng hóa`,
        tags: ['shipping']
      },
      {
        patterns: ['đổi trả','trả hàng','hoàn tiền','bảo hành','hỏng','lỗi','refund','return'],
        reply: `**Chính sách đổi trả & bảo hành** 🔄\n\n✅ **Đổi trả trong 7 ngày** nếu:\n• Sản phẩm bị lỗi kỹ thuật từ nhà sản xuất\n• Giao sai mẫu/màu/kích thước\n• Hàng bị hư hỏng trong quá trình vận chuyển\n\n🛡️ **Bảo hành:**\n• Khung, chân: 24 tháng\n• Mặt kính, gỗ: 12 tháng\n• Cơ chế (sofa, ghế): 18 tháng\n\n📞 Hotline đổi trả: **0345211386** (8:00-22:00)`,
        tags: ['return']
      },
      {
        patterns: ['thanh toán','trả góp','ngân hàng','visa','mastercard','paypal','usdt','cod','chuyển khoản'],
        reply: `**Phương thức thanh toán** 💳\n\n• 💵 **COD** — Trả tiền khi nhận hàng\n• 🏦 **Chuyển khoản** — 9 ngân hàng hỗ trợ\n• 💳 **Thẻ Visa/Mastercard** — Thanh toán online\n• 💰 **USDT** — Crypto (BSC, ETH, Polygon)\n• 🏪 **Trả góp 0%** — 3-24 tháng qua thẻ tín dụng\n\n✨ Trả góp 0% lãi cho đơn từ **10 triệu** trở lên!`,
        tags: ['payment']
      },
      {
        patterns: ['liên hệ','nhân viên','tư vấn viên','gặp người','hotline','số điện thoại','email'],
        reply: `**Liên hệ DQD Nội Thất** 📞\n\n📱 **Hotline:** 0345211386\n📧 **Email:** quocdat30075@gmail.com\n📍 **Địa chỉ:** Hà Đông, Hà Nội\n⏰ **Giờ làm việc:** 8:00 – 22:00 hàng ngày\n\n💬 Hoặc để lại tin nhắn, nhân viên sẽ phản hồi trong **< 30 phút** giờ hành chính.`,
        tags: ['contact'],
        followUp: 'contact'
      },
      {
        patterns: ['showroom','cửa hàng','địa chỉ','ghé thăm','xem trực tiếp'],
        reply: `**Showroom DQD Nội Thất** 🏪\n\n📍 Địa chỉ: Hà Đông, Hà Nội\n⏰ Mở cửa: 8:00 – 21:00 (T2 – CN)\n🅿️ Có bãi đỗ xe miễn phí\n\nBạn có thể **đặt lịch tham quan** để được nhân viên tư vấn riêng tại showroom!\n\n👉 Gọi **0345211386** để đặt hẹn`,
        tags: ['location']
      },
      {
        patterns: ['cảm ơn','thank','tks','oke','ok','được rồi','hiểu rồi'],
        reply: `Không có gì! 😊 Nếu cần thêm hỗ trợ, bạn cứ nhắn cho tôi nhé.\n\n**Chúc bạn mua sắm vui vẻ tại DQD! 🛋️**`,
        tags: ['thanks']
      },
      {
        patterns: ['tạm biệt','bye','goodbye','thôi','xong rồi'],
        reply: `Cảm ơn bạn đã liên hệ DQD Nội Thất! 👋\nHẹn gặp lại bạn lần sau. Chúc bạn một ngày thật vui! ☀️`,
        tags: ['bye']
      }
    ];
  
    // ══════════════════════════════════════════════
    // CHATBOT CLASS
    // ══════════════════════════════════════════════
  
    class DQDChatbot {
      constructor() {
        this.isOpen   = false;
        this.messages = [];
        this.context  = null;     // theo dõi context cuộc hội thoại
        this.unread   = 0;
        this._typing  = false;
        this._rateWin = [];       // rate limiting window
        this._searchTimer = null;
  
        this._loadHistory();
        this._buildUI();
        this._bindEvents();
  
        if (!this.messages.length) this._welcome();
      }
  
      // ── Build UI (SVG icons, no FontAwesome) ────
      _buildUI() {
        // Prevent duplicate
        document.getElementById('dqd-chat')?.remove();
  
        const wrap = document.createElement('div');
        wrap.id = 'dqd-chat';
        wrap.innerHTML = `
          <button id="dqd-toggle" class="dqd-toggle" aria-label="Mở hộp chat" aria-expanded="false">
            ${_svg('chat')}
            <span id="dqd-badge" class="dqd-badge" hidden>0</span>
          </button>
  
          <div id="dqd-window" class="dqd-window" hidden>
  
            <div class="dqd-head">
              <div class="dqd-head-info">
                <div class="dqd-avatar-ring">${_svg('bot')}</div>
                <div>
                  <div class="dqd-head-name">${CFG.brandName}</div>
                  <div class="dqd-head-status"><span class="dqd-status-dot"></span>Đang trực tuyến</div>
                </div>
              </div>
              <div class="dqd-head-actions">
                <button id="dqd-clear" title="Xóa lịch sử" aria-label="Xóa lịch sử chat">${_svg('trash')}</button>
                <button id="dqd-close" title="Đóng" aria-label="Đóng chat">${_svg('close')}</button>
              </div>
            </div>
  
            <div id="dqd-msgs" class="dqd-msgs" role="log" aria-live="polite" aria-label="Cuộc trò chuyện"></div>
  
            <div id="dqd-search-results" class="dqd-search-results" hidden></div>
  
            <div id="dqd-quick" class="dqd-quick"></div>
  
            <div class="dqd-input-row">
              <input id="dqd-input" type="text" placeholder="Nhập tin nhắn..." autocomplete="off" maxlength="500" aria-label="Tin nhắn">
              <button id="dqd-send" aria-label="Gửi">${_svg('send')}</button>
            </div>
  
          </div>
        `;
        document.body.appendChild(wrap);
        this._renderQuickReplies();
      }
  
      _bindEvents() {
        const $ = id => document.getElementById(id);
        $('dqd-toggle').addEventListener('click', () => this._toggle());
        $('dqd-close').addEventListener('click',  () => this._close());
        $('dqd-clear').addEventListener('click',  () => this._clearChat());
        $('dqd-send').addEventListener('click',   () => this._send());
  
        const input = $('dqd-input');
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send(); }
        });
  
        // Live product search suggestion
        input.addEventListener('input', () => {
          clearTimeout(this._searchTimer);
          const val = input.value.trim();
          if (val.length >= 2) {
            this._searchTimer = setTimeout(() => this._searchProducts(val), 400);
          } else {
            this._hideSearchResults();
          }
        });
      }
  
      // ── Toggle / Open / Close ──────────────────
      _toggle() {
        this.isOpen ? this._close() : this._open();
      }
  
      _open() {
        this.isOpen = true;
        const win = document.getElementById('dqd-window');
        const btn = document.getElementById('dqd-toggle');
        win.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        btn.innerHTML = _svg('close') + `<span id="dqd-badge" class="dqd-badge" hidden>0</span>`;
        this._clearUnread();
        setTimeout(() => document.getElementById('dqd-input')?.focus(), 100);
        this._scrollBottom();
      }
  
      _close() {
        this.isOpen = false;
        document.getElementById('dqd-window').setAttribute('hidden', '');
        const btn = document.getElementById('dqd-toggle');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = _svg('chat') + `<span id="dqd-badge" class="dqd-badge"${this.unread ? '' : ' hidden'}>${this.unread}</span>`;
      }
  
      _clearUnread() {
        this.unread = 0;
        const badge = document.getElementById('dqd-badge');
        if (badge) badge.setAttribute('hidden', '');
      }
  
      _bumpUnread() {
        if (this.isOpen) return;
        this.unread++;
        const badge = document.getElementById('dqd-badge');
        if (badge) {
          badge.textContent = this.unread > 9 ? '9+' : String(this.unread);
          badge.removeAttribute('hidden');
        }
      }
  
      // ── Quick replies ──────────────────────────
      _renderQuickReplies() {
        const labels = ['Tư vấn sản phẩm','Giá & Khuyến mãi','Vận chuyển','Đổi trả & Bảo hành','Thanh toán','Liên hệ nhân viên'];
        const container = document.getElementById('dqd-quick');
        if (!container) return;
        container.innerHTML = '';
        labels.forEach(label => {
          const btn = document.createElement('button');
          btn.className = 'dqd-qr';
          btn.textContent = label;
          btn.addEventListener('click', () => {
            this._addMsg('user', label);
            this._process(label);
          });
          container.appendChild(btn);
        });
      }
  
      // ── Send message ───────────────────────────
      _send() {
        const input = document.getElementById('dqd-input');
        const text  = input?.value.trim();
        if (!text) return;
  
        // Rate limiting
        const now = Date.now();
        this._rateWin = this._rateWin.filter(t => now - t < CFG.rateLimit.windowMs);
        if (this._rateWin.length >= CFG.rateLimit.max) {
          this._addMsg('bot', '⚠️ Bạn đang nhắn quá nhanh. Vui lòng chờ vài giây.');
          return;
        }
        this._rateWin.push(now);
  
        input.value = '';
        this._hideSearchResults();
        this._addMsg('user', text);
        this._process(text);
      }
  
      // ── Process & reply ────────────────────────
      _process(text) {
        if (this._typing) return;
        const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
        // Find best match in KB
        let best = null;
        let bestScore = 0;
  
        for (const entry of KB) {
          for (const pattern of entry.patterns) {
            const normPattern = pattern.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (lower.includes(normPattern)) {
              const score = normPattern.length; // longer match = better
              if (score > bestScore) { bestScore = score; best = entry; }
            }
          }
        }
  
        this._showTyping();
  
        setTimeout(() => {
          this._hideTyping();
  
          const reply = best
            ? (typeof best.reply === 'function' ? best.reply() : best.reply)
            : this._defaultReply(text);
  
          this._addMsg('bot', reply);
  
          // Follow-up action
          if (best?.followUp === 'contact') {
            setTimeout(() => this._addContactCard(), 800);
          }
  
          // Update context
          this.context = best?.tags?.[0] || null;
  
          this._saveToServer(text);
        }, CFG.typingMs);
      }
  
      _defaultReply(text) {
        return `Cảm ơn bạn đã nhắn tin! 🙏\n\nTôi chưa hiểu rõ yêu cầu của bạn. Bạn có thể:\n\n📞 Gọi **0345211386**\n📧 Email **quocdat30075@gmail.com**\n💬 Nhắn tại trang **Liên Hệ**\n\nHoặc thử hỏi về: sản phẩm, giá cả, vận chuyển, đổi trả...`;
      }
  
      // ── Add message to DOM ─────────────────────
      _addMsg(sender, text, opts = {}) {
        const container = document.getElementById('dqd-msgs');
        if (!container) return;
  
        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  
        // Date separator
        const dateStr = now.toLocaleDateString('vi-VN');
        const lastDate = container.getAttribute('data-last-date');
        if (lastDate !== dateStr) {
          const sep = document.createElement('div');
          sep.className = 'dqd-date-sep';
          sep.textContent = dateStr;
          container.appendChild(sep);
          container.setAttribute('data-last-date', dateStr);
        }
  
        const wrap = document.createElement('div');
        wrap.className = `dqd-msg ${sender}`;
  
        // Avatar
        const av = document.createElement('div');
        av.className = 'dqd-msg-av';
        av.innerHTML = sender === 'bot' ? _svg('bot-sm') : _svg('user-sm');
  
        // Bubble
        const bubble = document.createElement('div');
        bubble.className = 'dqd-bubble';
  
        // Render markdown-lite: **bold**, \n→<br>, bullet •
        bubble.innerHTML = _renderMd(text);
  
        const time = document.createElement('div');
        time.className = 'dqd-msg-time';
        time.textContent = timeStr;
        bubble.appendChild(time);
  
        if (sender === 'bot') {
          wrap.append(av, bubble);
        } else {
          wrap.append(bubble, av);
        }
  
        container.appendChild(wrap);
        this._scrollBottom();
  
        // Store
        this.messages.push({ sender, text, time: timeStr, date: dateStr });
        if (this.messages.length > CFG.maxHistory) this.messages = this.messages.slice(-CFG.maxHistory);
        this._saveHistory();
  
        if (sender === 'bot') this._bumpUnread();
      }
  
      // ── Typing indicator ───────────────────────
      _showTyping() {
        this._typing = true;
        const container = document.getElementById('dqd-msgs');
        const typing = document.createElement('div');
        typing.id = 'dqd-typing';
        typing.className = 'dqd-msg bot';
        typing.innerHTML = `
          <div class="dqd-msg-av">${_svg('bot-sm')}</div>
          <div class="dqd-bubble dqd-typing-bubble">
            <span></span><span></span><span></span>
          </div>`;
        container?.appendChild(typing);
        this._scrollBottom();
      }
  
      _hideTyping() {
        document.getElementById('dqd-typing')?.remove();
        this._typing = false;
      }
  
      // ── Contact card ───────────────────────────
      _addContactCard() {
        const container = document.getElementById('dqd-msgs');
        if (!container) return;
  
        const card = document.createElement('div');
        card.className = 'dqd-msg bot';
  
        const av = document.createElement('div');
        av.className = 'dqd-msg-av';
        av.innerHTML = _svg('bot-sm');
  
        const bubble = document.createElement('div');
        bubble.className = 'dqd-bubble dqd-card';
  
        const p = document.createElement('p');
        p.textContent = 'Bạn muốn để lại thông tin để nhân viên liên hệ lại?';
  
        const btn = document.createElement('a');
        btn.href = '/contact';
        btn.className = 'dqd-card-btn';
        btn.innerHTML = _svg('mail') + ' Trang Liên Hệ';
  
        bubble.append(p, btn);
        card.append(av, bubble);
        container.appendChild(card);
        this._scrollBottom();
      }
  
      // ── Live product search ────────────────────
      async _searchProducts(query) {
        try {
          const res = await fetch(`${CFG.searchApi}?q=${encodeURIComponent(query)}&limit=4`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.success && data.products?.length) {
            this._showSearchResults(data.products, query);
          } else {
            this._hideSearchResults();
          }
        } catch { this._hideSearchResults(); }
      }
  
      _showSearchResults(products, query) {
        const panel = document.getElementById('dqd-search-results');
        if (!panel) return;
        panel.innerHTML = '';
  
        const label = document.createElement('div');
        label.className = 'dqd-sr-label';
        label.textContent = `Kết quả cho "${query}"`;
        panel.appendChild(label);
  
        products.forEach(p => {
          const item = document.createElement('a');
          item.href = p.url || `/product/${p.id}`;
          item.className = 'dqd-sr-item';
  
          const img = document.createElement('img');
          img.src = p.image_url || '';
          img.alt = p.name;
          img.width = 40; img.height = 40;
          img.onerror = () => img.style.display = 'none';
  
          const info = document.createElement('div');
          info.className = 'dqd-sr-info';
  
          const name = document.createElement('div');
          name.className = 'dqd-sr-name';
          name.textContent = p.name;
  
          const price = document.createElement('div');
          price.className = 'dqd-sr-price';
          price.textContent = p.price ? `${Number(p.price).toLocaleString('vi-VN')}₫` : '';
  
          info.append(name, price);
          item.append(img, info);
          panel.appendChild(item);
        });
  
        panel.removeAttribute('hidden');
      }
  
      _hideSearchResults() {
        document.getElementById('dqd-search-results')?.setAttribute('hidden', '');
      }
  
      // ── Clear chat ─────────────────────────────
      _clearChat() {
        _showMiniConfirm('Xóa toàn bộ lịch sử chat?', () => {
          this.messages = [];
          this.context  = null;
          _safeStorage('remove', CFG.storageKey);
          const container = document.getElementById('dqd-msgs');
          if (container) { container.innerHTML = ''; container.removeAttribute('data-last-date'); }
          this._welcome();
        });
      }
  
      // ── Welcome ────────────────────────────────
      _welcome() {
        const entry = KB.find(e => e.tags?.includes('greet'));
        const text  = typeof entry?.reply === 'function' ? entry.reply() : (entry?.reply || `Xin chào! Tôi có thể giúp gì cho bạn?`);
        this._addMsg('bot', text);
      }
  
      // ── Persistence ────────────────────────────
      _saveHistory() {
        _safeStorage('set', CFG.storageKey, JSON.stringify({
          messages: this.messages,
          savedAt: Date.now()
        }));
      }
  
      _loadHistory() {
        const raw = _safeStorage('get', CFG.storageKey);
        if (!raw) return;
        try {
          const { messages, savedAt } = JSON.parse(raw);
          if (Date.now() - savedAt > CFG.sessionExpMs) {
            _safeStorage('remove', CFG.storageKey);
            return;
          }
          this.messages = Array.isArray(messages) ? messages.slice(-CFG.maxHistory) : [];
          this._restoreMessages();
        } catch { _safeStorage('remove', CFG.storageKey); }
      }
  
      _restoreMessages() {
        const container = document.getElementById('dqd-msgs');
        if (!container || !this.messages.length) return;
        this.messages.forEach(m => {
          const wrap   = document.createElement('div');
          wrap.className = `dqd-msg ${m.sender}`;
          const av     = document.createElement('div');
          av.className = 'dqd-msg-av';
          av.innerHTML = m.sender === 'bot' ? _svg('bot-sm') : _svg('user-sm');
          const bubble = document.createElement('div');
          bubble.className = 'dqd-bubble';
          bubble.innerHTML = _renderMd(m.text);
          const time = document.createElement('div');
          time.className = 'dqd-msg-time';
          time.textContent = m.time;
          bubble.appendChild(time);
          m.sender === 'bot' ? wrap.append(av, bubble) : wrap.append(bubble, av);
          container.appendChild(wrap);
        });
        this._scrollBottom();
      }
  
      async _saveToServer(message) {
        try {
          await fetch(CFG.saveApi, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, context: this.context, timestamp: new Date().toISOString() })
          });
        } catch { /* silent — non-critical */ }
      }
  
      _scrollBottom() {
        const el = document.getElementById('dqd-msgs');
        if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
      }
    }
  
    // ══════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════
  
    // Markdown-lite renderer (safe — no innerHTML from user input here, only KB strings)
    function _renderMd(text) {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')  // base escape
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')                     // **bold**
        .replace(/\n/g, '<br>');                                               // newlines
    }
  
    function _safeStorage(op, key, val) {
      try {
        if (op === 'get')    return localStorage.getItem(key);
        if (op === 'set')    localStorage.setItem(key, val);
        if (op === 'remove') localStorage.removeItem(key);
      } catch { return null; }
    }
  
    function _showMiniConfirm(msg, onOk) {
      const existing = document.getElementById('dqd-confirm');
      if (existing) existing.remove();
      const el = document.createElement('div');
      el.id = 'dqd-confirm';
      el.className = 'dqd-confirm';
      el.innerHTML = `<p>${msg}</p>
        <div>
          <button id="dqd-cf-no">Hủy</button>
          <button id="dqd-cf-ok" class="ok">Xóa</button>
        </div>`;
      document.getElementById('dqd-chat')?.appendChild(el);
      document.getElementById('dqd-cf-no').addEventListener('click', () => el.remove());
      document.getElementById('dqd-cf-ok').addEventListener('click', () => { el.remove(); onOk(); });
    }
  
    // SVG icon registry
    const _ICONS = {
      chat:    `<svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      close:   `<svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      send:    `<svg viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      bot:     `<svg viewBox="0 0 32 32" fill="none"><rect x="6" y="10" width="20" height="16" rx="4" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="18" r="2" fill="currentColor"/><circle cx="20" cy="18" r="2" fill="currentColor"/><path d="M16 4v6M13 26v2M19 26v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2 18h4M26 18h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
      'bot-sm':`<svg viewBox="0 0 20 20" fill="none"><rect x="3" y="6" width="14" height="10" rx="3" stroke="currentColor" stroke-width="1.4"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="12.5" cy="11" r="1.2" fill="currentColor"/><path d="M10 2v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
      'user-sm':`<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M4 17c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
      trash:   `<svg viewBox="0 0 20 20" fill="none"><path d="M4 5h12M8 5V3h4v2M6 5l.7 11h6.6L14 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      mail:    `<svg viewBox="0 0 16 16" fill="none" style="width:13px;height:13px"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M1 5l7 5 7-5" stroke="currentColor" stroke-width="1.2"/></svg>`,
    };
    function _svg(name) { return _ICONS[name] || ''; }
  
    // ── Inject CSS ────────────────────────────────
    function _injectCSS() {
      if (document.getElementById('dqd-chat-css')) return;
      const style = document.createElement('style');
      style.id = 'dqd-chat-css';
      style.textContent = `
        #dqd-chat { --gb:#b8922a; --dk:#1a1a18; --bd:#e8e3db; --lt:#f5f4f1; --wh:#fff; --tx:#2a2520; --mu:#7a7060;
          font-family:'Be Vietnam Pro',system-ui,sans-serif; position:fixed; bottom:1.5rem; right:1.5rem; z-index:9000; }
  
        /* Toggle button */
        .dqd-toggle { width:52px; height:52px; border-radius:50%; background:var(--dk); border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 4px 18px rgba(0,0,0,.25);
          transition:transform .2s,box-shadow .2s; position:relative; }
        .dqd-toggle:hover { transform:scale(1.08); box-shadow:0 6px 22px rgba(0,0,0,.3); }
        .dqd-toggle svg { width:24px; height:24px; }
        .dqd-badge { position:absolute; top:-4px; right:-4px; min-width:18px; height:18px; padding:0 4px;
          background:#dc2626; color:#fff; border-radius:99px; font-size:.65rem; font-weight:700;
          display:flex; align-items:center; justify-content:center; border:2px solid #fff; }
  
        /* Window */
        .dqd-window { position:absolute; bottom:64px; right:0; width:360px; max-height:560px;
          background:var(--wh); border-radius:16px; box-shadow:0 12px 40px rgba(0,0,0,.18);
          border:1.5px solid var(--bd); display:flex; flex-direction:column; overflow:hidden; }
  
        /* Header */
        .dqd-head { display:flex; align-items:center; justify-content:space-between; padding:.875rem 1rem;
          background:var(--dk); color:#fff; flex-shrink:0; }
        .dqd-head-info { display:flex; align-items:center; gap:.625rem; }
        .dqd-avatar-ring { width:36px; height:36px; border-radius:50%; background:rgba(184,146,42,.3);
          display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .dqd-avatar-ring svg { width:22px; height:22px; color:#e8c96b; }
        .dqd-head-name { font-size:.875rem; font-weight:700; letter-spacing:-.01em; }
        .dqd-head-status { display:flex; align-items:center; gap:.3rem; font-size:.7rem; color:rgba(255,255,255,.6); margin-top:1px; }
        .dqd-status-dot { width:6px; height:6px; border-radius:50%; background:#22c55e; flex-shrink:0; }
        .dqd-head-actions { display:flex; gap:.25rem; }
        .dqd-head-actions button { width:28px; height:28px; border:none; background:rgba(255,255,255,.1);
          border-radius:6px; cursor:pointer; color:rgba(255,255,255,.7); display:flex; align-items:center; justify-content:center;
          transition:background .15s; }
        .dqd-head-actions button:hover { background:rgba(255,255,255,.2); color:#fff; }
        .dqd-head-actions button svg { width:14px; height:14px; }
  
        /* Messages */
        .dqd-msgs { flex:1; overflow-y:auto; padding:.875rem .75rem; display:flex; flex-direction:column; gap:.5rem;
          scroll-behavior:smooth; scrollbar-width:thin; scrollbar-color:var(--bd) transparent; }
        .dqd-msgs::-webkit-scrollbar { width:4px; }
        .dqd-msgs::-webkit-scrollbar-thumb { background:var(--bd); border-radius:99px; }
  
        .dqd-date-sep { text-align:center; font-size:.65rem; color:var(--mu); padding:.25rem 0;
          position:relative; }
        .dqd-date-sep::before, .dqd-date-sep::after { content:''; position:absolute; top:50%; width:30%;
          height:1px; background:var(--bd); }
        .dqd-date-sep::before { left:0; }
        .dqd-date-sep::after { right:0; }
  
        .dqd-msg { display:flex; align-items:flex-end; gap:.5rem; }
        .dqd-msg.user { flex-direction:row-reverse; }
        .dqd-msg-av { width:28px; height:28px; border-radius:50%; background:var(--lt); border:1.5px solid var(--bd);
          display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .dqd-msg-av svg { width:15px; height:15px; color:var(--mu); }
        .dqd-msg.bot .dqd-msg-av { background:rgba(184,146,42,.1); border-color:rgba(184,146,42,.3); }
        .dqd-msg.bot .dqd-msg-av svg { color:#b8922a; }
  
        .dqd-bubble { max-width:78%; padding:.625rem .875rem; border-radius:14px; font-size:.8125rem;
          line-height:1.55; color:var(--tx); position:relative; word-break:break-word; }
        .dqd-msg.bot .dqd-bubble { background:var(--lt); border:1.5px solid var(--bd); border-bottom-left-radius:4px; }
        .dqd-msg.user .dqd-bubble { background:var(--dk); color:#fff; border-bottom-right-radius:4px; }
        .dqd-msg.user .dqd-msg-time { color:rgba(255,255,255,.45); }
        .dqd-msg-time { font-size:.62rem; color:var(--mu); margin-top:.3rem; text-align:right; }
  
        /* Typing */
        .dqd-typing-bubble { display:flex; align-items:center; gap:4px; padding:.625rem .875rem; }
        .dqd-typing-bubble span { width:7px; height:7px; border-radius:50%; background:var(--mu);
          animation:dqdBounce 1.2s infinite; }
        .dqd-typing-bubble span:nth-child(2) { animation-delay:.2s; }
        .dqd-typing-bubble span:nth-child(3) { animation-delay:.4s; }
        @keyframes dqdBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
  
        /* Contact card */
        .dqd-card p { margin:0 0 .625rem; font-size:.8125rem; }
        .dqd-card-btn { display:inline-flex; align-items:center; gap:.375rem; padding:.5rem .875rem;
          background:var(--dk); color:#fff; border-radius:8px; font-size:.75rem; font-weight:600;
          text-decoration:none; transition:background .15s; }
        .dqd-card-btn:hover { background:#2e2e2a; }
  
        /* Search results */
        .dqd-search-results { border-top:1px solid var(--bd); background:var(--wh); max-height:200px; overflow-y:auto; flex-shrink:0; }
        .dqd-sr-label { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em;
          color:var(--mu); padding:.5rem .875rem .25rem; }
        .dqd-sr-item { display:flex; align-items:center; gap:.625rem; padding:.5rem .875rem;
          text-decoration:none; color:var(--tx); border-bottom:1px solid var(--bd); transition:background .12s; }
        .dqd-sr-item:last-child { border-bottom:none; }
        .dqd-sr-item:hover { background:var(--lt); }
        .dqd-sr-item img { width:40px; height:40px; object-fit:cover; border-radius:6px; border:1px solid var(--bd); flex-shrink:0; }
        .dqd-sr-name { font-size:.8rem; font-weight:600; color:var(--dk); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dqd-sr-price { font-size:.72rem; color:#b8922a; font-weight:600; margin-top:1px; }
  
        /* Quick replies */
        .dqd-quick { display:flex; gap:.375rem; flex-wrap:wrap; padding:.5rem .75rem; border-top:1px solid var(--bd);
          flex-shrink:0; background:var(--wh); }
        .dqd-qr { padding:.35rem .75rem; border:1.5px solid var(--bd); border-radius:99px;
          font-family:inherit; font-size:.72rem; font-weight:600; color:var(--mu); background:var(--wh);
          cursor:pointer; transition:all .15s; white-space:nowrap; }
        .dqd-qr:hover { border-color:var(--dk); color:var(--dk); }
  
        /* Input */
        .dqd-input-row { display:flex; align-items:center; gap:.5rem; padding:.75rem; border-top:1px solid var(--bd); flex-shrink:0; }
        #dqd-input { flex:1; border:1.5px solid var(--bd); border-radius:8px; padding:.55rem .875rem;
          font-family:inherit; font-size:.875rem; color:var(--tx); outline:none; transition:border-color .18s; }
        #dqd-input:focus { border-color:#b8922a; box-shadow:0 0 0 3px rgba(184,146,42,.1); }
        #dqd-send { width:36px; height:36px; border:none; border-radius:8px; background:var(--dk); color:#fff;
          cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background .15s; }
        #dqd-send:hover { background:#2e2e2a; }
        #dqd-send svg { width:16px; height:16px; }
  
        /* Mini confirm */
        .dqd-confirm { position:absolute; bottom:56px; right:0; background:var(--wh); border:1.5px solid var(--bd);
          border-radius:10px; padding:.875rem 1rem; box-shadow:0 4px 16px rgba(0,0,0,.12); width:220px; z-index:10; }
        .dqd-confirm p { font-size:.8125rem; color:var(--tx); margin:0 0 .75rem; }
        .dqd-confirm div { display:flex; gap:.5rem; }
        .dqd-confirm button { flex:1; padding:.5rem; border-radius:7px; font-family:inherit; font-size:.78rem;
          font-weight:600; cursor:pointer; border:1.5px solid var(--bd); background:var(--wh); color:var(--mu); transition:all .15s; }
        .dqd-confirm button:hover { border-color:var(--dk); color:var(--dk); }
        .dqd-confirm button.ok { background:#dc2626; border-color:#dc2626; color:#fff; }
        .dqd-confirm button.ok:hover { background:#b91c1c; }
  
        @media (max-width:420px) {
          .dqd-window { width:calc(100vw - 2rem); right:-0.25rem; }
        }
      `;
      document.head.appendChild(style);
    }
  
    // ── Boot ─────────────────────────────────────
    function _boot() {
      _injectCSS();
      window.dqdChatbot = new DQDChatbot();
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _boot, { once: true });
    } else {
      _boot();
    }
  
  })();