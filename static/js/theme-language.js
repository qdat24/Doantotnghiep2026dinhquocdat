// ============================================
// FINAL AGGRESSIVE TRANSLATION ENGINE
// Forces ALL text to be translated
// ============================================

(function() {
    'use strict';
    
    console.log('🚀 Final Translation Engine Loading...');

    class FinalTranslationManager {
        constructor() {
            this.currentTheme = localStorage.getItem('theme') || 'light';
            this.currentLanguage = localStorage.getItem('language') || 'vi';
            this.init();
        }
        
        init() {
            this.applyTheme();
            this.createButtons();
            
            // Wait for translations to load
            const checkTranslations = setInterval(() => {
                if (window.translations) {
                    clearInterval(checkTranslations);
                    this.aggressiveTranslate();
                }
            }, 100);
            
            this.addEventListeners();
        }
        
        createButtons() {
            if (document.getElementById('themeToggle')) return;
            
            // Theme button
            const themeBtn = document.createElement('button');
            themeBtn.id = 'themeToggle';
            themeBtn.className = 'theme-toggle-btn';
            themeBtn.innerHTML = this.currentTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            document.body.appendChild(themeBtn);
            
            // Language button
            const langBtn = document.createElement('button');
            langBtn.id = 'languageToggle';
            langBtn.className = 'language-toggle-btn';
            const flag = this.currentLanguage === 'vi' ? '🇻🇳' : '🇬🇧';
            const text = this.currentLanguage === 'vi' ? 'VI' : 'EN';
            langBtn.innerHTML = `<span>${flag}</span><span>${text}</span>`;
            document.body.appendChild(langBtn);
        }
        
        applyTheme() {
            if (this.currentTheme === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        }
        
        toggleTheme() {
            this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', this.currentTheme);
            this.applyTheme();
            
            const btn = document.getElementById('themeToggle');
            if (btn) {
                btn.innerHTML = this.currentTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            }
        }
        
        toggleLanguage() {
            this.currentLanguage = this.currentLanguage === 'vi' ? 'en' : 'vi';
            localStorage.setItem('language', this.currentLanguage);
            window.location.reload(); // Reload để dịch lại toàn bộ
        }
        
        // ===== AGGRESSIVE TRANSLATE - TRANSLATE EVERYTHING =====
        aggressiveTranslate() {
            if (!window.translations) return;
            
            const lang = window.translations[this.currentLanguage];
            if (!lang) return;
            
            console.log('🌍 Starting AGGRESSIVE translation to:', this.currentLanguage);
            
            let count = 0;
            
            // 1. Translate ALL text nodes
            this.translateTextNodes(document.body, lang, (translated) => {
                if (translated) count++;
            });
            
            // 2. Translate placeholders
            document.querySelectorAll('[placeholder]').forEach(el => {
                const placeholder = el.getAttribute('placeholder');
                if (lang[placeholder]) {
                    el.setAttribute('placeholder', lang[placeholder]);
                    count++;
                }
            });
            
            // 3. Translate titles
            document.querySelectorAll('[title]').forEach(el => {
                const title = el.getAttribute('title');
                if (lang[title]) {
                    el.setAttribute('title', lang[title]);
                    count++;
                }
            });
            
            // 4. Translate data-translate attributes
            document.querySelectorAll('[data-translate]').forEach(el => {
                const key = el.getAttribute('data-translate');
                if (lang[key]) {
                    el.textContent = lang[key];
                    count++;
                }
            });
            
            // 5. Set lang attribute
            document.documentElement.lang = this.currentLanguage;
            
            console.log(`✅ Translated ${count} elements`);
            
            // 6. Re-translate after DOM changes
            this.observeDOMChanges(lang);
        }
        
        translateTextNodes(node, lang, callback) {
            if (!node) return;
            
            // Skip certain elements
            if (this.shouldSkip(node)) return;
            
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                
                // Skip empty, numbers only, or very short
                if (!text || text.length < 2 || /^[\d\s\.,\-\+\*\/\(\)]*$/.test(text)) return;
                
                // Try exact match first
                if (lang[text]) {
                    node.textContent = lang[text];
                    callback(true);
                    return;
                }
                
                // Try case-insensitive match
                const textLower = text.toLowerCase();
                for (const [key, value] of Object.entries(lang)) {
                    if (key.toLowerCase() === textLower) {
                        node.textContent = value;
                        callback(true);
                        return;
                    }
                }
                
                // Try partial match (translate words)
                const words = text.split(/\s+/);
                let translated = false;
                const newWords = words.map(word => {
                    if (lang[word]) {
                        translated = true;
                        return lang[word];
                    }
                    // Case insensitive word match
                    for (const [key, value] of Object.entries(lang)) {
                        if (key.toLowerCase() === word.toLowerCase()) {
                            translated = true;
                            return value;
                        }
                    }
                    return word;
                });
                
                if (translated) {
                    node.textContent = newWords.join(' ');
                    callback(true);
                }
                
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                for (const child of node.childNodes) {
                    this.translateTextNodes(child, lang, callback);
                }
            }
        }
        
        shouldSkip(node) {
            if (!node) return true;
            
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'code', 'pre'].includes(tag)) return true;
                if (node.classList && node.classList.contains('no-translate')) return true;
                if (node.getAttribute('translate') === 'no') return true;
            }
            
            return false;
        }
        
        // Observe DOM changes and re-translate
        observeDOMChanges(lang) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.translateTextNodes(node, lang, () => {});
                        }
                    });
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
        
        addEventListeners() {
            document.addEventListener('click', (e) => {
                if (e.target.closest('#themeToggle')) {
                    this.toggleTheme();
                }
                if (e.target.closest('#languageToggle')) {
                    this.toggleLanguage();
                }
            });
            
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                    e.preventDefault();
                    this.toggleTheme();
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                    e.preventDefault();
                    this.toggleLanguage();
                }
            });
        }
    }
    
    // Initialize
    function init() {
        // Add animation CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // Create manager
        window.finalTranslationManager = new FinalTranslationManager();
        console.log('✅ Final Translation Manager initialized!');
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();