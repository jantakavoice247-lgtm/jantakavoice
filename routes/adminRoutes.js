// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllPosts,
  approvePost,
  rejectPost,
  getStats,
  getAllUsers,
  updateUserStatus,
  getAllReports,
  updateReportStatus,
  retryInstagram,
  getInstagramStatus,
} = require('../controllers/adminController');
const protect = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');

// All routes require authentication and admin role
router.use(protect);
router.use(admin);

// Stats
router.get('/stats', getStats);

// Posts
router.get('/posts', getAllPosts);
router.patch('/posts/:id/approve', approvePost);
router.patch('/posts/:id/reject', rejectPost);

// Users
router.get('/users', getAllUsers);
router.patch('/users/:id/status', updateUserStatus);

// Reports
router.get('/reports', getAllReports);
router.patch('/reports/:id/status', updateReportStatus);

// ============================================================
// INSTAGRAM ROUTES (Admin only)
// ============================================================
router.post('/posts/:id/instagram/retry', retryInstagram);
router.get('/posts/:id/instagram/status', getInstagramStatus);

module.exports = router;