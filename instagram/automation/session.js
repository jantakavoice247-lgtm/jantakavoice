// instagram/automation/session.js - FIXED

const readline = require('readline');
const BrowserManager = require('./browser');
const logger = require('../utils/logger');
const config = require('../config/config');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class SessionManager {
  constructor() {
    this.browser = new BrowserManager();
  }

  askQuestion(question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  async manualLogin() {
    logger.info('🔐 Instagram Manual Login');
    logger.info('========================================');
    logger.info('This will open Instagram in a visible browser.');
    logger.info('You need to login manually.');
    logger.info('Session will be saved for future use.');
    logger.info('========================================\n');

    try {
      // Force headless: false for manual login
      const originalHeadless = config.headless;
      config.headless = false;
      
      const page = await this.browser.launch();
      
      await page.goto(config.instagramUrl, { waitUntil: 'networkidle' });
      logger.info('📱 Instagram loaded - please login manually');

      await this.waitForLogin(page);

      await this.browser.saveSession();
      logger.success('✅ Session saved successfully!');
      
      const isLoggedIn = await this.browser.checkSession();
      if (isLoggedIn) {
        logger.success('✅ You are now logged in and ready to publish posts!');
      } else {
        logger.warn('⚠️ Login could not be verified. Please try again.');
      }

      // Restore headless config
      config.headless = originalHeadless;
      
      await this.browser.close();
      return true;

    } catch (error) {
      logger.error('❌ Login process failed', error.message);
      await this.browser.close();
      return false;
    } finally {
      rl.close();
    }
  }

  async waitForLogin(page) {
    return new Promise((resolve) => {
      logger.info('⏳ Waiting for you to complete login...');
      logger.info('   Press ENTER after you have logged in successfully');
      
      rl.question('\nPress ENTER when done: ', async () => {
        // Wait a moment for the page to settle
        await page.waitForTimeout(2000);
        
        const isLoggedIn = await this.browser.checkSession();
        if (isLoggedIn) {
          logger.success('✅ Login detected!');
          resolve();
        } else {
          logger.warn('⚠️ Login not detected. Are you sure you logged in?');
          const answer = await this.askQuestion('Try again? (y/n): ');
          if (answer.toLowerCase() === 'y') {
            await this.waitForLogin(page);
          } else {
            logger.warn('⚠️ Continuing without verification...');
            resolve();
          }
        }
      });
    });
  }

  async validateSession() {
    logger.info('🔍 Validating Instagram session...');
    
    try {
      const page = await this.browser.launch();
      const isValid = await this.browser.checkSession();
      await this.browser.close();
      
      if (isValid) {
        logger.success('✅ Session is valid and working!');
        return true;
      } else {
        logger.warn('⚠️ Session is invalid or expired.');
        logger.info('Please run: npm run instagram:login');
        return false;
      }
    } catch (error) {
      logger.error('❌ Session validation failed', error.message);
      return false;
    }
  }
}

// CLI execution
if (require.main === module) {
  const sessionManager = new SessionManager();
  const args = process.argv.slice(2);
  
  if (args.includes('--login')) {
    sessionManager.manualLogin();
  } else if (args.includes('--validate')) {
    sessionManager.validateSession();
  } else {
    console.log('Usage:');
    console.log('  --login    : Manual login to Instagram');
    console.log('  --validate : Validate existing session');
  }
}

module.exports = SessionManager;