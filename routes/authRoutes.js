const express = require('express');
const router = express.Router();
const {
  register,
  login,
  adminLogin,
  getMe,
  logout,
} = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/admin-login', adminLogin);
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;