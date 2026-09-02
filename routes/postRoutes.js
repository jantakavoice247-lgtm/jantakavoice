const express = require('express');
const router = express.Router();
const {
  getPublicPosts,
  getPostById,
  createPost,
  getMyPosts,
  getPostsByStatus,
  deletePost,
  runVerification,
} = require('../controllers/postController');
const protect = require('../middleware/authMiddleware');

// Public routes
router.get('/', getPublicPosts);
router.get('/:id', getPostById);

// Protected routes
router.post('/', protect, createPost);
router.get('/my/posts', protect, getMyPosts);
router.delete('/:id', protect, deletePost);

// Status filter (protected - for admin)
router.get('/status/:status', protect, getPostsByStatus);

// Verification (protected - admin only)
router.post('/:id/verify', protect, runVerification);

module.exports = router;