// instagram/automation/browser.js - COMPLETE FIXED VERSION

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.sessionPath = path.join(config.sessionDir, 'instagram-session.json');
    this.isLoggedIn = false;
    
    if (!fs.existsSync(config.sessionDir)) {
      fs.mkdirSync(config.sessionDir, { recursive: true });
    }
  }

  async launch() {
    logger.info('🚀 Launching browser...');
    
    try {
      const hasSession = fs.existsSync(this.sessionPath);
      
      this.browser = await chromium.launch({
        headless: config.headless !== undefined ? config.headless : false,
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });

      if (hasSession) {
        logger.info('📂 Loading saved session...');
        try {
          this.context = await this.browser.newContext({
            storageState: this.sessionPath,
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          });
          logger.success('✅ Session loaded successfully');
        } catch (err) {
          logger.warn('⚠️ Failed to load session, creating new context', err.message);
          this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          });
        }
      } else {
        logger.info('🆕 No session found, creating new context');
        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
      }

      this.page = await this.context.newPage();
      logger.success('✅ Browser launched successfully');
      return this.page;
      
    } catch (error) {
      logger.error('❌ Failed to launch browser', error.message);
      throw error;
    }
  }

  async checkSession() {
    try {
      logger.info('🔍 Checking session validity...');
      
      if (!this.page) {
        await this.launch();
      }
      
      // Go to Instagram home page for session check
      await this.page.goto(config.instagramUrl, { 
        waitUntil: 'networkidle',
        timeout: config.timeout || 30000
      });

      await this.page.waitForTimeout(3000);

      const currentUrl = this.page.url();
      logger.info(`📍 Current URL: ${currentUrl}`);

      // Check for login form
      const loginForm = await this.page.locator('input[name="username"]');
      const hasLoginForm = await loginForm.count() > 0;
      
      if (hasLoginForm) {
        logger.warn('⚠️ On login page - session expired');
        this.isLoggedIn = false;
        return false;
      }

      // Check for session cookie
      const cookies = await this.context.cookies();
      const hasSessionCookie = cookies.some(c => c.name === 'sessionid' && c.value);
      
      if (hasSessionCookie) {
        logger.success('✅ Session cookie found');
        this.isLoggedIn = true;
        return true;
      }

      // Check for logged-in indicators
      const homeIcon = await this.page.locator('svg[aria-label="Home"]');
      const profileIcon = await this.page.locator('svg[aria-label="Profile"]');
      const feedArticle = await this.page.locator('article');
      const createBtn = await this.page.locator('button:has-text("Create")');
      
      const hasHomeIcon = await homeIcon.count() > 0;
      const hasProfileIcon = await profileIcon.count() > 0;
      const hasFeed = await feedArticle.count() > 0;
      const hasCreateBtn = await createBtn.count() > 0;
      
      const isLoggedIn = hasHomeIcon || hasProfileIcon || hasFeed || hasCreateBtn;

      if (isLoggedIn) {
        logger.success('✅ Session is valid (UI indicators found)');
        this.isLoggedIn = true;
        return true;
      }

      // Check if on login page using URL
      if (currentUrl.includes('accounts/login')) {
        logger.warn('⚠️ Session expired - on login page');
        this.isLoggedIn = false;
        return false;
      }

      logger.warn('⚠️ Session state unclear - assuming invalid');
      this.isLoggedIn = false;
      return false;

    } catch (error) {
      logger.error('❌ Error checking session', error.message);
      this.isLoggedIn = false;
      return false;
    }
  }

  async saveSession() {
    try {
      if (this.context) {
        const storage = await this.context.storageState();
        fs.writeFileSync(this.sessionPath, JSON.stringify(storage, null, 2));
        logger.success('✅ Session saved successfully');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('❌ Failed to save session', error.message);
      return false;
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        logger.info('🔒 Browser closed');
      }
    } catch (error) {
      logger.error('Error closing browser', error.message);
    }
  }

  async getPage() {
    if (!this.page) {
      await this.launch();
    }
    return this.page;
  }

  getContext() {
    return this.context;
  }

  isAuthenticated() {
    return this.isLoggedIn;
  }
}

module.exports = BrowserManager;