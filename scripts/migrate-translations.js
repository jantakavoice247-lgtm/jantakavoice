// scripts/migrate-translations.js
// Run with: node scripts/migrate-translations.js

require('dotenv').config();
const mongoose = require('mongoose');
const translationService = require('../services/translationService');
const Post = require('../models/Post');

const BATCH_SIZE = 50;
const SUPPORTED_LANGUAGES = ['en', 'hi', 'as', 'bn'];

async function migrateExistingPosts() {
  console.log('🚀 Starting translation migration...');
  
  let connection;
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    connection = await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get total count
    const totalPosts = await Post.countDocuments();
    console.log(`📊 Found ${totalPosts} total posts`);

    // Skip posts that already have translations
    const alreadyTranslated = await Post.countDocuments({
      'translations.title.en': { $ne: '' },
      translationStatus: 'completed'
    });
    console.log(`📊 ${alreadyTranslated} posts already have translations`);

    // Posts to process
    const postsToProcess = await Post.find({
      $or: [
        { translationStatus: { $ne: 'completed' } },
        { 'translations.title.en': { $eq: '' } }
      ]
    }).limit(BATCH_SIZE);

    console.log(`📦 ${postsToProcess.length} posts to process`);

    if (postsToProcess.length === 0) {
      console.log('✅ All posts already have translations!');
      await mongoose.disconnect();
      return;
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const post of postsToProcess) {
      try {
        console.log(`\n🔄 Processing post ${post._id}: "${post.title?.substring(0, 30)}..."`);

        // Skip if already translated
        if (post.translations?.title?.en && post.translationStatus === 'completed') {
          console.log('⏭️ Post already translated, skipping');
          skipped++;
          continue;
        }

        // Detect original language
        const originalLang = translationService.detectLanguage(
          (post.title || '') + ' ' + (post.description || '')
        );
        
        console.log(`🌐 Detected language: ${originalLang}`);

        // Prepare translations
        const titleTranslations = {};
        const descTranslations = {};

        // Set source language
        titleTranslations[originalLang] = post.title || '';
        descTranslations[originalLang] = post.description || '';

        // Translate to other languages
        const otherLanguages = SUPPORTED_LANGUAGES.filter(l => l !== originalLang);
        
        for (const targetLang of otherLanguages) {
          try {
            console.log(`   Translating to ${targetLang}...`);
            
            if (post.title && post.title.trim()) {
              titleTranslations[targetLang] = await translationService.translate(
                post.title,
                originalLang,
                targetLang
              );
            } else {
              titleTranslations[targetLang] = '';
            }

            if (post.description && post.description.trim()) {
              descTranslations[targetLang] = await translationService.translate(
                post.description,
                originalLang,
                targetLang
              );
            } else {
              descTranslations[targetLang] = '';
            }

            console.log(`   ✅ Translated to ${targetLang}`);

          } catch (error) {
            console.error(`   ❌ Failed to translate to ${targetLang}:`, error.message);
            // Use original text as fallback
            titleTranslations[targetLang] = post.title || '';
            descTranslations[targetLang] = post.description || '';
          }
        }

        // Update post
        post.originalLanguage = originalLang;
        post.translations = {
          title: titleTranslations,
          description: descTranslations,
        };
        post.translationStatus = 'completed';
        post.updatedAt = new Date();

        await post.save();
        processed++;
        console.log(`✅ Post ${post._id} migration complete`);

      } catch (error) {
        console.error(`❌ Failed to migrate post ${post._id}:`, error.message);
        failed++;
        
        // Mark as failed if we couldn't process it
        try {
          await Post.findByIdAndUpdate(post._id, {
            translationStatus: 'failed',
            updatedAt: new Date()
          });
        } catch (updateError) {
          console.error(`  Could not update post ${post._id}:`, updateError.message);
        }
      }
    }

    // Summary
    console.log('\n📊 Migration Summary');
    console.log('═══════════════════════');
    console.log(`✅ Processed: ${processed}`);
    console.log(`⏭️ Skipped:   ${skipped}`);
    console.log(`❌ Failed:    ${failed}`);
    console.log(`📊 Total:     ${processed + skipped + failed}`);

    if (failed > 0) {
      console.log(`\n⚠️ ${failed} posts failed. Run the script again to retry.`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('👋 Disconnected from MongoDB');
    }
  }
}

// Run migration
migrateExistingPosts();