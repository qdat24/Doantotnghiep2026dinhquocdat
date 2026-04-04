// ============================================
// DQD — Anime.js Animation System (Optimized)
// ============================================
(function () {
    'use strict';
  
    // ── FIX 1: Guard — anime.js chưa load thì không crash ──
    if (typeof window.anime === 'undefined') {
      console.warn('[DQD Anim] anime.js not loaded. Animations disabled.');
      return;
    }
  
    // ── FIX 2: Respect prefers-reduced-motion ──
    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (REDUCED) {
      console.info('[DQD Anim] Reduced motion preferred. Skipping animations.');
      return;
    }
  
    // ── Defaults ─────────────────────────────────
    const D = {
      ease:   'easeOutExpo',
      easEl:  'easeOutElastic(1, .8)',
      short:  200,
      mid:    500,
      long:   800,
      stagger:80,
    };
  
    // ── FIX 3: One shared IntersectionObserver instead of many ──
    const _ioCallbacks = new Map();  // element → callback
  
    const _io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const cb = _ioCallbacks.get(entry.target);
        if (cb) { cb(entry.target); _ioCallbacks.delete(entry.target); }
        _io.unobserve(entry.target);
      });
    }, { threshold: 0.1 });
  
    function onVisible(el, cb) {
      _ioCallbacks.set(el, cb);
      _io.observe(el);
    }
  
    // ── FIX 4: Hover helper — event delegation, no N×listeners ──
    //   Call once per container, not per element
    function _hoverDelegate(container, selector, enterProps, leaveProps, dur = D.short) {
      if (!container) return;
      container.addEventListener('mouseenter', e => {
        const el = e.target.closest(selector);
        if (el && container.contains(el)) anime({ targets: el, ...enterProps, duration: dur, easing: 'easeOutQuad' });
      }, true);
      container.addEventListener('mouseleave', e => {
        const el = e.target.closest(selector);
        if (el && container.contains(el)) anime({ targets: el, ...leaveProps, duration: dur, easing: 'easeOutQuad' });
      }, true);
    }
  
    // ═══════════════════════════════════════════
    // HERO
    // ═══════════════════════════════════════════
    function _hero() {
      const items = [
        { sel: '.hero-modern h1',    delay: 200, from: { translateY: -50 } },
        { sel: '.hero-modern p',     delay: 400, from: { translateY:  30 } },
        { sel: '.hero-buttons',      delay: 600, from: { translateY:  20 } },
      ];
      items.forEach(({ sel, delay, from }) => {
        const el = document.querySelector(sel);
        if (!el) return;
        anime({ targets: el, opacity: [0, 1], ...Object.fromEntries(Object.entries(from).map(([k,v]) => [k, [v, 0]])),
                duration: D.long, delay, easing: D.ease });
      });
    }
  
    // ═══════════════════════════════════════════
    // PRODUCT CARDS — scroll-triggered stagger
    // ═══════════════════════════════════════════
    function _productCards() {
      const cards = [...document.querySelectorAll('.product-new')];
      if (!cards.length) return;
  
      // FIX 5: stagger index must be global, not per-batch
      cards.forEach((card, globalIdx) => {
        card.style.opacity = '0';
        onVisible(card, el => {
          anime({ targets: el, opacity: [0, 1], translateY: [40, 0], scale: [0.95, 1],
                  duration: D.mid, delay: (globalIdx % 4) * D.stagger, easing: D.ease });
        });
      });
    }
  
    // ═══════════════════════════════════════════
    // CATEGORY ITEMS
    // ═══════════════════════════════════════════
    function _categoryItems() {
      const items = [...document.querySelectorAll('.cat-item')];
      if (!items.length) return;
  
      // Load animation — only if in viewport
      items.forEach((item, i) => {
        item.style.opacity = '0';
        onVisible(item, el => {
          anime({ targets: el, opacity: [0, 1], translateX: [-30, 0],
                  duration: D.mid, delay: i * 80, easing: D.ease });
        });
      });
  
      // FIX 4: delegation instead of N listeners
      const wrap = items[0].closest('section, .categories-wrap') || document.body;
      _hoverDelegate(wrap, '.cat-item',
        { translateY: -12, scale: 1.02 },
        { translateY:   0, scale:    1 }
      );
      _hoverDelegate(wrap, '.cat-icon',
        { rotate: 8, scale: 1.15 },
        { rotate: 0, scale:    1 }
      );
    }
  
    // ═══════════════════════════════════════════
    // BUTTONS — click ripple only (hover via CSS)
    // ═══════════════════════════════════════════
    function _buttons() {
      // FIX 6: Hover effects belong in CSS (transition), not JS.
      //         JS only handles click — non-repeatable state change.
      document.addEventListener('click', e => {
        const btn = e.target.closest('.btn, button[type="submit"]');
        if (!btn) return;
        anime({ targets: btn, scale: [1, 0.93, 1], duration: D.short, easing: 'easeInOutQuad' });
      });
    }
  
    // ═══════════════════════════════════════════
    // CART COUNT
    // ═══════════════════════════════════════════
    function _cartCount() {
      const el = document.querySelector('.cart-count');
      if (!el) return;
  
      // FIX 7: Monkey-patch safely with original fallback
      const orig = typeof window.updateCartCount === 'function' ? window.updateCartCount : null;
  
      window.updateCartCount = function (count) {
        el.textContent = count;  // update text FIRST, then animate
        anime({ targets: el, scale: [1, 1.5, 1], rotate: [0, 360],
                duration: 600, easing: D.easEl });
        orig?.call(this, count);
      };
    }
  
    // ═══════════════════════════════════════════
    // PRODUCT IMAGES hover
    // ═══════════════════════════════════════════
    function _productImages() {
      const wrap = document.querySelector('.products-grid, .products-list, main') || document.body;
      _hoverDelegate(wrap, '.prod-img-wrap img',
        { scale: 1.08 },
        { scale: 1.00 }, D.mid
      );
    }
  
    // ═══════════════════════════════════════════
    // SEARCH INPUT focus
    // ═══════════════════════════════════════════
    function _searchInput() {
      const input = document.querySelector('.search-box-new input');
      if (!input) return;
      // FIX 6: boxShadow animation via anime works but is heavy.
      //         Use CSS custom property trick instead:
      input.addEventListener('focus', () => anime({ targets: input, scale: 1.02, translateY: -2, duration: D.short, easing: 'easeOutQuad' }));
      input.addEventListener('blur',  () => anime({ targets: input, scale: 1,    translateY:  0, duration: D.short, easing: 'easeOutQuad' }));
    }
  
    // ═══════════════════════════════════════════
    // TESTIMONIALS scroll-triggered
    // ═══════════════════════════════════════════
    function _testimonials() {
      [...document.querySelectorAll('.testi-card')].forEach((card, i) => {
        card.style.opacity = '0';
        onVisible(card, el =>
          anime({ targets: el, opacity: [0, 1], translateY: [30, 0],
                  duration: D.long, delay: (i % 3) * 120, easing: D.ease })
        );
      });
    }
  
    // ═══════════════════════════════════════════
    // PROMO BOXES
    // ═══════════════════════════════════════════
    function _promoBoxes() {
      const boxes = [...document.querySelectorAll('.promo-box')];
      if (!boxes.length) return;
  
      boxes.forEach((box, i) => {
        box.style.opacity = '0';
        onVisible(box, el =>
          // FIX 8: rotateY without perspective looks wrong — removed
          anime({ targets: el, opacity: [0, 1], scale: [0.85, 1],
                  duration: D.long, delay: i * 150, easing: D.ease })
        );
      });
  
      const wrap = boxes[0].closest('section') || document.body;
      _hoverDelegate(wrap, '.promo-box',
        { translateY: -8, scale: 1.02 },
        { translateY:  0, scale:    1 }, 350
      );
    }
  
    // ═══════════════════════════════════════════
    // FEATURE ITEMS
    // ═══════════════════════════════════════════
    function _featureItems() {
      const items = [...document.querySelectorAll('.feat-item')];
      if (!items.length) return;
  
      items.forEach((item, i) => {
        item.style.opacity = '0';
        onVisible(item, el =>
          anime({ targets: el, opacity: [0, 1], translateX: [-20, 0],
                  duration: D.mid, delay: i * 80, easing: D.ease })
        );
      });
  
      const wrap = items[0].closest('section') || document.body;
      _hoverDelegate(wrap, '.feat-item',    { translateX:  8 }, { translateX: 0 });
      _hoverDelegate(wrap, '.feat-icon', { rotate: 5, scale: 1.1 }, { rotate: 0, scale: 1 });
    }
  
    // ═══════════════════════════════════════════
    // GENERIC SCROLL FADE — shared for content blocks
    // ═══════════════════════════════════════════
    function _scrollFade(selector, opts = {}) {
      const { fromY = 30, dur = D.mid, stagger = 80 } = opts;
      [...document.querySelectorAll(selector)].forEach((el, i) => {
        el.style.opacity = '0';
        onVisible(el, target =>
          anime({ targets: target, opacity: [0, 1], translateY: [fromY, 0],
                  duration: dur, delay: (i % 6) * stagger, easing: D.ease })
        );
      });
    }
  
    // ═══════════════════════════════════════════
    // PAGE-SPECIFIC
    // ═══════════════════════════════════════════
  
    function _pageCart() {
      _scrollFade('.cart-item', { fromY: 0, stagger: 60 });  // slide from left not Y
      [...document.querySelectorAll('.cart-item')].forEach((item, i) => {
        item.style.opacity   = '0';
        item.style.transform = 'translateX(-20px)';
        onVisible(item, el =>
          anime({ targets: el, opacity: [0, 1], translateX: [-20, 0],
                  duration: D.mid, delay: i * 70, easing: D.ease })
        );
      });
      _scrollFade('.step', { fromY: 0 });
    }
  
    function _pageProduct() {
      const img  = document.querySelector('.product-image-large');
      const info = document.querySelector('.product-detail-info');
      if (img)  anime({ targets: img,  opacity: [0, 1], scale: [0.92, 1], duration: D.long, easing: D.ease });
      if (info) anime({ targets: info, opacity: [0, 1], translateX: [30, 0], duration: D.long, delay: 200, easing: D.ease });
    }
  
    function _pageCheckout() {
      _scrollFade('.checkout-section, .form-section', { stagger: 120 });
    }
  
    function _pageAdmin() {
      // FIX 9: Do NOT animate #sidebar — base.html controls its transform for mobile toggle.
      //         Only animate content inside main.
      _scrollFade('.stat-card, .dashboard-card', { stagger: 80 });
      _scrollFade('table tbody tr', { fromY: 0, stagger: 40 });
      // Button hover via delegation
      const main = document.getElementById('mainContent') || document.querySelector('main');
      if (main) _hoverDelegate(main, '.btn-primary, .btn-danger, .btn-success',
        { scale: 1.04, translateY: -2 }, { scale: 1, translateY: 0 });
    }
  
    function _pageCustomer() {
      const containers = document.querySelectorAll('.login-container, .register-container, .account-container');
      if (containers.length) anime({ targets: containers, opacity: [0, 1], scale: [0.97, 1], duration: D.long, easing: D.ease });
      _scrollFade('.form-group input, .form-group select', { fromY: 15, stagger: 40 });
    }
  
    function _pageLanding() {
      const card = document.querySelector('.main-card');
      if (!card) return;
      anime({ targets: card, opacity: [0, 1], translateY: [50, 0], scale: [0.9, 1], duration: 1000, easing: D.ease });
      const logo = document.querySelector('.logo-icon');
      if (logo) anime({ targets: logo, scale: [0, 1], rotate: [0, 360], duration: D.long, delay: 200, easing: D.easEl });
      _scrollFade('.feature-item', { stagger: 100 });
      const btn = document.querySelector('.btn-enter');
      if (btn) anime({ targets: btn, opacity: [0, 1], scale: [0.8, 1], duration: D.mid, delay: 800, easing: D.easEl });
    }
  
    function _pageMaintenance() {
      const c = document.querySelector('.maintenance-container');
      if (c) anime({ targets: c, opacity: [0, 1], translateY: [50, 0], scale: [0.9, 1], duration: D.long, easing: D.ease });
      const ic = document.querySelector('.maintenance-icon');
      if (ic) anime({ targets: ic, scale: [0, 1], rotate: [0, 360], duration: 1000, delay: 200, easing: D.easEl });
  
      [...document.querySelectorAll('.shape')].forEach((shape, i) => {
        // FIX — loop: true with random values re-picks on each loop correctly
        anime({
          targets: shape,
          translateX: () => anime.random(-60, 60),
          translateY: () => anime.random(-60, 60),
          rotate:     () => anime.random(0, 360),
          duration:   () => anime.random(12000, 20000),
          delay:      i * 1500,
          easing:     'linear',
          loop:       true,
          direction:  'alternate'
        });
      });
    }
  
    // ═══════════════════════════════════════════
    // PUBLIC UTILITY
    // ═══════════════════════════════════════════
  
    /**
     * animateCSS(selector, cssProps, options)
     * @example animateCSS('.hero h1', { opacity:[0,1], translateY:[-40,0] }, { delay: 200 })
     */
    function animateCSS(selector, props = {}, opts = {}) {
      return anime({ targets: selector, duration: D.long, easing: D.ease, ...opts, ...props });
    }
  
    // ═══════════════════════════════════════════
    // INIT — FIX 1: single DOMContentLoaded
    // ═══════════════════════════════════════════
  
    function _init() {
      // Common — run on every page
      _hero();
      _productCards();
      _categoryItems();
      _buttons();
      _cartCount();
      _productImages();
      _searchInput();
      _testimonials();
      _promoBoxes();
      _featureItems();
      _scrollFade('.content-block, .info-card, .faq-item');
      _scrollFade('section h2, .section-head h2', { fromY: -25, stagger: 100 });
  
      // Page-specific
      const p = window.location.pathname;
      if (p.includes('/cart'))                                       _pageCart();
      if (p.includes('/product'))                                    _pageProduct();
      if (p.includes('/checkout'))                                   _pageCheckout();
      if (p.includes('/admin'))                                      _pageAdmin();
      if (/\/(login|register|account|customer)/.test(p))            _pageCustomer();
      if (p === '/' && document.querySelector('.main-card'))         _pageLanding();
      if (p.includes('/maintenance'))                                _pageMaintenance();
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _init, { once: true });
    } else {
      _init();
    }
  
    // ── Exports ───────────────────────────────
    window.animateCSS          = animateCSS;
    window.initAnimeAnimations = _init;
  
  })();