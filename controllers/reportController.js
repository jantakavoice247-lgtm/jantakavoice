const Report = require('../models/Report');
const Post = require('../models/Post');

// ============================================================
// CREATE REPORT
// ============================================================
const createReport = async (req, res) => {
  try {
    const { postId, reason, details } = req.body;

    if (!postId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Post ID and reason are required.',
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    const existingReport = await Report.findOne({
      postId: postId,
      reportedBy: req.user._id,
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'You have already reported this post.',
      });
    }

    const report = await Report.create({
      postId: postId,
      postTitle: post.title,
      reportedBy: req.user._id,
      anonymousId: req.user.anonymousId,
      reason: reason,
      details: details || '',
      status: 'under_review',
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. We will review it shortly.',
      report: report,
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit report. Please try again.',
    });
  }
};

// ============================================================
// GET MY REPORTS
// ============================================================
const getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ reportedBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate('postId', 'title status')
      .select('-__v');

    res.json({
      success: true,
      reports: reports,
    });
  } catch (error) {
    console.error('Get my reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your reports.',
    });
  }
};

module.exports = {
  createReport,
  getMyReports,
};