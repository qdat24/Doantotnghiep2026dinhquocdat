// ============================================
// DQD Translation Engine — Optimized
// ============================================
(function () {
    'use strict';
  
    // ── Constants ───────────────────────────────
    const STORAGE_KEYS = { lang: 'dqd_lang', theme: 'dqd_theme' };
    const DEFAULT_LANG  = 'vi';
    const DEFAULT_THEME = 'light';
  
    // ── Safe localStorage ── FIX 1: try/catch (SSR / privacy mode safe)
    const store = {
      get(key, fallback) {
        try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
      },
      set(key, val) {
        try { localStorage.setItem(key, val); } catch { /* silent */ }
      }
    };
  
    // ============================================
    // TranslationEngine
    // ============================================
    class TranslationEngine {
      constructor() {
        this.lang     = store.get(STORAGE_KEYS.lang,  DEFAULT_LANG);
        this.theme    = store.get(STORAGE_KEYS.theme, DEFAULT_THEME);
        this._observer = null;
        this._map      = null;  // flattened lookup map built once
      }
  
      // ── FIX 2: Không dùng setInterval polling.
      //    Nhận translations qua Promise / callback.
      //    Caller truyền map vào, engine không tự fetch.
      mount(translationsObj) {
        if (!translationsObj) {
          console.warn('[DQD i18n] No translations object provided');
          return;
        }
  
        // FIX 3: Build O(1) lookup map một lần duy nhất
        this._map = this._buildMap(translationsObj, this.lang);
  
        this._applyTheme();
        this._renderButtons();
        this._bindEvents();
        this._translateDOM(document.body);
        this._watchDOM();
  
        document.documentElement.lang = this.lang;
        console.log(`[DQD i18n] ✅ Mounted — lang: ${this.lang}, theme: ${this.theme}, keys: ${Object.keys(this._map).length}`);
      }
  
      // FIX 3: Build normalized (lowercase, trimmed) map → O(1) translate
      _buildMap(translationsObj, lang) {
        const raw = translationsObj[lang];
        if (!raw) return {};
        const map = {};
        for (const [k, v] of Object.entries(raw)) {
          const norm = k.trim().toLowerCase();
          // Skip self-referencing entries (vi['Home']='Home')
          if (norm !== v.trim().toLowerCase()) {
            map[norm] = v;
          }
        }
        return map;
      }
  
      // ── THEME ────────────────────────────────
      _applyTheme() {
        document.body.classList.toggle('dark-mode', this.theme === 'dark');
      }
  
      toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        store.set(STORAGE_KEYS.theme, this.theme);
        this._applyTheme();
  
        const btn = document.getElementById('dqd-theme-btn');
        if (btn) btn.innerHTML = this._themeIcon();
      }
  
      _themeIcon() {
        // FIX 4: Dùng SVG inline thay vì FontAwesome
        return this.theme === 'dark'
          ? `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
          : `<svg viewBox="0 0 20 20" fill="none"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      }
  
      // ── LANGUAGE ─────────────────────────────
      // FIX 5: KHÔNG reload trang — dịch live bằng _translateDOM
      toggleLanguage() {
        this.lang = this.lang === 'vi' ? 'en' : 'vi';
        store.set(STORAGE_KEYS.lang, this.lang);
        document.documentElement.lang = this.lang;
  
        // Rebuild map cho ngôn ngữ mới
        if (window.DICT) {
          this._map = this._buildMap(window.translations, this.lang);
        }
  
        // Restore original text rồi translate lại
        this._restoreOriginals(document.body);
        this._translateDOM(document.body);
        this._updateLangBtn();
  
        console.log(`[DQD i18n] Language → ${this.lang}`);
      }
  
      _updateLangBtn() {
        const btn = document.getElementById('dqd-lang-btn');
        if (!btn) return;
        const flag = this.lang === 'vi' ? '🇻🇳' : '🇬🇧';
        const code = this.lang.toUpperCase();
        btn.innerHTML = `<span>${flag}</span><span>${code}</span>`;
      }
  
      // ── BUTTONS ──────────────────────────────
      _renderButtons() {
        if (document.getElementById('dqd-theme-btn')) return;
  
        const wrap = document.createElement('div');
        wrap.id = 'dqd-controls';
        wrap.setAttribute('aria-label', 'Theme and language controls');
        wrap.style.cssText = 'position:fixed;bottom:1.25rem;right:1.25rem;display:flex;flex-direction:column;gap:.5rem;z-index:9999';
  
        const themeBtn = this._makeBtn('dqd-theme-btn', this._themeIcon(), 'Chuyển giao diện');
        const langBtn  = this._makeBtn('dqd-lang-btn',  '', 'Chuyển ngôn ngữ');
  
        wrap.append(themeBtn, langBtn);
        document.body.appendChild(wrap);
        this._updateLangBtn();
      }
  
      _makeBtn(id, html, label) {
        const btn = document.createElement('button');
        btn.id    = id;
        btn.type  = 'button';
        btn.setAttribute('aria-label', label);
        btn.style.cssText = 'width:40px;height:40px;border-radius:50%;border:1.5px solid #e8e3db;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.12);transition:box-shadow .15s';
        btn.innerHTML = html;
        return btn;
      }
  
      // ── TRANSLATE DOM ─────────────────────────
  
      // FIX 6: Lưu text gốc vào data attribute để có thể restore khi đổi ngôn ngữ
      _translateDOM(root) {
        if (!root || !this._map) return;
        this._walkTextNodes(root, (node) => {
          const raw = node.textContent;
          const trimmed = raw.trim();
          if (!trimmed || trimmed.length < 2) return;
  
          // FIX 7: Bỏ word-by-word partial match — gây ra output rác.
          //         Chỉ exact match (normalized). Không phá text không dịch được.
          const key = trimmed.toLowerCase();
          const translated = this._map[key];
          if (!translated) return;
  
          // Preserve surrounding whitespace
          const leading  = raw.match(/^\s*/)[0];
          const trailing = raw.match(/\s*$/)[0];
  
          // Lưu original lần đầu
          if (!node._dqdOriginal) node._dqdOriginal = raw;
          node.textContent = leading + translated + trailing;
        });
  
        // data-translate attribute (luôn ưu tiên)
        root.querySelectorAll('[data-translate]').forEach(el => {
          const key = el.getAttribute('data-translate').toLowerCase();
          if (!el._dqdOriginal) el._dqdOriginal = el.textContent;
          if (this._map[key]) el.textContent = this._map[key];
        });
  
        // placeholder / title
        root.querySelectorAll('[placeholder]').forEach(el => {
          const k = (el._dqdPlaceholderOriginal || el.getAttribute('placeholder')).trim().toLowerCase();
          if (!el._dqdPlaceholderOriginal) el._dqdPlaceholderOriginal = el.getAttribute('placeholder');
          const v = this._map[k];
          if (v) el.setAttribute('placeholder', v);
        });
  
        root.querySelectorAll('[title]').forEach(el => {
          const k = (el._dqdTitleOriginal || el.getAttribute('title')).trim().toLowerCase();
          if (!el._dqdTitleOriginal) el._dqdTitleOriginal = el.getAttribute('title');
          const v = this._map[k];
          if (v) el.setAttribute('title', v);
        });
      }
  
      _restoreOriginals(root) {
        this._walkTextNodes(root, (node) => {
          if (node._dqdOriginal) {
            node.textContent = node._dqdOriginal;
            node._dqdOriginal = null;
          }
        });
        root.querySelectorAll('[data-translate]').forEach(el => {
          if (el._dqdOriginal) { el.textContent = el._dqdOriginal; el._dqdOriginal = null; }
        });
        root.querySelectorAll('[placeholder]').forEach(el => {
          if (el._dqdPlaceholderOriginal) el.setAttribute('placeholder', el._dqdPlaceholderOriginal);
        });
        root.querySelectorAll('[title]').forEach(el => {
          if (el._dqdTitleOriginal) el.setAttribute('title', el._dqdTitleOriginal);
        });
      }
  
      _walkTextNodes(root, cb) {
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              const tag = parent.tagName.toLowerCase();
              if (['script','style','noscript','code','pre','textarea'].includes(tag)) return NodeFilter.FILTER_REJECT;
              if (parent.classList.contains('no-translate'))          return NodeFilter.FILTER_REJECT;
              if (parent.getAttribute('translate') === 'no')          return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) nodes.push(node); // collect first to avoid live mutation issues
        nodes.forEach(cb);
      }
  
      // ── DOM WATCHER ──────────────────────────
      // FIX 8: Debounce MutationObserver + disconnect khi destroy
      _watchDOM() {
        if (this._observer) this._observer.disconnect();
  
        let timer = null;
        const pending = new Set();
  
        this._observer = new MutationObserver((mutations) => {
          mutations.forEach(({ addedNodes }) => {
            addedNodes.forEach(n => {
              if (n.nodeType === Node.ELEMENT_NODE) pending.add(n);
            });
          });
  
          // FIX 8: Debounce 80ms — tránh chạy hàng trăm lần/giây
          clearTimeout(timer);
          timer = setTimeout(() => {
            pending.forEach(n => this._translateDOM(n));
            pending.clear();
          }, 80);
        });
  
        this._observer.observe(document.body, { childList: true, subtree: true });
      }
  
      destroy() {
        if (this._observer) { this._observer.disconnect(); this._observer = null; }
        document.getElementById('dqd-controls')?.remove();
      }
  
      // ── EVENTS ───────────────────────────────
      _bindEvents() {
        // FIX 9: Một listener duy nhất trên document (event delegation)
        document.addEventListener('click', (e) => {
          if (e.target.closest('#dqd-theme-btn')) this.toggleTheme();
          if (e.target.closest('#dqd-lang-btn'))  this.toggleLanguage();
        });
  
        // Keyboard shortcuts (Ctrl/Cmd+D = dark, Ctrl/Cmd+L = language)
        document.addEventListener('keydown', (e) => {
          const mod = e.ctrlKey || e.metaKey;
          if (mod && e.key === 'd') { e.preventDefault(); this.toggleTheme(); }
          if (mod && e.key === 'l') { e.preventDefault(); this.toggleLanguage(); }
        });
      }
    }
  
    // ============================================
    // Bootstrap
    // ============================================
    function boot() {
      const engine = new TranslationEngine();
      window.dqdI18n = engine;
  
      // Nếu translations đã load sẵn → mount ngay
      if (window.translations) {
        engine.mount(window.translations);
        return;
      }
  
      // FIX 2: Dùng CustomEvent thay vì setInterval polling
      // Trong translations.js, sau khi gán window.translations, dispatch:
      //   window.dispatchEvent(new CustomEvent('dqd:translations:ready', { detail: window.translations }))
      window.addEventListener('dqd:translations:ready', (e) => {
        engine.mount(e.detail);
      }, { once: true });
  
      // Fallback: nếu script cũ không dispatch event, poll ngắn (max 3s)
      let waited = 0;
      const poll = setInterval(() => {
        waited += 100;
        if (window.translations) {
          clearInterval(poll);
          engine.mount(window.translations);
        } else if (waited >= 3000) {
          clearInterval(poll);
          console.warn('[DQD i18n] translations.js not loaded after 3s');
        }
      }, 100);
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  
  })();