// api.js - Complete with language support

const API_BASE = window.API_BASE_URL || 'http://localhost:5000/api';

// Helper function to get current language
function getCurrentLanguage() {
    if (window.i18n) {
        return window.i18n.getLanguage();
    }
    try {
        return localStorage.getItem('peoplesPressLanguage') || 'en';
    } catch {
        return 'en';
    }
}

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const language = getCurrentLanguage();
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Accept-Language': language,
        },
    };

    // Get token from localStorage
    const token = localStorage.getItem('peoplePressToken');
    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    };

    // Add language to query string for GET requests
    if (options.method === 'GET' || !options.method) {
        const hasQuery = endpoint.includes('?');
        const separator = hasQuery ? '&' : '?';
        // Only add if not already present
        if (!endpoint.includes('lang=')) {
            const urlObj = new URL(url);
            urlObj.searchParams.set('lang', language);
            config.url = urlObj.toString();
        }
    }

    try {
        const response = await fetch(config.url || url, config);
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('peoplePressToken');
                localStorage.removeItem('peoplePressUser');
                if (!window.location.pathname.includes('login.html') && 
                    !window.location.pathname.includes('register.html')) {
                    window.location.href = 'login.html';
                }
                throw new Error(data.message || 'Session expired');
            }
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error.message);
        throw error;
    }
}

// ============================================================
// AUTH API
// ============================================================

const authAPI = {
    register: async (userData) => {
        const response = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
        if (response.success && response.token) {
            localStorage.setItem('peoplePressToken', response.token);
            localStorage.setItem('peoplePressUser', JSON.stringify(response.user));
        }
        return response;
    },

    login: async (email, password) => {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (response.success && response.token) {
            localStorage.setItem('peoplePressToken', response.token);
            localStorage.setItem('peoplePressUser', JSON.stringify(response.user));
        }
        return response;
    },

    adminLogin: async (email, password) => {
        const response = await apiRequest('/auth/admin-login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (response.success && response.token) {
            localStorage.setItem('peoplePressToken', response.token);
            localStorage.setItem('peoplePressUser', JSON.stringify(response.user));
        }
        return response;
    },

    logout: async () => {
        try {
            await apiRequest('/auth/logout', { method: 'POST' });
        } catch (e) {
            // Ignore errors on logout
        }
        localStorage.removeItem('peoplePressToken');
        localStorage.removeItem('peoplePressUser');
    },

    getMe: async () => {
        return await apiRequest('/auth/me');
    },

    isLoggedIn: () => {
        return !!localStorage.getItem('peoplePressToken');
    },

    getCurrentUser: () => {
        try {
            return JSON.parse(localStorage.getItem('peoplePressUser'));
        } catch {
            return null;
        }
    },
};

// ============================================================
// POSTS API
// ============================================================

const postAPI = {
    getPublicPosts: async (params = {}) => {
        const lang = getCurrentLanguage();
        const queryString = new URLSearchParams({ ...params, lang }).toString();
        return await apiRequest(`/posts?${queryString}`);
    },

    getPost: async (id) => {
        if (!id || id === 'undefined' || id === 'null' || id === '') {
            return { success: false, message: 'Invalid post ID' };
        }
        const lang = getCurrentLanguage();
        return await apiRequest(`/posts/${id}?lang=${lang}`);
    },

    createPost: async (postData) => {
        const lang = getCurrentLanguage();
        return await apiRequest('/posts', {
            method: 'POST',
            body: JSON.stringify({ ...postData, language: lang }),
        });
    },

    getMyPosts: async () => {
        const lang = getCurrentLanguage();
        return await apiRequest(`/posts/my/posts?lang=${lang}`);
    },

    deletePost: async (id) => {
        if (!id || id === 'undefined' || id === 'null' || id === '') {
            return { success: false, message: 'Invalid post ID' };
        }
        return await apiRequest(`/posts/${id}`, {
            method: 'DELETE',
        });
    },

    runVerification: async (id) => {
        if (!id || id === 'undefined' || id === 'null' || id === '') {
            return { success: false, message: 'Invalid post ID' };
        }
        return await apiRequest(`/posts/${id}/verify`, {
            method: 'POST',
        });
    },

    getPostsByStatus: async (status) => {
        const lang = getCurrentLanguage();
        return await apiRequest(`/posts/status/${status}?lang=${lang}`);
    },

    updatePost: async (id, data) => {
        const lang = getCurrentLanguage();
        return await apiRequest(`/posts/${id}?lang=${lang}`, {
            method: 'PUT',
            body: JSON.stringify({ ...data, language: lang }),
        });
    },

    regenerateTranslations: async (id) => {
        return await apiRequest(`/posts/${id}/regenerate-translations`, {
            method: 'POST',
        });
    },
};

// ============================================================
// ADMIN API
// ============================================================

const adminAPI = {
    getStats: async () => {
        return await apiRequest('/admin/stats');
    },

    getAllPosts: async (params = {}) => {
        const lang = getCurrentLanguage();
        const queryString = new URLSearchParams({ ...params, lang }).toString();
        return await apiRequest(`/admin/posts?${queryString}`);
    },

    approvePost: async (id) => {
        return await apiRequest(`/admin/posts/${id}/approve`, {
            method: 'PATCH',
        });
    },

    rejectPost: async (id, reason = '') => {
        return await apiRequest(`/admin/posts/${id}/reject`, {
            method: 'PATCH',
            body: JSON.stringify({ reason }),
        });
    },

    getUsers: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return await apiRequest(`/admin/users?${queryString}`);
    },

    updateUserStatus: async (userId, isActive) => {
        return await apiRequest(`/admin/users/${userId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive }),
        });
    },

    getReports: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return await apiRequest(`/admin/reports?${queryString}`);
    },

    updateReportStatus: async (reportId, status) => {
        return await apiRequest(`/admin/reports/${reportId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    },
};

// ============================================================
// REPORTS API
// ============================================================

const reportAPI = {
    createReport: async (reportData) => {
        return await apiRequest('/reports', {
            method: 'POST',
            body: JSON.stringify(reportData),
        });
    },

    getMyReports: async () => {
        const lang = getCurrentLanguage();
        return await apiRequest(`/reports/my?lang=${lang}`);
    },
};

// ============================================================
// CATEGORIES API
// ============================================================

const categoryAPI = {
    getCategories: async () => {
        const lang = getCurrentLanguage();
        return await apiRequest(`/categories?lang=${lang}`);
    },

    createCategory: async (name) => {
        return await apiRequest('/categories', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
    },

    updateCategory: async (id, name) => {
        return await apiRequest(`/categories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
        });
    },

    deleteCategory: async (id) => {
        return await apiRequest(`/categories/${id}`, {
            method: 'DELETE',
        });
    },
};

// ============================================================
// EXPOSE TO GLOBAL SCOPE
// ============================================================

window.PeoplesPressAPI = {
    auth: authAPI,
    posts: postAPI,
    admin: adminAPI,
    reports: reportAPI,
    categories: categoryAPI,
    apiRequest: apiRequest,
    getCurrentLanguage: getCurrentLanguage,
};

console.log('📡 API Client loaded - Backend URL:', API_BASE);
console.log('🌐 Language support enabled');