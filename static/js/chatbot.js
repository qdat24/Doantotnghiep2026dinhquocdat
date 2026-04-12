// DQD Chatbot Widget
(function () {

  var CFG = {
    brandName:    'DQD Nội Thất',
    maxHistory:   30,
    typingMs:     700,
    storageKey:   'dqd_chat_v2',
    saveApi:      '/api/chatbot-message',
    searchApi:    '/api/products/search',
    rateLimitMax: 6,
    rateLimitMs:  10000,
    sessionExpMs: 86400000
  };

  var KB = [
    { patterns: ['xin chào','hello','hi','chào','hey'],
      reply: function() { return 'Xin chào! 👋 Tôi là trợ lý ảo của **' + CFG.brandName + '**.\nTôi có thể giúp bạn:\n\n• 🛋️ Tư vấn & tìm sản phẩm\n• 💰 Thông tin giá cả & khuyến mãi\n• 🚚 Chính sách vận chuyển\n• 🔄 Đổi trả & bảo hành\n• 📞 Kết nối nhân viên\n\nBạn cần hỗ trợ gì?'; },
      tags: ['greet'] },
    { patterns: ['tư vấn','sản phẩm','mua','chọn','gợi ý'],
      reply: 'Tôi rất vui được tư vấn! 🛋️ Bạn đang tìm nội thất cho:\n\n**1.** Phòng khách\n**2.** Phòng ngủ\n**3.** Nhà bếp\n**4.** Văn phòng\n**5.** Phòng ăn\n\nHoặc nhập tên sản phẩm để tôi tìm ngay! 🔍',
      tags: ['product'] },
    { patterns: ['phòng khách','sofa','bàn trà','kệ tivi'],
      reply: 'Nội thất **Phòng Khách** 🛋️\n\n• Sofa góc L, sofa văng, sofa da\n• Bàn trà kính, gỗ, đá marble\n• Kệ tivi hiện đại\n\nGiá từ **2.5 triệu → 85 triệu**.',
      tags: ['product'] },
    { patterns: ['phòng ngủ','giường','tủ quần áo','nệm'],
      reply: 'Nội thất **Phòng Ngủ** 🛏️\n\n• Giường gỗ, giường bọc da\n• Tủ quần áo 2-6 cánh\n• Nệm lò xo, nệm foam\n\nGiá từ **3 triệu → 120 triệu**.',
      tags: ['product'] },
    { patterns: ['văn phòng','bàn làm việc','ghế văn phòng'],
      reply: 'Nội thất **Văn Phòng** 💼\n\n• Bàn làm việc đơn, bàn góc L\n• Ghế ergonomic, ghế gaming\n• Tủ hồ sơ, kệ sách\n\nGiá từ **1.5 triệu → 45 triệu**.',
      tags: ['product'] },
    { patterns: ['giá','bao nhiêu','chi phí','ngân sách'],
      reply: '**Bảng giá tham khảo** 💰\n\n• Sofa: 3.5 – 85tr\n• Giường: 3 – 120tr\n• Tủ quần áo: 4 – 60tr\n• Bàn làm việc: 1.5 – 45tr\n\n✨ Miễn phí vận chuyển đơn từ **5 triệu**!',
      tags: ['price'] },
    { patterns: ['khuyến mãi','giảm giá','sale','voucher','coupon'],
      reply: '🎉 **Ưu đãi đang có:**\n\n• **NEW15** — Giảm 15% khách mới\n• **SHIP5M** — Miễn phí ship đơn 5tr+\n• **SALE30** — Giảm 30% sản phẩm chọn lọc',
      tags: ['promo'] },
    { patterns: ['vận chuyển','giao hàng','ship','bao lâu'],
      reply: '**Chính sách vận chuyển** 🚚\n\n• HN/HCM: 1-3 ngày, miễn phí đơn ≥5tr\n• Tỉnh khác: 3-7 ngày, miễn phí đơn ≥5tr\n• Lắp đặt tại nhà: Miễn phí',
      tags: ['shipping'] },
    { patterns: ['đổi trả','bảo hành','hoàn tiền','lỗi'],
      reply: '**Đổi trả & Bảo hành** 🔄\n\n✅ Đổi trả 7 ngày nếu lỗi kỹ thuật\n🛡️ Bảo hành 12-24 tháng\n📞 Hotline: **0345211386**',
      tags: ['return'] },
    { patterns: ['thanh toán','trả góp','cod','chuyển khoản'],
      reply: '**Thanh toán** 💳\n\n• COD — Trả khi nhận hàng\n• Chuyển khoản ngân hàng\n• Visa/Mastercard\n• Trả góp 0% (đơn ≥10tr)',
      tags: ['payment'] },
    { patterns: ['liên hệ','nhân viên','hotline','điện thoại','email'],
      reply: '**Liên hệ DQD** 📞\n\n📱 **0345211386**\n📧 quocdat30075@gmail.com\n📍 Hà Đông, Hà Nội\n⏰ 8:00 – 22:00 hàng ngày',
      tags: ['contact'] },
    { patterns: ['cảm ơn','thank','ok','được rồi'],
      reply: 'Không có gì! 😊 Chúc bạn mua sắm vui vẻ tại DQD! 🛋️',
      tags: ['thanks'] },
    { patterns: ['tạm biệt','bye'],
      reply: 'Cảm ơn bạn đã liên hệ! 👋 Hẹn gặp lại!',
      tags: ['bye'] }
  ];

  // ── State ──
  var state = {
    isOpen:   false,
    messages: [],
    context:  null,
    unread:   0,
    typing:   false,
    rateWin:  []
  };

  // ── Inject CSS ──
  function injectCSS() {
    if (document.getElementById('dqd-css')) return;
    var s = document.createElement('style');
    s.id = 'dqd-css';
    s.textContent = ''
      + '#dqd-chat{position:fixed;bottom:80px;right:20px;z-index:9999;font-family:"Be Vietnam Pro",sans-serif}'
      + '#dqd-toggle{width:52px;height:52px;border-radius:50%;background:#1a1a18;border:none;cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;color:#fff;'
      + 'box-shadow:0 4px 18px rgba(0,0,0,.3);position:relative;transition:transform .2s}'
      + '#dqd-toggle:hover{transform:scale(1.08)}'
      + '#dqd-toggle svg{width:24px;height:24px}'
      + '#dqd-badge{position:absolute;top:-3px;right:-3px;background:#dc2626;color:#fff;border-radius:99px;'
      + 'min-width:18px;height:18px;font-size:.65rem;font-weight:700;display:flex;align-items:center;'
      + 'justify-content:center;border:2px solid #fff;padding:0 3px}'
      + '#dqd-window{position:absolute;bottom:60px;right:0;width:360px;max-height:560px;'
      + 'background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.18);'
      + 'border:1.5px solid #e8e3db;flex-direction:column;overflow:hidden}'
      + '#dqd-head{display:flex;align-items:center;justify-content:space-between;padding:.875rem 1rem;'
      + 'background:#1a1a18;color:#fff;flex-shrink:0;border-radius:16px 16px 0 0}'
      + '#dqd-head-info{display:flex;align-items:center;gap:.625rem}'
      + '#dqd-av{width:36px;height:36px;border-radius:50%;background:rgba(184,146,42,.3);'
      + 'display:flex;align-items:center;justify-content:center}'
      + '#dqd-av svg{width:22px;height:22px;color:#e8c96b}'
      + '#dqd-name{font-size:.875rem;font-weight:700}'
      + '#dqd-status{display:flex;align-items:center;gap:.3rem;font-size:.7rem;color:rgba(255,255,255,.6);margin-top:1px}'
      + '.dqd-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;animation:dqdPulse 2s infinite}'
      + '@keyframes dqdPulse{0%,100%{opacity:1}50%{opacity:.4}}'
      + '#dqd-actions{display:flex;gap:.25rem}'
      + '#dqd-actions button{width:28px;height:28px;border:none;background:rgba(255,255,255,.1);'
      + 'border-radius:6px;cursor:pointer;color:rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center}'
      + '#dqd-actions button:hover{background:rgba(255,255,255,.2);color:#fff}'
      + '#dqd-actions button svg{width:14px;height:14px}'
      + '#dqd-msgs{flex:1;overflow-y:auto;padding:.875rem .75rem;display:flex;flex-direction:column;gap:.5rem}'
      + '#dqd-msgs::-webkit-scrollbar{width:4px}'
      + '#dqd-msgs::-webkit-scrollbar-thumb{background:#e8e3db;border-radius:4px}'
      + '.dqd-msg{display:flex;align-items:flex-end;gap:.5rem}'
      + '.dqd-msg.user{flex-direction:row-reverse}'
      + '.dqd-av{width:28px;height:28px;border-radius:50%;background:#f5f4f1;border:1.5px solid #e8e3db;'
      + 'display:flex;align-items:center;justify-content:center;flex-shrink:0}'
      + '.dqd-av svg{width:15px;height:15px;color:#7a7060}'
      + '.dqd-msg.bot .dqd-av{background:rgba(184,146,42,.1);border-color:rgba(184,146,42,.3)}'
      + '.dqd-msg.bot .dqd-av svg{color:#b8922a}'
      + '.dqd-bub{max-width:78%;padding:.625rem .875rem;border-radius:14px;font-size:.8125rem;line-height:1.55;word-break:break-word}'
      + '.dqd-msg.bot .dqd-bub{background:#f5f4f1;border:1.5px solid #e8e3db;border-bottom-left-radius:4px;color:#2a2520}'
      + '.dqd-msg.user .dqd-bub{background:#1a1a18;color:#fff;border-bottom-right-radius:4px}'
      + '.dqd-time{font-size:.62rem;color:#7a7060;margin-top:.3rem;text-align:right}'
      + '.dqd-msg.user .dqd-time{color:rgba(255,255,255,.45)}'
      + '.dqd-typing{display:flex;align-items:center;gap:4px;padding:.625rem .875rem}'
      + '.dqd-typing span{width:7px;height:7px;border-radius:50%;background:#7a7060;animation:dqdBounce 1.2s infinite}'
      + '.dqd-typing span:nth-child(2){animation-delay:.2s}'
      + '.dqd-typing span:nth-child(3){animation-delay:.4s}'
      + '@keyframes dqdBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}'
      + '#dqd-quick{display:flex;gap:.375rem;flex-wrap:wrap;padding:.5rem .75rem;border-top:1px solid #e8e3db;flex-shrink:0}'
      + '.dqd-qr{padding:.35rem .75rem;border:1.5px solid #e8e3db;border-radius:99px;'
      + 'font-size:.72rem;font-weight:600;color:#7a7060;background:#fff;cursor:pointer;white-space:nowrap}'
      + '.dqd-qr:hover{border-color:#1a1a18;color:#1a1a18}'
      + '#dqd-irow{display:flex;align-items:center;gap:.5rem;padding:.75rem;border-top:1px solid #e8e3db;flex-shrink:0}'
      + '#dqd-input{flex:1;border:1.5px solid #e8e3db;border-radius:8px;padding:.55rem .875rem;'
      + 'font-size:.875rem;color:#2a2520;outline:none}'
      + '#dqd-input:focus{border-color:#b8922a;box-shadow:0 0 0 3px rgba(184,146,42,.1)}'
      + '#dqd-send{width:36px;height:36px;border:none;border-radius:8px;background:#1a1a18;color:#fff;'
      + 'cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
      + '#dqd-send:hover{background:#2e2e2a}'
      + '#dqd-send svg{width:16px;height:16px}'
      + '@media(max-width:420px){#dqd-window{width:calc(100vw - 2rem);right:-.25rem}}';
    document.head.appendChild(s);
  }

  // ── SVG icons ──
  var ICONS = {
    chat:  '<svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    send:  '<svg viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bot:   '<svg viewBox="0 0 32 32" fill="none"><rect x="6" y="10" width="20" height="16" rx="4" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="18" r="2" fill="currentColor"/><circle cx="20" cy="18" r="2" fill="currentColor"/><path d="M16 4v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    bots:  '<svg viewBox="0 0 20 20" fill="none"><rect x="3" y="6" width="14" height="10" rx="3" stroke="currentColor" stroke-width="1.4"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="12.5" cy="11" r="1.2" fill="currentColor"/><path d="M10 2v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    user:  '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M4 17c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 20 20" fill="none"><path d="M4 5h12M8 5V3h4v2M6 5l.7 11h6.6L14 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // ── Build UI ──
  function buildUI() {
    var old = document.getElementById('dqd-chat');
    if (old) old.parentNode.removeChild(old);

    var wrap = document.createElement('div');
    wrap.id = 'dqd-chat';

    // Toggle button
    var toggle = document.createElement('button');
    toggle.id = 'dqd-toggle';
    toggle.setAttribute('aria-label', 'Mở chat');
    toggle.innerHTML = ICONS.chat + '<span id="dqd-badge" style="display:none">0</span>';
    toggle.onclick = function() { toggleChat(); };
    wrap.appendChild(toggle);

    // Window
    var win = document.createElement('div');
    win.id = 'dqd-window';
    win.style.display = 'none';
    win.innerHTML = ''
      + '<div id="dqd-head">'
      +   '<div id="dqd-head-info">'
      +     '<div id="dqd-av">' + ICONS.bot + '</div>'
      +     '<div><div id="dqd-name">' + CFG.brandName + '</div>'
      +       '<div id="dqd-status"><span class="dqd-dot"></span>Đang trực tuyến</div>'
      +     '</div>'
      +   '</div>'
      +   '<div id="dqd-actions">'
      +     '<button onclick="clearChat()" title="Xóa">' + ICONS.trash + '</button>'
      +     '<button onclick="closeChat()" title="Đóng">' + ICONS.close + '</button>'
      +   '</div>'
      + '</div>'
      + '<div id="dqd-msgs"></div>'
      + '<div id="dqd-quick"></div>'
      + '<div id="dqd-irow">'
      +   '<input id="dqd-input" type="text" placeholder="Nhập tin nhắn..." maxlength="500">'
      +   '<button id="dqd-send">' + ICONS.send + '</button>'
      + '</div>';
    wrap.appendChild(win);
    document.body.appendChild(wrap);

    // Bind input
    var input = document.getElementById('dqd-input');
    input.onkeydown = function(e) { if (e.keyCode === 13) { e.preventDefault(); sendMsg(); } };
    document.getElementById('dqd-send').onclick = function() { sendMsg(); };

    buildQuickReplies();
  }

  // ── Global toggle functions (accessible from onclick) ──
  window.toggleChat = function() {
    var win = document.getElementById('dqd-window');
    if (!win) return;
    if (state.isOpen) {
      closeChat();
    } else {
      state.isOpen = true;
      win.style.display = 'flex';
      document.getElementById('dqd-toggle').innerHTML = ICONS.close + '<span id="dqd-badge" style="display:none">0</span>';
      clearUnread();
      setTimeout(function() {
        var inp = document.getElementById('dqd-input');
        if (inp) inp.focus();
      }, 100);
      scrollBottom();
    }
  };

  window.closeChat = function() {
    var win = document.getElementById('dqd-window');
    if (!win) return;
    state.isOpen = false;
    win.style.display = 'none';
    document.getElementById('dqd-toggle').innerHTML = ICONS.chat
      + '<span id="dqd-badge" style="' + (state.unread > 0 ? '' : 'display:none') + '">' + state.unread + '</span>';
  };

  window.clearChat = function() {
    if (!confirm('Xóa toàn bộ lịch sử chat?')) return;
    state.messages = [];
    state.context  = null;
    try { localStorage.removeItem(CFG.storageKey); } catch(e) {}
    var c = document.getElementById('dqd-msgs');
    if (c) c.innerHTML = '';
    addMsg('bot', getWelcome());
  };

  function clearUnread() {
    state.unread = 0;
    var b = document.getElementById('dqd-badge');
    if (b) b.style.display = 'none';
  }

  function bumpUnread() {
    if (state.isOpen) return;
    state.unread++;
    var b = document.getElementById('dqd-badge');
    if (b) { b.textContent = state.unread > 9 ? '9+' : String(state.unread); b.style.display = 'flex'; }
  }

  // ── Quick replies ──
  function buildQuickReplies() {
    var labels = ['Tư vấn sản phẩm','Giá & Khuyến mãi','Vận chuyển','Đổi trả & Bảo hành','Thanh toán','Liên hệ'];
    var c = document.getElementById('dqd-quick');
    if (!c) return;
    c.innerHTML = '';
    labels.forEach(function(label) {
      var btn = document.createElement('button');
      btn.className = 'dqd-qr';
      btn.textContent = label;
      btn.onclick = function() { addMsg('user', label); processMsg(label); };
      c.appendChild(btn);
    });
  }

  // ── Send & process ──
  window.sendMsg = function() {
    var input = document.getElementById('dqd-input');
    if (!input) return;
    var text = input.value.replace(/^\s+|\s+$/g, '');
    if (!text) return;

    var now = Date.now();
    state.rateWin = state.rateWin.filter(function(t) { return now - t < CFG.rateLimitMs; });
    if (state.rateWin.length >= CFG.rateLimitMax) {
      addMsg('bot', '⚠️ Bạn nhắn quá nhanh. Vui lòng chờ vài giây.'); return;
    }
    state.rateWin.push(now);
    input.value = '';
    addMsg('user', text);
    processMsg(text);
  };

  function processMsg(text) {
    if (state.typing) return;
    var lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var best = null, bestScore = 0;
    for (var i = 0; i < KB.length; i++) {
      for (var j = 0; j < KB[i].patterns.length; j++) {
        var p = KB[i].patterns[j].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (lower.indexOf(p) !== -1 && p.length > bestScore) {
          bestScore = p.length; best = KB[i];
        }
      }
    }
    showTyping();
    setTimeout(function() {
      hideTyping();
      var reply = best
        ? (typeof best.reply === 'function' ? best.reply() : best.reply)
        : 'Cảm ơn bạn! 🙏\n\nVui lòng liên hệ:\n📞 **0345211386**\n📧 quocdat30075@gmail.com';
      addMsg('bot', reply);
      state.context = best && best.tags ? best.tags[0] : null;
      saveToServer(text);
    }, CFG.typingMs);
  }

  function getWelcome() {
    var e = null;
    for (var i = 0; i < KB.length; i++) {
      if (KB[i].tags && KB[i].tags.indexOf('greet') !== -1) { e = KB[i]; break; }
    }
    return e ? (typeof e.reply === 'function' ? e.reply() : e.reply) : 'Xin chào! Tôi có thể giúp gì?';
  }

  // ── Messages ──
  function addMsg(sender, text) {
    var c = document.getElementById('dqd-msgs');
    if (!c) return;
    var now = new Date();
    var timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    var wrap = document.createElement('div');
    wrap.className = 'dqd-msg ' + sender;
    var av = document.createElement('div');
    av.className = 'dqd-av';
    av.innerHTML = sender === 'bot' ? ICONS.bots : ICONS.user;
    var bub = document.createElement('div');
    bub.className = 'dqd-bub';
    bub.innerHTML = renderMd(text);
    var time = document.createElement('div');
    time.className = 'dqd-time';
    time.textContent = timeStr;
    bub.appendChild(time);
    if (sender === 'bot') { wrap.appendChild(av); wrap.appendChild(bub); }
    else { wrap.appendChild(bub); wrap.appendChild(av); }
    c.appendChild(wrap);
    scrollBottom();

    state.messages.push({ sender: sender, text: text, time: timeStr });
    if (state.messages.length > CFG.maxHistory) state.messages = state.messages.slice(-CFG.maxHistory);
    saveHistory();
    if (sender === 'bot') bumpUnread();
  }

  function showTyping() {
    state.typing = true;
    var c = document.getElementById('dqd-msgs');
    if (!c) return;
    var d = document.createElement('div');
    d.id = 'dqd-typing-indicator';
    d.className = 'dqd-msg bot';
    d.innerHTML = '<div class="dqd-av">' + ICONS.bots + '</div><div class="dqd-bub dqd-typing"><span></span><span></span><span></span></div>';
    c.appendChild(d);
    scrollBottom();
  }

  function hideTyping() {
    var d = document.getElementById('dqd-typing-indicator');
    if (d) d.parentNode.removeChild(d);
    state.typing = false;
  }

  function scrollBottom() {
    var c = document.getElementById('dqd-msgs');
    if (c) { try { c.scrollTop = c.scrollHeight; } catch(e) {} }
  }

  // ── Markdown lite ──
  function renderMd(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // ── Storage ──
  function saveHistory() {
    try { localStorage.setItem(CFG.storageKey, JSON.stringify({ messages: state.messages, savedAt: Date.now() })); } catch(e) {}
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(CFG.storageKey);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (Date.now() - d.savedAt > CFG.sessionExpMs) { localStorage.removeItem(CFG.storageKey); return; }
      state.messages = Array.isArray(d.messages) ? d.messages.slice(-CFG.maxHistory) : [];
      restoreMessages();
    } catch(e) {}
  }

  function restoreMessages() {
    var c = document.getElementById('dqd-msgs');
    if (!c) return;
    state.messages.forEach(function(m) {
      var wrap = document.createElement('div');
      wrap.className = 'dqd-msg ' + m.sender;
      var av = document.createElement('div');
      av.className = 'dqd-av';
      av.innerHTML = m.sender === 'bot' ? ICONS.bots : ICONS.user;
      var bub = document.createElement('div');
      bub.className = 'dqd-bub';
      bub.innerHTML = renderMd(m.text);
      var time = document.createElement('div');
      time.className = 'dqd-time';
      time.textContent = m.time;
      bub.appendChild(time);
      if (m.sender === 'bot') { wrap.appendChild(av); wrap.appendChild(bub); }
      else { wrap.appendChild(bub); wrap.appendChild(av); }
      c.appendChild(wrap);
    });
    scrollBottom();
  }

  function saveToServer(msg) {
    try {
      fetch(CFG.saveApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: state.context, timestamp: new Date().toISOString() })
      });
    } catch(e) {}
  }

  // ── Boot ──
  function boot() {
    injectCSS();
    loadHistory();
    buildUI();
    if (!state.messages.length) addMsg('bot', getWelcome());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();