// post-store.js - Complete, client preferences only

(function() {
    'use strict';

    const SETTINGS_KEY = 'peoplesPress_settings';
    const LIKES_KEY = 'peoplesPress_likes';

    // ============================================================
    // SETTINGS FUNCTIONS (Client preferences only)
    // ============================================================

    function getSettings() {
        try {
            const data = localStorage.getItem(SETTINGS_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Error reading settings:', e);
        }
        return {};
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error('Error saving settings:', e);
        }
    }

    function getLanguage() {
        const settings = getSettings();
        return settings.language || 'en';
    }

    function setLanguage(lang) {
        const settings = getSettings();
        settings.language = lang;
        saveSettings(settings);
    }

    // ============================================================
    // LIKE FUNCTIONS (Client-side like tracking)
    // ============================================================

    function getLikes() {
        try {
            return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}');
        } catch { return {}; }
    }

    function setLikes(likes) {
        localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
    }

    function isLiked(postId) {
        const likes = getLikes();
        return !!likes['like_' + postId];
    }

    function toggleLike(postId) {
        const likes = getLikes();
        const key = 'like_' + postId;
        const currentlyLiked = !!likes[key];
        
        if (currentlyLiked) {
            delete likes[key];
        } else {
            likes[key] = true;
        }
        setLikes(likes);
        return !currentlyLiked;
    }

    // ============================================================
    // EXPORT API
    // ============================================================

    window.PostStore = {
        // Client preferences only
        getSettings: getSettings,
        saveSettings: saveSettings,
        getLanguage: getLanguage,
        setLanguage: setLanguage,
        
        // Like tracking
        isLiked: isLiked,
        toggleLike: toggleLike,
        
        // NO data storage - all data comes from backend
        // These are kept for compatibility but log warnings
        getPosts: function() {
            console.warn('⚠️ PostStore.getPosts() is deprecated. Use API endpoints.');
            return [];
        },
        getPostById: function(id) {
            console.warn('⚠️ PostStore.getPostById() is deprecated. Use API endpoints.');
            return null;
        },
        createPost: function(data) {
            console.warn('⚠️ PostStore.createPost() is deprecated. Use API endpoints.');
            return null;
        },
        updatePost: function(id, updates) {
            console.warn('⚠️ PostStore.updatePost() is deprecated. Use API endpoints.');
            return null;
        },
        deletePost: function(id) {
            console.warn('⚠️ PostStore.deletePost() is deprecated. Use API endpoints.');
            return null;
        },
        getPendingCount: function() {
            console.warn('⚠️ PostStore.getPendingCount() is deprecated. Use API endpoints.');
            return 0;
        },
        runVerification: function(id) {
            console.warn('⚠️ PostStore.runVerification() is deprecated. Use API endpoints.');
            return null;
        }
    };

    console.log('📦 PostStore loaded (client preferences only)');
    console.log('✅ All hardcoded sample data removed');
})();