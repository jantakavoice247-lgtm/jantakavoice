// js/i18n.js - Complete Internationalization System with category support

(function() {
    'use strict';

    const DEFAULT_LANGUAGE = 'en';
    const STORAGE_KEY = 'peoplesPressLanguage';
    let currentLanguage = DEFAULT_LANGUAGE;
    let translations = {};
    let isLoaded = false;
    let callbacks = [];

    // ============================================================
    // SUPPORTED LANGUAGES
    // ============================================================
    const SUPPORTED_LANGUAGES = {
        'en': { name: 'English', native: 'English' },
        'hi': { name: 'Hindi', native: 'हिन्दी' },
        'bn': { name: 'Bengali', native: 'বাংলা' },
        'as': { name: 'Assamese', native: 'অসমীয়া' }
    };

    // Category translations (predefined, not AI-generated)
    const CATEGORY_TRANSLATIONS = {
        'politics': { en: 'Politics', hi: 'राजनीति', as: 'ৰাজনীতি', bn: 'রাজনীতি' },
        'education': { en: 'Education', hi: 'शिक्षा', as: 'শিক্ষা', bn: 'শিক্ষা' },
        'environment': { en: 'Environment', hi: 'पर्यावरण', as: 'পৰিৱেশ', bn: 'পরিবেশ' },
        'infrastructure': { en: 'Infrastructure', hi: 'बुनियादी ढांचा', as: 'অবকাঠামো', bn: 'অবকাঠামো' },
        'health': { en: 'Health', hi: 'स्वास्थ्य', as: 'স্বাস্থ্য', bn: 'স্বাস্থ্য' },
        'crime': { en: 'Crime', hi: 'अपराध', as: 'অপৰাধ', bn: 'অপরাধ' },
        'others': { en: 'Others', hi: 'अन्य', as: 'অন্যান্য', bn: 'অন্যান্য' }
    };

    // ============================================================
    // GET LANGUAGE FROM STORAGE
    // ============================================================
    function getStoredLanguage() {
        try {
            return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE;
        } catch (e) {
            return DEFAULT_LANGUAGE;
        }
    }

    // ============================================================
    // SAVE LANGUAGE TO STORAGE
    // ============================================================
    function saveLanguage(lang) {
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (e) {
            // Ignore
        }
    }

    // ============================================================
    // LOAD TRANSLATIONS
    // ============================================================
    async function loadTranslations(lang) {
        try {
            // Try to fetch from locales directory
            const response = await fetch(`/locales/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${lang}`);
            }
            const data = await response.json();
            translations = data;
            currentLanguage = lang;
            isLoaded = true;
            
            // Save preference
            saveLanguage(lang);
            
            return true;
        } catch (error) {
            console.error('Error loading translations:', error);
            
            // Fallback to English
            if (lang !== 'en') {
                return await loadTranslations('en');
            }
            
            // Minimal fallback
            translations = {
                nav: { home: 'Home', dashboard: 'Dashboard' },
                messages: { loading: 'Loading...', error: 'Error' }
            };
            currentLanguage = 'en';
            isLoaded = true;
            return true;
        }
    }

    // ============================================================
    // GET TRANSLATION
    // ============================================================
    function t(key, params = {}) {
        if (!isLoaded) {
            return key;
        }
        
        // Split key by dots
        const parts = key.split('.');
        let value = translations;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return key; // Key not found
            }
        }
        
        if (typeof value !== 'string') {
            return key;
        }
        
        // Replace parameters
        let result = value;
        for (const [param, replacement] of Object.entries(params)) {
            result = result.replace(`{{${param}}}`, replacement);
        }
        
        return result;
    }

    // ============================================================
    // GET CATEGORY TRANSLATION
    // ============================================================
    function translateCategory(categoryKey, language) {
        const lang = language || currentLanguage;
        const category = CATEGORY_TRANSLATIONS[categoryKey?.toLowerCase()];
        if (category) {
            return category[lang] || category.en || categoryKey;
        }
        return categoryKey || 'Others';
    }

    // ============================================================
    // LOCALIZE POST
    // ============================================================
    function localizePost(post, language) {
        if (!post) return null;
        
        const lang = language || currentLanguage;
        
        // If post already has translations field
        if (post.translations && typeof post.translations === 'object') {
            return {
                ...post,
                title: post.translations.title?.[lang] || 
                       post.translations.title?.en || 
                       post.title || '',
                description: post.translations.description?.[lang] || 
                             post.translations.description?.en || 
                             post.description || '',
                categoryLabel: translateCategory(post.category, lang),
                _originalLanguage: post.originalLanguage || 'en',
            };
        }
        
        // Fallback: return original
        return {
            ...post,
            categoryLabel: translateCategory(post.category, lang)
        };
    }

    // ============================================================
    // GET CURRENT LANGUAGE
    // ============================================================
    function getLanguage() {
        return currentLanguage;
    }

    function getSupportedLanguages() {
        return SUPPORTED_LANGUAGES;
    }

    function getLanguageName(lang) {
        return SUPPORTED_LANGUAGES[lang]?.native || lang;
    }

    // ============================================================
    // SET LANGUAGE - RELOADS PAGE FOR FULL PERSISTENCE
    // ============================================================
    async function setLanguage(lang, reload = true) {
        if (!SUPPORTED_LANGUAGES[lang]) {
            lang = DEFAULT_LANGUAGE;
        }
        
        if (lang === currentLanguage && isLoaded) {
            updateAllUI();
            updateLanguageSwitcherDisplay();
            return true;
        }
        
        // Save language preference
        saveLanguage(lang);
        
        // Load translations
        const success = await loadTranslations(lang);
        
        if (success) {
            // Update all UI elements
            updateAllUI();
            
            // Trigger language change event
            const event = new CustomEvent('languageChanged', { 
                detail: { language: lang } 
            });
            document.dispatchEvent(event);
            
            // Call registered callbacks
            callbacks.forEach(cb => cb(lang));
            
            // Update language display in switcher
            updateLanguageSwitcherDisplay();
            
            // Reload page to ensure all pages reflect the change
            if (reload) {
                setTimeout(() => {
                    window.location.reload();
                }, 200);
            }
        }
        return success;
    }

    // ============================================================
    // UPDATE UI
    // ============================================================
    function updateAllUI() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = t(key);
            if (translated !== key) {
                el.textContent = translated;
            }
        });
        
        // Update placeholder texts
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translated = t(key);
            if (translated !== key) {
                el.placeholder = translated;
            }
        });
        
        // Update title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translated = t(key);
            if (translated !== key) {
                el.title = translated;
            }
        });
        
        // Update aria-label
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            const translated = t(key);
            if (translated !== key) {
                el.setAttribute('aria-label', translated);
            }
        });
        
        // Update document title
        const titleEl = document.querySelector('[data-i18n-title-doc]');
        if (titleEl) {
            const key = titleEl.getAttribute('data-i18n-title-doc');
            const translated = t(key);
            if (translated !== key) {
                document.title = translated;
            }
        }
        
        // Update category labels in posts
        document.querySelectorAll('[data-i18n-category]').forEach(el => {
            const categoryKey = el.getAttribute('data-i18n-category');
            const translated = translateCategory(categoryKey);
            if (translated) {
                el.textContent = translated;
            }
        });
        
        // Update language switcher display
        updateLanguageSwitcherDisplay();
    }

    // ============================================================
    // LANGUAGE SWITCHER UI
    // ============================================================
    function updateLanguageSwitcherDisplay() {
        const displayEl = document.querySelector('[data-lang-display]');
        if (displayEl) {
            const lang = currentLanguage;
            displayEl.textContent = getLanguageName(lang);
        }
        
        // Update active state in dropdown
        document.querySelectorAll('.lang-option').forEach(opt => {
            const lang = opt.dataset.lang;
            if (lang === currentLanguage) {
                opt.style.background = '#eff6ff';
                opt.style.fontWeight = '600';
            } else {
                opt.style.background = '';
                opt.style.fontWeight = '';
            }
        });
    }

    // ============================================================
    // REGISTER CALLBACKS
    // ============================================================
    function onLanguageChange(callback) {
        if (typeof callback === 'function') {
            callbacks.push(callback);
        }
    }

    // ============================================================
    // CREATE LANGUAGE SWITCHER HTML
    // ============================================================
    function createLanguageSwitcherHTML() {
        const currentLang = currentLanguage;
        return `
            <div class="language-switcher">
                <button class="lang-btn" id="langToggleBtn">
                    <i class="fas fa-globe-americas"></i>
                    <span data-lang-display>${getLanguageName(currentLang)}</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="lang-dropdown" id="langDropdown">
                    ${Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => `
                        <button class="lang-option" data-lang="${code}" ${code === currentLang ? 'style="background:#eff6ff;font-weight:600;"' : ''}>
                            ${info.native} <span style="font-size:0.7rem;color:#6b7280;">(${info.name})</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ============================================================
    // SETUP LANGUAGE SWITCHER EVENTS
    // ============================================================
    function setupLanguageSwitcherEvents() {
        const toggleBtn = document.getElementById('langToggleBtn');
        const dropdown = document.getElementById('langDropdown');
        
        if (!toggleBtn || !dropdown) return;
        
        // Toggle dropdown
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });
        
        // Close dropdown on outside click
        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
        
        // Language options
        document.querySelectorAll('.lang-option').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const lang = this.dataset.lang;
                
                if (lang && window.i18n) {
                    dropdown.classList.remove('open');
                    await window.i18n.setLanguage(lang, true);
                }
            });
        });
    }

    // ============================================================
    // SYNCHRONIZE ACROSS TABS
    // ============================================================
    function setupCrossTabSync() {
        window.addEventListener('storage', function(e) {
            if (e.key === STORAGE_KEY && e.newValue) {
                const newLang = e.newValue;
                if (newLang !== currentLanguage) {
                    console.log(`🔄 Language changed in another tab: ${newLang}`);
                    window.location.reload();
                }
            }
        });
    }

    // ============================================================
    // INIT
    // ============================================================
    async function initI18n() {
        // Get saved language preference
        const savedLang = getStoredLanguage();
        
        // Check if browser language is supported (only if no saved preference)
        let langToLoad = savedLang;
        if (!localStorage.getItem(STORAGE_KEY)) {
            const browserLang = navigator.language?.substring(0, 2) || 'en';
            if (SUPPORTED_LANGUAGES[browserLang]) {
                langToLoad = browserLang;
                saveLanguage(browserLang);
            }
        }
        
        await loadTranslations(langToLoad);
        updateAllUI();
        
        // Setup cross-tab synchronization
        setupCrossTabSync();
        
        console.log(`🌐 i18n initialized: ${currentLanguage}`);
        console.log(`💾 Language saved in localStorage: ${getStoredLanguage()}`);
    }

    // ============================================================
    // EXPOSE
    // ============================================================
    window.i18n = {
        t,
        getLanguage,
        setLanguage,
        loadTranslations,
        updateAllUI,
        initI18n,
        getSupportedLanguages,
        getLanguageName,
        setupLanguageSwitcherEvents,
        createLanguageSwitcherHTML,
        onLanguageChange,
        localizePost,
        translateCategory,
        SUPPORTED_LANGUAGES,
        CATEGORY_TRANSLATIONS,
        getStoredLanguage,
        saveLanguage,
        isLoaded: isLoaded
    };

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initI18n);
    } else {
        initI18n();
    }

    console.log('🌐 i18n utility loaded with cross-page persistence');
})();