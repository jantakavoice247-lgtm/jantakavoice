// models/Post.js - Complete with Instagram fields

const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    source: {
      type: String,
      trim: true,
      default: '',
    },
    evidence: {
      type: [String],
      default: [],
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    anonymousId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined'],
      default: 'pending',
    },
    verificationStatus: {
      type: String,
      enum: ['LIKELY_CREDIBLE', 'POTENTIALLY_MISLEADING', 'NEEDS_REVIEW'],
      default: 'NEEDS_REVIEW',
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 54,
    },
    verificationReasons: {
      type: [String],
      default: ['Pending automated verification'],
    },
    aiPrediction: {
      type: String,
      enum: ['real', 'fake', 'needs_review', null],
      default: null,
    },
    aiConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    aiStatus: {
      type: String,
      enum: ['pending', 'completed', 'error', 'unavailable'],
      default: 'pending',
    },
    aiError: {
      type: String,
      default: null,
    },
    aiVerification: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    translations: {
      type: Map,
      of: new mongoose.Schema(
        {
          title: String,
          description: String,
        },
        { _id: false }
      ),
      default: {},
    },
    likes: {
      type: Number,
      default: 0,
    },
    comments: {
      type: Number,
      default: 0,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // ============================================================
    // INSTAGRAM FIELDS
    // ============================================================
    instagram: {
      status: {
        type: String,
        enum: ['not_published', 'publishing', 'published', 'failed'],
        default: 'not_published'
      },
      instagramId: {
        type: String,
        default: null
      },
      publishedAt: {
        type: Date,
        default: null
      },
      error: {
        type: String,
        default: null
      },
      retryCount: {
        type: Number,
        default: 0
      },
      lastAttempt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true,
  }
);

// Indexes
postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ submittedBy: 1, createdAt: -1 });
postSchema.index({ category: 1, status: 1, createdAt: -1 });
postSchema.index({ anonymousId: 1 });
postSchema.index({ createdAt: -1 });

postSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Post = mongoose.model('Post', postSchema);

module.exports = Post;