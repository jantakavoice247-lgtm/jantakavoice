// instagram/automation/login.js - Standalone login script

const InstagramAutomation = require('./index');
const logger = require('../utils/logger');

async function login() {
  logger.info('🔐 Instagram Login');
  logger.info('========================================');
  logger.info('This will open Instagram and let you login manually.');
  logger.info('Your session will be saved for future use.');
  logger.info('========================================\n');

  const automation = new InstagramAutomation();
  
  try {
    const success = await automation.manualLogin();
    
    if (success) {
      logger.success('✅ Login successful! Session saved.');
      logger.info('You can now approve posts and they will be auto-published to Instagram.');
    } else {
      logger.error('❌ Login failed. Please try again.');
    }
  } catch (error) {
    logger.error('❌ Login error:', error.message);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  login();
}

module.exports = login;