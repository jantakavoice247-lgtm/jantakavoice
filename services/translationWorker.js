// services/translationWorker.js
const translationService = require('./translationService');
const Post = require('../models/Post');

/**
 * Translation Worker - Handles background translation of posts
 */
class TranslationWorker {
  constructor() {
    this.isProcessing = false;
    this.batchSize = 10;
    this.retryDelay = 5000; // 5 seconds
    this.maxRetries = 3;
    this.supportedLanguages = ['en', 'hi', 'as', 'bn'];
  }

  /**
   * Process a single post for translation
   * @param {string} postId - The post ID
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<boolean>} - Success status
   */
  async processPost(postId, retryCount = 0) {
    try {
      const post = await Post.findById(postId);
      if (!post) {
        console.log(`⚠️ Post ${postId} not found`);
        return false;
      }

      // Skip if already completed
      if (post.translationStatus === 'completed') {
        console.log(`⏭️ Post ${postId} already translated`);
        return true;
      }

      // Skip if failed and retry count exceeded
      if (post.translationStatus === 'failed' && retryCount >= this.maxRetries) {
        console.log(`❌ Post ${postId} failed after ${this.maxRetries} retries`);
        return false;
      }

      console.log(`🔄 Processing post ${postId}: "${post.title.substring(0, 30)}..."`);

      const sourceLang = post.originalLanguage || 'en';
      const targetLanguages = this.supportedLanguages.filter(lang => lang !== sourceLang);

      // Prepare translations
      const titleTranslations = {};
      const descTranslations = {};

      // Set source language translations
      titleTranslations[sourceLang] = post.title || '';
      descTranslations[sourceLang] = post.description || '';

      // Translate to each target language
      for (const targetLang of targetLanguages) {
        try {
          // Translate title
          if (post.title && post.title.trim()) {
            titleTranslations[targetLang] = await translationService.translate(
              post.title,
              sourceLang,
              targetLang
            );
          } else {
            titleTranslations[targetLang] = '';
          }

          // Translate description
          if (post.description && post.description.trim()) {
            descTranslations[targetLang] = await translationService.translate(
              post.description,
              sourceLang,
              targetLang
            );
          } else {
            descTranslations[targetLang] = '';
          }

          console.log(`✅ Translated post ${postId} to ${targetLang}`);

        } catch (error) {
          console.error(`❌ Translation failed for ${postId} to ${targetLang}:`, error.message);
          // Keep existing translation or empty
          titleTranslations[targetLang] = titleTranslations[sourceLang] || '';
          descTranslations[targetLang] = descTranslations[sourceLang] || '';
        }
      }

      // Update post with translations
      post.translations = {
        title: titleTranslations,
        description: descTranslations,
      };
      post.translationStatus = 'completed';
      post.updatedAt = new Date();
      
      await post.save();
      
      console.log(`✅ Post ${postId} translation completed`);
      return true;

    } catch (error) {
      console.error(`❌ Error processing post ${postId}:`, error.message);
      
      // Update status to failed
      if (retryCount >= this.maxRetries - 1) {
        await Post.findByIdAndUpdate(postId, {
          translationStatus: 'failed',
          updatedAt: new Date(),
        });
      }
      
      return false;
    }
  }

  /**
   * Process all pending posts in batches
   * @returns {Promise<Object>} - Processing results
   */
  async processPendingPosts() {
    if (this.isProcessing) {
      console.log('⏳ Translation worker already running');
      return { processed: 0, skipped: 0, failed: 0 };
    }

    this.isProcessing = true;
    console.log('🔍 Scanning for pending translations...');

    try {
      const pendingPosts = await Post.find({
        translationStatus: { $in: ['pending', 'failed'] },
      })
      .sort({ createdAt: 1 })
      .limit(this.batchSize);

      if (pendingPosts.length === 0) {
        console.log('📭 No pending posts found');
        this.isProcessing = false;
        return { processed: 0, skipped: 0, failed: 0 };
      }

      console.log(`📦 Found ${pendingPosts.length} posts to process`);
      
      let processed = 0;
      let failed = 0;

      for (const post of pendingPosts) {
        const success = await this.processPost(post._id);
        if (success) {
          processed++;
        } else {
          failed++;
        }
      }

      console.log(`📊 Translation batch complete: ${processed} processed, ${failed} failed`);
      
      this.isProcessing = false;
      return { processed, failed, total: pendingPosts.length };

    } catch (error) {
      console.error('❌ Error processing pending posts:', error);
      this.isProcessing = false;
      return { processed: 0, skipped: 0, failed: 0 };
    }
  }

  /**
   * Start the worker as a background process
   * @param {number} interval - Polling interval in milliseconds
   */
  startWorker(interval = 30000) {
    console.log(`🚀 Starting translation worker (interval: ${interval}ms)`);
    
    // Process immediately on start
    this.processPendingPosts();

    // Set up recurring processing
    this.interval = setInterval(() => {
      this.processPendingPosts();
    }, interval);

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      this.stopWorker();
    });
    process.on('SIGINT', () => {
      this.stopWorker();
    });
  }

  /**
   * Stop the worker
   */
  stopWorker() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('🛑 Translation worker stopped');
    }
  }
}

// Export singleton instance
module.exports = new TranslationWorker();