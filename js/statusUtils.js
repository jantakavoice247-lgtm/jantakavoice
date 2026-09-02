// js/statusUtils.js - Complete

(function() {
    'use strict';

    const STATUS_MAP = {
        'pending': { label: 'Pending', class: 'status-pending', icon: 'clock' },
        'approved': { label: 'Approved', class: 'status-approved', icon: 'check-circle' },
        'declined': { label: 'Declined', class: 'status-declined', icon: 'x-circle' },
    };

    function getStatusLabel(status) {
        return STATUS_MAP[status]?.label || status || 'Unknown';
    }

    function getStatusClass(status) {
        return STATUS_MAP[status]?.class || 'status-unknown';
    }

    function getStatusIcon(status) {
        return STATUS_MAP[status]?.icon || 'help-circle';
    }

    // For backward compatibility with old status names
    function normalizeStatus(status) {
        const map = {
            'PENDING_VERIFICATION': 'pending',
            'PUBLISHED': 'approved',
            'REJECTED': 'declined',
        };
        return map[status] || status;
    }

    // Export for use in pages
    window.StatusUtils = {
        getStatusLabel,
        getStatusClass,
        getStatusIcon,
        normalizeStatus
    };

    console.log('📊 StatusUtils loaded');
})();