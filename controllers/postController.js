// controllers/postController.js - Complete with admin access fix

const Post = require('../models/Post');
const User = require('../models/User');
const { predictNews, completeVerification } = require('../services/aiService');
const mongoose = require('mongoose');

// Helper function to validate ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Helper function to safely get ID
function getSafeId(id) {
  if (!id || id === 'undefined' || id === 'null' || id === '') {
    return null;
  }
  return id;
}

// ============================================================
// GET PUBLIC POSTS (Home page)
// ============================================================
const getPublicPosts = async (req, res) => {
  try {
    const { category, limit = 20, page = 1 } = req.query;

    const query = { status: 'approved' };

    if (category && category !== 'all') {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-submittedBy -__v -verificationReasons -updatedAt -aiPrediction -aiConfidence -riskScore -verificationStatus -aiVerification');

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      posts: posts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get public posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts.',
    });
  }
};

// ============================================================
// GET SINGLE POST - FIXED: Admin can view any post
// ============================================================
const getPostById = async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = getSafeId(rawId);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID provided.',
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format. Must be a valid MongoDB ObjectId.',
      });
    }

    const post = await Post.findById(id).select('-__v');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    // Check if user can view this post
    const isAuthor = req.user && req.user.anonymousId === post.anonymousId;
    const isAdmin = req.user && req.user.role === 'admin';
    const isPublic = post.status === 'approved';

    // CRITICAL FIX: Admin should ALWAYS be able to view ANY post
    if (isAdmin) {
      return res.json({
        success: true,
        post: post,
      });
    }

    // For non-admin users, check if they are the author or it's public
    if (!isPublic && !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'This post is not publicly available.',
      });
    }

    res.json({
      success: true,
      post: post,
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch post.',
    });
  }
};

// ============================================================
// CREATE POST - With AI integration
// ============================================================
const createPost = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      location,
      latitude,
      longitude,
      source,
      evidence,
    } = req.body;

    if (!title || !description || !category || !location) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, category, and location are required.',
      });
    }

    const user = req.user;

    // ============================================================
    // AI PREDICTION - Basic
    // ============================================================
    let aiPrediction = null;
    let aiConfidence = null;
    let aiStatus = 'pending';
    let aiError = null;

    try {
      if (title.trim() && description.trim()) {
        console.log('🤖 Calling AI service for new post...');
        const aiResult = await predictNews(title, description);
        
        if (aiResult.success) {
          aiPrediction = aiResult.prediction;
          aiConfidence = aiResult.confidence;
          aiStatus = 'completed';
          
          console.log(`✅ AI Prediction: ${aiPrediction} (${(aiConfidence * 100).toFixed(1)}%)`);
        } else {
          aiStatus = 'error';
          aiError = aiResult.error;
          console.warn(`⚠️ AI Prediction failed: ${aiError}`);
        }
      }
    } catch (error) {
      aiStatus = 'error';
      aiError = error.message;
      console.error('❌ AI Prediction error:', error);
    }

    // ============================================================
    // CREATE POST
    // ============================================================
    const post = await Post.create({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      location: location.trim(),
      latitude: latitude || null,
      longitude: longitude || null,
      source: source || '',
      evidence: evidence || [],
      submittedBy: user._id,
      anonymousId: user.anonymousId,
      status: 'pending',
      verificationStatus: 'NEEDS_REVIEW',
      riskScore: 54,
      verificationReasons: ['Pending automated verification'],
      aiPrediction: aiPrediction,
      aiConfidence: aiConfidence,
      aiStatus: aiStatus,
      aiError: aiError,
      aiVerification: null,
      translations: {},
      likes: 0,
      comments: 0,
      instagram: {
        status: 'not_published',
        instagramId: null,
        publishedAt: null,
        error: null,
        retryCount: 0
      }
    });

    await User.findByIdAndUpdate(user._id, { $inc: { postsCount: 1 } });

    let message = 'Post submitted successfully! It will be reviewed by moderators.';
    if (aiStatus === 'completed') {
      message += ' AI verification completed.';
    } else if (aiStatus === 'error') {
      message += ' AI verification is currently unavailable. Your post has been submitted for manual review.';
    }

    res.status(201).json({
      success: true,
      message: message,
      post: post,
      ai: {
        status: aiStatus,
        prediction: aiPrediction,
        confidence: aiConfidence,
        error: aiError
      }
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post. Please try again.',
    });
  }
};

// ============================================================
// GET MY POSTS
// ============================================================
const getMyPosts = async (req, res) => {
  try {
    const user = req.user;

    const posts = await Post.find({ submittedBy: user._id })
      .sort({ createdAt: -1 })
      .select('-submittedBy -__v');

    res.json({
      success: true,
      posts: posts,
    });
  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your posts.',
    });
  }
};

// ============================================================
// GET POSTS BY STATUS
// ============================================================
const getPostsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ['pending', 'approved', 'declined'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be pending, approved, or declined.',
      });
    }

    const posts = await Post.find({ status })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({
      success: true,
      posts: posts,
    });
  } catch (error) {
    console.error('Get posts by status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts.',
    });
  }
};

// ============================================================
// DELETE POST - With validation
// ============================================================
const deletePost = async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = getSafeId(rawId);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID provided.',
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format.',
      });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    if (post.submittedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this post.',
      });
    }

    if (post.status === 'approved' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Approved posts cannot be deleted. Please contact admin.',
      });
    }

    await post.deleteOne();
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: -1 } });

    res.json({
      success: true,
      message: 'Post deleted successfully.',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete post.',
    });
  }
};

// ============================================================
// RUN COMPLETE VERIFICATION
// ============================================================
const runVerification = async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = getSafeId(rawId);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID provided.',
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format.',
      });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    console.log('🔍 Running COMPLETE verification for post:', id);

    let aiPrediction = null;
    let aiConfidence = null;
    let aiStatus = 'error';
    let aiError = null;
    let verificationStatus = 'NEEDS_REVIEW';
    let riskScore = 54;
    let reasons = ['Pending verification'];
    let completeVerificationData = null;
    let webVerification = null;
    let finalVerdict = null;

    try {
      if (post.title && post.description) {
        console.log('🤖 Sending to complete verification service...');
        const result = await completeVerification(post.title, post.description);
        
        if (result.success) {
          aiPrediction = result.ai_prediction.prediction;
          aiConfidence = result.ai_prediction.confidence;
          aiStatus = 'completed';
          
          webVerification = result.web_verification;
          finalVerdict = result.final_verdict;
          
          completeVerificationData = {
            timestamp: result.timestamp,
            ai_prediction: result.ai_prediction,
            web_verification: result.web_verification,
            final_verdict: result.final_verdict
          };
          
          console.log(`✅ AI Prediction: ${aiPrediction} (${(aiConfidence * 100).toFixed(1)}%)`);
          console.log(`📊 Web Verification: ${webVerification.status} - ${webVerification.sources_count} sources`);
          console.log(`⚖️ Final Verdict: ${finalVerdict.verdict} (${finalVerdict.confidence}%)`);
          
          post.aiPrediction = aiPrediction;
          post.aiConfidence = aiConfidence;
          post.aiStatus = aiStatus;
          post.aiError = null;
          post.aiVerification = completeVerificationData;
          
          const verdict = finalVerdict.verdict || '';
          if (verdict.includes('FAKE') || verdict === 'FAKE') {
            verificationStatus = 'POTENTIALLY_MISLEADING';
            riskScore = Math.round((1 - finalVerdict.confidence / 100) * 100);
            reasons = [
              `Final verdict: ${finalVerdict.verdict}`,
              `Reason: ${finalVerdict.reason}`,
              `AI predicted: ${aiPrediction} with ${(aiConfidence * 100).toFixed(1)}% confidence`,
              `Web sources found: ${webVerification.sources_count}`
            ];
          } else if (verdict.includes('REAL') || verdict === 'REAL' || verdict === 'REAL (VERIFIED)') {
            verificationStatus = 'LIKELY_CREDIBLE';
            riskScore = Math.round((1 - finalVerdict.confidence / 100) * 50);
            reasons = [
              `Final verdict: ${finalVerdict.verdict}`,
              `Reason: ${finalVerdict.reason}`,
              `AI predicted: ${aiPrediction} with ${(aiConfidence * 100).toFixed(1)}% confidence`,
              `Web sources found: ${webVerification.sources_count}`
            ];
          } else {
            verificationStatus = 'NEEDS_REVIEW';
            riskScore = 54;
            reasons = [
              `Final verdict: ${finalVerdict.verdict}`,
              `Reason: ${finalVerdict.reason}`
            ];
          }
          
          post.verificationStatus = verificationStatus;
          post.riskScore = riskScore;
          post.verificationReasons = reasons;
          
          await post.save();
          
        } else {
          aiStatus = 'error';
          aiError = result.error || 'Verification service returned an error';
          console.warn(`⚠️ Complete verification failed: ${aiError}`);
          
          post.aiStatus = aiStatus;
          post.aiError = aiError;
          await post.save();
          
          return res.status(500).json({
            success: false,
            message: 'Verification service failed.',
            error: aiError,
            aiStatus: aiStatus
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Post has no content to verify.'
        });
      }
    } catch (error) {
      aiStatus = 'error';
      aiError = error.message;
      console.error('❌ Verification service error:', error);
      
      post.aiStatus = aiStatus;
      post.aiError = aiError;
      await post.save();
      
      return res.status(500).json({
        success: false,
        message: 'Verification service error. Please check if the service is running.',
        error: error.message,
        aiStatus: aiStatus
      });
    }

    res.json({
      success: true,
      verificationStatus: verificationStatus,
      riskScore: riskScore,
      reasons: reasons,
      aiPrediction: aiPrediction,
      aiConfidence: aiConfidence,
      aiStatus: aiStatus,
      aiError: aiError,
      webVerification: webVerification,
      finalVerdict: finalVerdict,
      completeVerification: completeVerificationData,
      message: 'Complete verification completed successfully'
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.',
      error: error.message
    });
  }
};

module.exports = {
  getPublicPosts,
  getPostById,
  createPost,
  getMyPosts,
  getPostsByStatus,
  deletePost,
  runVerification,
};