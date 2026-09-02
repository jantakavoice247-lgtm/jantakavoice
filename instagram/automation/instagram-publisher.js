// instagram/automation/instagram-publisher.js - COMPLETE FIXED VERSION

const fs = require('fs');
const path = require('path');
const BrowserManager = require('./browser');
const logger = require('../utils/logger');
const config = require('../config/config');

class InstagramPublisher {
  constructor() {
    this.browser = new BrowserManager();
    this.isLoggedIn = false;
  }

  async publish(postData) {
    logger.info('📸 Starting Instagram publishing process...');
    logger.info(`📝 Post ID: ${postData?._id || postData?.id || 'Unknown'}`);
    logger.info(`📝 Title: ${postData?.title || 'Untitled'}`);

    try {
      if (!postData) {
        throw new Error('No post data provided');
      }

      // ============================================================
      // LAUNCH + SESSION
      // ============================================================

      await this.browser.launch();

      this.isLoggedIn = await this.browser.checkSession();

      if (!this.isLoggedIn) {
        logger.error('❌ Not logged in to Instagram');

        return {
          success: false,
          status: 'failed',
          message: 'Instagram session expired. Please run: npm run instagram:login'
        };
      }

      const page = await this.browser.getPage();

      // ============================================================
      // STEP 0: Go to HOME page first (reliable for Create button)
      // ============================================================
      logger.info('📱 Navigating to Instagram home page...');

      await page.goto(config.instagramUrl, {
        waitUntil: 'networkidle',
        timeout: config.timeout || 30000
      });

      await page.waitForTimeout(3000);

      logger.success('✅ Home page loaded');

      // ============================================================
      // STEP 1: Click Create Post Button from Home Page
      // ============================================================

      logger.info('📱 STEP 1: Looking for Create Post button on home page...');

      let createClicked = false;

      // Try different selectors for Create button
      const createSelectors = [
        'button:has-text("Create")',
        'div[role="button"]:has-text("Create")',
        'svg[aria-label="New post"]',
        'button[aria-label*="Create"]'
      ];

      for (const selector of createSelectors) {
        try {
          const elements = page.locator(selector);
          const count = await elements.count();

          if (count === 0) continue;

          for (let i = 0; i < count; i++) {
            const element = elements.nth(i);

            if (!(await element.isVisible().catch(() => false))) continue;

            await element.scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(500);
            await element.click();

            createClicked = true;
            logger.success(`✅ Create clicked using: ${selector}`);

            await page.waitForTimeout(2000);
            break;
          }

          if (createClicked) break;
        } catch (error) {
          logger.warn(`⚠️ Create selector failed: ${selector} - ${error.message}`);
        }
      }

      // If not found on home page, try account page
      if (!createClicked) {
        logger.info('🔄 Create button not found on home page, trying account page...');
        
        await page.goto(config.instagramAccountUrl, {
          waitUntil: 'networkidle',
          timeout: config.timeout || 30000
        });

        await page.waitForTimeout(3000);

        for (const selector of createSelectors) {
          try {
            const elements = page.locator(selector);
            const count = await elements.count();

            if (count === 0) continue;

            for (let i = 0; i < count; i++) {
              const element = elements.nth(i);

              if (!(await element.isVisible().catch(() => false))) continue;

              await element.scrollIntoViewIfNeeded().catch(() => {});
              await page.waitForTimeout(500);
              await element.click();

              createClicked = true;
              logger.success(`✅ Create clicked on account page using: ${selector}`);

              await page.waitForTimeout(2000);
              break;
            }

            if (createClicked) break;
          } catch (error) {
            logger.warn(`⚠️ Create selector failed on account page: ${selector} - ${error.message}`);
          }
        }
      }

      if (!createClicked) {
        throw new Error('Could not find Create/New Post button');
      }

      // ============================================================
      // STEP 2: PREPARE + UPLOAD IMAGE
      // ============================================================

      logger.info('📤 STEP 2: Uploading image...');

      const imagePath = await this.prepareImage(postData);

      if (!imagePath || !fs.existsSync(imagePath)) {
        throw new Error('No valid image available for Instagram post');
      }

      await page.waitForTimeout(1500);

      const fileInput = page.locator('input[type="file"]').first();

      if ((await fileInput.count()) === 0) {
        throw new Error('Could not find Instagram file input');
      }

      await fileInput.setInputFiles(imagePath);

      logger.success('✅ Image uploaded successfully');

      await page.waitForTimeout(5000);

      // Delete temporary image after upload
      if (imagePath.startsWith(path.join(config.dataDir, 'temp'))) {
        try {
          fs.unlinkSync(imagePath);
          logger.info('🗑️ Temporary image removed');
        } catch (error) {
          logger.warn('⚠️ Could not remove temporary image');
        }
      }

      // ============================================================
      // STEP 3: POST-UPLOAD POPUPS
      // ============================================================

      logger.info('🔍 STEP 3: Checking post-upload popups...');

      await page.waitForTimeout(2000);

      const storyPopup = page.locator('button:has-text("Add to your story")');

      if ((await storyPopup.count()) > 0) {
        if (await storyPopup.first().isVisible().catch(() => false)) {
          logger.info('📱 Story popup detected');

          const notNowSelectors = [
            'button:has-text("Not Now")',
            'div[role="button"]:has-text("Not Now")'
          ];

          let dismissed = false;

          for (const selector of notNowSelectors) {
            try {
              const notNow = page.locator(selector).first();

              if ((await notNow.count()) > 0 &&
                  (await notNow.isVisible().catch(() => false))) {
                await notNow.click();
                dismissed = true;
                logger.success('✅ Story popup dismissed');
                await page.waitForTimeout(1500);
                break;
              }
            } catch (error) {}
          }

          if (!dismissed) {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(1000);
          }
        }
      }

      // ============================================================
      // STEP 4: CROP SCREEN
      // ============================================================

      logger.info('✂️ STEP 4: Handling crop screen...');

      await page.waitForTimeout(2500);

      const nextSelectors = [
        'button:has-text("Next")',
        'div[role="button"]:has-text("Next")'
      ];

      const cropNextClicked = await this.clickVisibleButton(
        page,
        nextSelectors,
        'Next after crop'
      );

      if (cropNextClicked) {
        await page.waitForTimeout(3000);
      } else {
        logger.info('ℹ️ Crop Next button not found; continuing...');
      }

      // ============================================================
      // STEP 5: FILTER SCREEN
      // ============================================================

      logger.info('🎨 STEP 5: Handling filter screen...');

      await page.waitForTimeout(2000);

      const filterNextClicked = await this.clickVisibleButton(
        page,
        nextSelectors,
        'Next on filter screen'
      );

      if (filterNextClicked) {
        await page.waitForTimeout(3000);
      } else {
        logger.info('ℹ️ Filter Next button not found; continuing...');
      }

      // ============================================================
      // STEP 6: CAPTION
      // ============================================================

      logger.info('📝 STEP 6: Entering caption...');

      await page.waitForTimeout(2500);

      const caption = this.generateCaption(postData);

      const captionSelectors = [
        'textarea[aria-label="Write a caption..."]',
        'textarea[aria-label="Add a caption..."]',
        'textarea[placeholder*="caption" i]',
        'textarea[data-testid="caption-input"]',
        'div[role="textbox"][aria-label*="caption" i]',
        'div[role="textbox"][contenteditable="true"]'
      ];

      let captionEntered = false;

      for (const selector of captionSelectors) {
        try {
          const fields = page.locator(selector);
          const count = await fields.count();

          if (count === 0) continue;

          for (let i = 0; i < count; i++) {
            const field = fields.nth(i);

            if (!(await field.isVisible().catch(() => false))) continue;

            await field.scrollIntoViewIfNeeded().catch(() => {});
            await field.click();

            await page.waitForTimeout(400);

            try {
              await field.fill('');
              await field.fill(caption);
            } catch (fillError) {
              await page.keyboard.press('Control+A');
              await page.keyboard.type(caption, { delay: 1 });
            }

            captionEntered = true;
            logger.success(`✅ Caption entered using: ${selector}`);
            break;
          }

          if (captionEntered) break;
        } catch (error) {
          logger.warn(`⚠️ Caption selector failed: ${selector} - ${error.message}`);
        }
      }

      if (!captionEntered) {
        throw new Error('Could not find caption field');
      }

      await page.waitForTimeout(1500);

      // ============================================================
      // STEP 7: SHARE - WITH MULTIPLE METHODS
      // ============================================================

      logger.info('📤 STEP 7: Sharing post...');

      const beforeShareScreenshot = path.join(
        config.dataDir,
        `before-share-${Date.now()}.png`
      );

      await page.screenshot({ path: beforeShareScreenshot });
      logger.info(`📸 Before-share screenshot: ${beforeShareScreenshot}`);

      await page.waitForTimeout(2500);

      // ============================================================
      // FIND ACTIVE CREATE POST COMPOSER
      // ============================================================

      logger.info('🔍 Locating active Create Post composer...');

      const composer = await this.findCreatePostComposer(page);

      if (!composer) {
        throw new Error('Active Create Post composer was not found');
      }

      logger.success('✅ Active Create Post composer found');

      // ============================================================
      // FIND AND CLICK SHARE BUTTON INSIDE COMPOSER
      // ============================================================

      logger.info('🔍 Looking for Share button inside composer...');

      const shareSelectors = [
        'button:has-text("Share")',
        'button[aria-label="Share"]',
        'div[role="button"]:has-text("Share")',
        'div[role="button"][aria-label="Share"]'
      ];

      let shareButton = null;
      let usedSelector = null;

      for (const selector of shareSelectors) {
        try {
          const candidates = composer.locator(selector);
          const count = await candidates.count();

          if (count === 0) continue;

          for (let i = 0; i < count; i++) {
            const candidate = candidates.nth(i);

            if (!(await candidate.isVisible().catch(() => false))) continue;

            shareButton = candidate;
            usedSelector = selector;
            break;
          }

          if (shareButton) break;
        } catch (error) {}
      }

      if (!shareButton) {
        throw new Error('Share button was not found inside the active Create Post composer');
      }

      logger.info(`🔘 Composer Share found using: ${usedSelector}`);

      // ============================================================
      // WAIT UNTIL SHARE BUTTON IS ENABLED
      // ============================================================

      logger.info('⏳ Waiting for Share button to become enabled...');

      try {
        await page.waitForFunction(
          (element) => {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const visible = style.display !== 'none' &&
                           style.visibility !== 'hidden' &&
                           rect.width > 0 &&
                           rect.height > 0;
            const disabled = element.disabled ||
                             element.getAttribute('aria-disabled') === 'true';
            return visible && !disabled;
          },
          await shareButton.elementHandle(),
          { timeout: 15000 }
        );
        logger.success('✅ Share button is enabled');
      } catch (error) {
        logger.warn('⚠️ Share enabled-state wait timed out, trying anyway...');
      }

      // ============================================================
      // CLICK SHARE BUTTON - MULTIPLE METHODS
      // ============================================================

      let shareClicked = false;
      let clickMethod = 'none';

      // Method 1: Normal click with hover
      try {
        await shareButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await shareButton.hover();
        await page.waitForTimeout(500);
        await shareButton.click({ force: false, noWaitAfter: true });
        shareClicked = true;
        clickMethod = 'Playwright normal click';
        logger.success('✅ Share button clicked (normal)');
      } catch (error1) {
        logger.warn(`⚠️ Normal click failed: ${error1.message}`);

        // Method 2: Force click
        try {
          await shareButton.click({ force: true, noWaitAfter: true });
          shareClicked = true;
          clickMethod = 'Playwright force click';
          logger.success('✅ Share button clicked (force)');
        } catch (error2) {
          logger.warn(`⚠️ Force click failed: ${error2.message}`);

          // Method 3: JavaScript click
          try {
            await shareButton.evaluate(el => el.click());
            shareClicked = true;
            clickMethod = 'JavaScript click';
            logger.success('✅ Share button clicked (JavaScript)');
          } catch (error3) {
            logger.warn(`⚠️ JavaScript click failed: ${error3.message}`);

            // Method 4: Mouse click at center
            try {
              const box = await shareButton.boundingBox();
              if (box) {
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                shareClicked = true;
                clickMethod = 'Mouse click';
                logger.success('✅ Share button clicked (mouse)');
              }
            } catch (error4) {
              logger.warn(`⚠️ Mouse click failed: ${error4.message}`);
            }
          }
        }
      }

      // Method 5: Tab + Enter
      if (!shareClicked) {
        try {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);
          await page.keyboard.press('Enter');
          shareClicked = true;
          clickMethod = 'Tab + Enter';
          logger.success('✅ Shared using Tab + Enter');
        } catch (error5) {
          logger.warn(`⚠️ Tab + Enter failed: ${error5.message}`);
        }
      }

      // Method 6: Ctrl+Enter
      if (!shareClicked) {
        try {
          await page.keyboard.press('Control+Enter');
          shareClicked = true;
          clickMethod = 'Ctrl+Enter';
          logger.success('✅ Shared using Ctrl+Enter');
        } catch (error6) {
          logger.warn(`⚠️ Ctrl+Enter failed: ${error6.message}`);
        }
      }

      if (!shareClicked) {
        throw new Error('All share methods failed');
      }

      logger.success(`✅ Share button clicked using: ${clickMethod}`);

      // ============================================================
      // STEP 8: VERIFY PUBLICATION
      // ============================================================

      logger.info('🔍 STEP 8: Verifying publication...');

      const publicationResult = await this.verifyPublication(page);

      if (publicationResult.success) {
        logger.success('✅✅✅ Instagram post successfully published! ✅✅✅');

        await this.browser.saveSession();
        await this.browser.close();

        return {
          success: true,
          status: 'published',
          message: 'Instagram post published successfully',
          instagramId: publicationResult.instagramId || null,
          clickMethod: clickMethod
        };
      }

      throw new Error(publicationResult.message || 'Post was not published successfully');

    } catch (error) {
      logger.error('❌ Instagram publishing failed:', error.message);

      try {
        const page = await this.browser.getPage();
        if (page) {
          const screenshotPath = path.join(config.dataDir, `error-${Date.now()}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          logger.info(`📸 Error screenshot saved: ${screenshotPath}`);
        }
      } catch (screenshotError) {}

      await this.browser.close();

      return {
        success: false,
        status: 'failed',
        message: error.message || 'Failed to publish to Instagram'
      };
    }
  }

  // ================================================================
  // FIND ACTIVE CREATE POST COMPOSER
  // ================================================================

  async findCreatePostComposer(page) {
    logger.info('🔍 Locating active Create Post composer...');

    const dialogs = page.locator('[role="dialog"]');
    const dialogCount = await dialogs.count();

    logger.info(`📦 Visible dialog candidates: ${dialogCount}`);

    for (let i = 0; i < dialogCount; i++) {
      try {
        const dialog = dialogs.nth(i);

        if (!(await dialog.isVisible().catch(() => false))) continue;

        // Check for caption field
        const captionField = dialog.locator(
          [
            'textarea[aria-label*="caption" i]',
            'textarea[placeholder*="caption" i]',
            'div[role="textbox"][aria-label*="caption" i]',
            'div[role="textbox"][contenteditable="true"]'
          ].join(',')
        );

        // Check for file input
        const fileInput = dialog.locator('input[type="file"]');

        // Check for share button
        const shareCandidates = dialog.locator(
          [
            'button:has-text("Share")',
            'button[aria-label="Share"]',
            'div[role="button"]:has-text("Share")',
            'div[role="button"][aria-label="Share"]'
          ].join(',')
        );

        const hasCaption = (await captionField.count()) > 0;
        const hasFileInput = (await fileInput.count()) > 0;
        const hasShare = (await shareCandidates.count()) > 0;

        logger.info(`📦 Dialog ${i}: caption=${hasCaption}, fileInput=${hasFileInput}, share=${hasShare}`);

        if (hasCaption || hasFileInput || hasShare) {
          logger.success(`✅ Active Create Post composer found: dialog ${i}`);
          return dialog;
        }
      } catch (error) {}
    }

    // Fallback: Find by caption field
    try {
      const captionFields = page.locator(
        [
          'textarea[aria-label*="caption" i]',
          'textarea[placeholder*="caption" i]',
          'div[role="textbox"][aria-label*="caption" i]'
        ].join(',')
      );

      const count = await captionFields.count();

      for (let i = 0; i < count; i++) {
        const field = captionFields.nth(i);

        if (!(await field.isVisible().catch(() => false))) continue;

        const composer = field.locator('xpath=ancestor::*[@role="dialog"][1]');

        if ((await composer.count()) > 0 &&
            (await composer.first().isVisible().catch(() => false))) {
          logger.success('✅ Active Create Post composer found through caption field');
          return composer.first();
        }
      }
    } catch (error) {}

    return null;
  }

  // ================================================================
  // CLICK VISIBLE BUTTON HELPER
  // ================================================================

  async clickVisibleButton(page, selectors, description) {
    for (const selector of selectors) {
      try {
        const elements = page.locator(selector);
        const count = await elements.count();

        for (let i = 0; i < count; i++) {
          const button = elements.nth(i);

          if (!(await button.isVisible().catch(() => false))) continue;

          try {
            const disabled = await button.isDisabled().catch(() => false);
            const ariaDisabled = await button.getAttribute('aria-disabled').catch(() => null);

            if (disabled || ariaDisabled === 'true') continue;
          } catch (error) {}

          await button.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(300);
          await button.click();

          logger.success(`✅ ${description} clicked`);
          return true;
        }
      } catch (error) {
        logger.warn(`⚠️ ${description} selector failed: ${selector}`);
      }
    }

    return false;
  }

  // ================================================================
  // VERIFY PUBLICATION
  // ================================================================

  async verifyPublication(page) {
    logger.info('🔍 Verifying actual Instagram publication...');

    const startTime = Date.now();
    const timeout = 20000;

    while (Date.now() - startTime < timeout) {
      try {
        // Check URL for /p/
        const currentUrl = page.url();

        if (currentUrl.includes('/p/')) {
          const instagramId = currentUrl.split('/p/')[1]?.split('/')[0] || null;
          logger.success(`✅ Instagram post URL detected: ${currentUrl}`);
          return { success: true, instagramId, message: 'Published post URL detected' };
        }

        // Check for success messages
        const successTexts = [
          'Your post has been shared',
          'Your post was shared',
          'Post shared',
          'Post has been shared',
          'Your post is now live'
        ];

        const bodyText = (await page.locator('body').innerText().catch(() => '')).toLowerCase();

        for (const text of successTexts) {
          if (bodyText.includes(text.toLowerCase())) {
            logger.success(`✅ Explicit Instagram publication confirmation found: "${text}"`);
            return { success: true, instagramId: null, message: text };
          }
        }

        // Check for error messages
        const errorMessage = await this.getErrorMessage(page);

        if (errorMessage && errorMessage !== 'Unknown error') {
          logger.error(`❌ Instagram reported an error: ${errorMessage}`);
          return { success: false, instagramId: null, message: errorMessage };
        }
      } catch (error) {
        logger.warn(`⚠️ Publication verification iteration failed: ${error.message}`);
      }

      await page.waitForTimeout(1000);
    }

    return {
      success: false,
      instagramId: null,
      message: 'Instagram did not provide explicit confirmation that the post was published'
    };
  }

  // ================================================================
  // IMAGE PREPARATION
  // ================================================================

  async prepareImage(postData) {
    if (postData.evidence && Array.isArray(postData.evidence) && postData.evidence.length > 0) {
      const imageUrl = postData.evidence[0];

      if (typeof imageUrl !== 'string' || !imageUrl) return null;

      // HTTP/HTTPS
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        try {
          logger.info(`📥 Downloading image from: ${imageUrl}`);
          const response = await fetch(imageUrl);

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = response.headers.get('content-type') || '';
          let extension = 'jpg';

          if (contentType.includes('png')) extension = 'png';
          else if (contentType.includes('webp')) extension = 'webp';
          else if (contentType.includes('gif')) extension = 'gif';

          const tempPath = path.join(config.dataDir, `temp-${Date.now()}.${extension}`);
          fs.writeFileSync(tempPath, buffer);
          logger.success(`✅ Image downloaded: ${tempPath}`);
          return tempPath;
        } catch (error) {
          logger.warn(`⚠️ Failed to download image: ${error.message}`);
          return null;
        }
      }

      // Base64
      if (imageUrl.startsWith('data:image')) {
        try {
          const matches = imageUrl.match(/^data:image\/([\w.+-]+);base64,(.+)$/);
          if (!matches) return null;

          const format = matches[1].toLowerCase();
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          let extension = format;
          if (format === 'jpeg') extension = 'jpg';

          const tempPath = path.join(config.dataDir, `temp-${Date.now()}.${extension}`);
          fs.writeFileSync(tempPath, buffer);
          logger.success(`✅ Base64 image saved: ${tempPath}`);
          return tempPath;
        } catch (error) {
          logger.warn(`⚠️ Failed to process base64 image: ${error.message}`);
          return null;
        }
      }

      // Local file
      try {
        if (fs.existsSync(imageUrl)) {
          logger.info(`📁 Using local image: ${imageUrl}`);
          return imageUrl;
        }
      } catch (error) {}

      // URL-encoded path
      try {
        const decodedPath = decodeURIComponent(imageUrl);
        if (fs.existsSync(decodedPath)) return decodedPath;
      } catch (error) {}
    }

    return null;
  }

  // ================================================================
  // CAPTION
  // ================================================================

  generateCaption(postData) {
    const title = postData.title || 'Untitled';
    const description = postData.description || '';
    const category = postData.category || 'News';
    const location = postData.location || 'Unknown';

    let summary = description;
    if (summary.length > 200) {
      summary = summary.substring(0, 200) + '...';
    }

    const cleanCategory = String(category).replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '');

    return `📰 ${title}

${summary}

📍 Location: ${location}
📂 Category: ${category}

#PeoplesPress #CitizenJournalism #${cleanCategory} #LocalNews`;
  }

  // ================================================================
  // ERROR MESSAGE
  // ================================================================

  async getErrorMessage(page) {
    try {
      const errorSelectors = [
        '[role="alert"]',
        '.error',
        '.alert',
        'div:has-text("Sorry")',
        'div:has-text("Try again")',
        'div:has-text("Something went wrong")',
        'div:has-text("Couldn\'t share")',
        'div:has-text("Could not share")',
        'div:has-text("Your post could not be shared")'
      ];

      for (const selector of errorSelectors) {
        try {
          const elements = page.locator(selector);
          const count = await elements.count();

          for (let i = 0; i < count; i++) {
            const element = elements.nth(i);

            if (!(await element.isVisible().catch(() => false))) continue;

            const text = await element.innerText().catch(() => '');

            if (text && text.trim().length > 5) {
              const cleaned = text.trim();
              if (cleaned.length < 1000) return cleaned;
            }
          }
        } catch (error) {}
      }

      return 'Unknown error';
    } catch (error) {
      return 'Unknown error';
    }
  }
}

module.exports = InstagramPublisher;