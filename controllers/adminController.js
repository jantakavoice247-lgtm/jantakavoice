// controllers/adminController.js - Complete with Instagram Auto-Post on Approval

const Post = require('../models/Post');
const User = require('../models/User');
const Report = require('../models/Report');
const Category = require('../models/Category');
const mongoose = require('mongoose');

// ============================================================
// INSTAGRAM AUTOMATION MODULE (Lazy Load)
// ============================================================
let instagramInstance = null;
let instagramInitialized = false;
let instagramInitPromise = null;

function getInstagramAutomation() {
  if (!instagramInitialized) {
    try {
      const InstagramAutomation = require('../instagram/automation/index');
      instagramInstance = new InstagramAutomation();
      console.log('📸 Instagram automation module loaded and instantiated');
      
      // Initialize asynchronously
      if (instagramInstance && typeof instagramInstance.initialize === 'function') {
        instagramInitPromise = instagramInstance.initialize().catch(err => {
          console.warn('⚠️ Instagram initialization warning:', err.message);
        });
      }
      
    } catch (error) {
      console.warn('⚠️ Instagram automation module not found:', error.message);
      console.warn('   Please ensure instagram/automation/index.js exists');
      instagramInstance = null;
    }
    instagramInitialized = true;
  }
  return instagramInstance;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Helper to safely get the Instagram automation instance
 * with initialization check
 */
async function getInstagramAutomationAsync() {
  const instagram = getInstagramAutomation();
  if (instagram && instagramInitPromise) {
    await instagramInitPromise;
  }
  return instagram;
}

// ============================================================
// GET ALL POSTS (Admin)
// ============================================================
const getAllPosts = async (req, res) => {
  try {
    const { status, category, search, limit = 50, page = 1 } = req.query;

    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      const orConditions = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { anonymousId: { $regex: search, $options: 'i' } },
      ];
      
      if (isValidObjectId(search)) {
        orConditions.push({ _id: search });
      }
      
      query.$or = orConditions;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('submittedBy', 'name email anonymousId')
      .select('-__v');

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
    console.error('Get all posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts.',
    });
  }
};

// ============================================================
// APPROVE POST (Admin) - WITH INSTAGRAM AUTO-POST
// ============================================================
const approvePost = async (req, res) => {
  try {
    const { id } = req.params;

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

    if (post.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Post is already approved.',
      });
    }

    // Update post status
    post.status = 'approved';
    post.approvedAt = new Date();
    post.approvedBy = req.user._id;
    await post.save();

    console.log(`✅ Post approved: ${post._id} - "${post.title}"`);

    // ============================================================
    // TRIGGER INSTAGRAM AUTO-POST (NON-BLOCKING)
    // ============================================================
    let instagramStatus = 'not_published';
    let instagramMessage = 'Instagram automation disabled';

    try {
      const instagram = await getInstagramAutomationAsync();
      
      if (instagram && typeof instagram.publishPost === 'function') {
        instagramMessage = 'Instagram publishing triggered';
        
        // Run asynchronously - don't block the response
        (async () => {
          try {
            const postId = post._id.toString();
            console.log(`📸 Triggering Instagram publish for post: ${postId}`);
            
            // Update status to publishing
            post.instagram.status = 'publishing';
            post.instagram.lastAttempt = new Date();
            post.instagram.retryCount = (post.instagram.retryCount || 0) + 1;
            await post.save();

            // Get fresh post data
            const freshPost = await Post.findById(postId);
            if (!freshPost) {
              console.error(`❌ Post ${postId} not found for Instagram publish`);
              return;
            }

            // Check if already published
            if (freshPost.instagram?.status === 'published') {
              console.log(`ℹ️ Post ${postId} already published to Instagram`);
              return;
            }

            // Check if there's an image
            if (!freshPost.evidence || freshPost.evidence.length === 0) {
              console.log(`ℹ️ Post ${postId} has no image - skipping Instagram publish`);
              freshPost.instagram.status = 'failed';
              freshPost.instagram.error = 'No image available for Instagram post';
              await freshPost.save();
              return;
            }

            // Publish to Instagram
            console.log(`📸 Publishing post ${postId} to Instagram...`);
            const result = await instagram.publishPost(freshPost.toJSON());
            
            if (result.success) {
              freshPost.instagram.status = 'published';
              freshPost.instagram.instagramId = result.instagramId || null;
              freshPost.instagram.publishedAt = new Date();
              freshPost.instagram.error = null;
              console.log(`✅ Instagram published successfully for post: ${postId}`);
            } else {
              freshPost.instagram.status = 'failed';
              freshPost.instagram.error = result.message || 'Unknown error';
              console.error(`❌ Instagram publish failed for post: ${postId}`, result.message);
            }
            
            await freshPost.save();
            console.log(`📊 Instagram status updated for post: ${postId} -> ${freshPost.instagram.status}`);
            
          } catch (error) {
            console.error('❌ Instagram automation error:', error.message);
            try {
              const freshPost = await Post.findById(post._id);
              if (freshPost) {
                freshPost.instagram.status = 'failed';
                freshPost.instagram.error = error.message || 'Automation error';
                freshPost.instagram.retryCount = (freshPost.instagram.retryCount || 0) + 1;
                await freshPost.save();
              }
            } catch (saveError) {
              console.error('Failed to save Instagram error state:', saveError);
            }
          }
        })();
        
        instagramStatus = 'publishing';
      } else {
        console.log('ℹ️ Instagram automation not available - module not found or not initialized');
        instagramMessage = 'Instagram automation not available';
      }
    } catch (error) {
      console.error('❌ Error getting Instagram automation:', error.message);
      instagramMessage = 'Instagram automation error: ' + error.message;
    }

    res.json({
      success: true,
      message: 'Post approved successfully!',
      post: post,
      instagram: {
        status: instagramStatus,
        message: instagramMessage
      }
    });
  } catch (error) {
    console.error('Approve post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve post.',
    });
  }
};

// ============================================================
// REJECT POST (Admin)
// ============================================================
const rejectPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

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

    if (post.status === 'declined') {
      return res.status(400).json({
        success: false,
        message: 'Post is already declined.',
      });
    }

    post.status = 'declined';
    post.verificationReasons = [
      ...post.verificationReasons,
      `Declined by admin: ${reason || 'No reason provided'}`
    ];
    await post.save();

    res.json({
      success: true,
      message: 'Post declined successfully.',
      post: post,
    });
  } catch (error) {
    console.error('Reject post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject post.',
    });
  }
};

// ============================================================
// RETRY INSTAGRAM PUBLISH (Admin)
// ============================================================
const retryInstagram = async (req, res) => {
  try {
    const { id } = req.params;

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

    if (post.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved posts can be published to Instagram.',
      });
    }

    if (post.instagram?.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'This post is already published to Instagram.',
      });
    }

    if (!post.evidence || post.evidence.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'This post has no image. Cannot publish to Instagram.',
      });
    }

    const instagram = await getInstagramAutomationAsync();
    if (!instagram || typeof instagram.publishPost !== 'function') {
      return res.status(503).json({
        success: false,
        message: 'Instagram automation is not available.',
      });
    }

    // Update status
    post.instagram.status = 'publishing';
    post.instagram.lastAttempt = new Date();
    post.instagram.retryCount = (post.instagram.retryCount || 0) + 1;
    await post.save();

    // Run asynchronously
    (async () => {
      try {
        const freshPost = await Post.findById(id);
        if (!freshPost) return;

        const result = await instagram.publishPost(freshPost.toJSON());
        
        if (result.success) {
          freshPost.instagram.status = 'published';
          freshPost.instagram.instagramId = result.instagramId || null;
          freshPost.instagram.publishedAt = new Date();
          freshPost.instagram.error = null;
          console.log(`✅ Instagram retry successful for post: ${id}`);
        } else {
          freshPost.instagram.status = 'failed';
          freshPost.instagram.error = result.message || 'Unknown error';
          freshPost.instagram.retryCount = (freshPost.instagram.retryCount || 0) + 1;
          console.error(`❌ Instagram retry failed for post: ${id}`, result.message);
        }
        
        await freshPost.save();
      } catch (error) {
        console.error('❌ Instagram retry error:', error.message);
        const freshPost = await Post.findById(id);
        if (freshPost) {
          freshPost.instagram.status = 'failed';
          freshPost.instagram.error = error.message || 'Automation error';
          freshPost.instagram.retryCount = (freshPost.instagram.retryCount || 0) + 1;
          await freshPost.save();
        }
      }
    })();

    res.json({
      success: true,
      message: 'Instagram retry triggered successfully.',
      post: {
        _id: post._id,
        title: post.title,
        instagram: post.instagram
      }
    });
  } catch (error) {
    console.error('Retry Instagram error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry Instagram publish.',
    });
  }
};

// ============================================================
// GET INSTAGRAM STATUS (Admin)
// ============================================================
const getInstagramStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format.',
      });
    }

    const post = await Post.findById(id).select('instagram title status');
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    res.json({
      success: true,
      post: {
        _id: post._id,
        title: post.title,
        status: post.status,
        instagram: post.instagram || { status: 'not_published' }
      }
    });
  } catch (error) {
    console.error('Get Instagram status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Instagram status.',
    });
  }
};

// ============================================================
// GET STATS (Admin)
// ============================================================
const getStats = async (req, res) => {
  try {
    const [
      totalPosts,
      pendingPosts,
      approvedPosts,
      declinedPosts,
      totalUsers,
      totalReports,
      pendingReports,
      resolvedReports,
      rejectedReports,
    ] = await Promise.all([
      Post.countDocuments(),
      Post.countDocuments({ status: 'pending' }),
      Post.countDocuments({ status: 'approved' }),
      Post.countDocuments({ status: 'declined' }),
      User.countDocuments({ role: 'user' }),
      Report.countDocuments(),
      Report.countDocuments({ status: 'under_review' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'rejected' }),
    ]);

    res.json({
      success: true,
      stats: {
        posts: {
          total: totalPosts,
          pending: pendingPosts,
          approved: approvedPosts,
          declined: declinedPosts,
        },
        users: {
          total: totalUsers,
        },
        reports: {
          total: totalReports,
          under_review: pendingReports,
          resolved: resolvedReports,
          rejected: rejectedReports,
        },
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats.',
    });
  }
};

// ============================================================
// GET ALL USERS (Admin)
// ============================================================
const getAllUsers = async (req, res) => {
  try {
    const { search, limit = 20, page = 1 } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { anonymousId: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-passwordHash -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users.',
    });
  }
};

// ============================================================
// UPDATE USER STATUS (Admin)
// ============================================================
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: 'isActive field is required.',
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    const user = await User.findById(id).select('-passwordHash -__v');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own account status.',
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully.`,
      user: user,
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status.',
    });
  }
};

// ============================================================
// GET ALL REPORTS (Admin)
// ============================================================
const getAllReports = async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('reportedBy', 'name email anonymousId')
      .select('-__v');

    const total = await Report.countDocuments(query);

    res.json({
      success: true,
      reports: reports,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get all reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports.',
    });
  }
};

// ============================================================
// UPDATE REPORT STATUS (Admin)
// ============================================================
const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['under_review', 'resolved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be under_review, resolved, or rejected.',
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID format.',
      });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found.',
      });
    }

    report.status = status;
    if (status === 'resolved' || status === 'rejected') {
      report.resolvedAt = new Date();
    }
    await report.save();

    res.json({
      success: true,
      message: `Report ${status === 'resolved' ? 'resolved' : 'rejected'} successfully.`,
      report: report,
    });
  } catch (error) {
    console.error('Update report status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report status.',
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
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
};