// instagram/automation/index.js - Main Entry Point

const InstagramPublisher = require('./instagram-publisher');
const SessionManager = require('./session');
const logger = require('../utils/logger');

class InstagramAutomation {
  constructor() {
    this.publisher = new InstagramPublisher();
    this.sessionManager = new SessionManager();
    this.isInitialized = false;
    this.initError = null;
  }

  async initialize() {
    if (this.isInitialized) {
      return true;
    }
    
    try {
      logger.info('🔧 Initializing Instagram automation...');
      
      const isValid = await this.sessionManager.validateSession();
      if (!isValid) {
        this.initError = 'Instagram session not valid. Please run: npm run instagram:login';
        logger.warn(`⚠️ ${this.initError}`);
        return false;
      }
      
      this.isInitialized = true;
      logger.success('✅ Instagram automation initialized');
      return true;
    } catch (error) {
      this.initError = error.message;
      logger.error('❌ Failed to initialize Instagram automation', error.message);
      return false;
    }
  }

  async publishPost(postData) {
    logger.info('🚀 Instagram Automation started');
    logger.info(`📝 Post: ${postData.title || 'Untitled'}`);

    try {
      if (!postData) {
        throw new Error('No post data provided');
      }

      const postId = postData._id || postData.id;
      if (!postId) {
        throw new Error('Post ID is required');
      }

      if (postData.instagram && postData.instagram.status === 'published') {
        logger.warn('⚠️ Post already published to Instagram');
        return {
          success: false,
          status: 'already_published',
          message: 'This post has already been published to Instagram'
        };
      }

      if (!postData.evidence || postData.evidence.length === 0) {
        logger.warn('⚠️ No evidence/image found for this post');
        return {
          success: false,
          status: 'failed',
          message: 'No image available for Instagram post'
        };
      }

      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          status: 'failed',
          message: this.initError || 'Instagram automation not initialized'
        };
      }

      const result = await this.publisher.publish(postData);
      
      logger.info(`📸 Instagram publish result: ${result.success ? '✅ Success' : '❌ Failed'}`);
      return result;

    } catch (error) {
      logger.error('❌ Instagram automation failed', error.message);
      return {
        success: false,
        status: 'failed',
        message: error.message || 'Automation failed'
      };
    }
  }

  async publish(postData) {
    return this.publishPost(postData);
  }

  async validateSession() {
    return await this.sessionManager.validateSession();
  }

  async manualLogin() {
    const result = await this.sessionManager.manualLogin();
    if (result) {
      this.isInitialized = true;
      this.initError = null;
    }
    return result;
  }

  async close() {
    if (this.publisher && this.publisher.browser) {
      await this.publisher.browser.close();
    }
    this.isInitialized = false;
  }
}

module.exports = InstagramAutomation;