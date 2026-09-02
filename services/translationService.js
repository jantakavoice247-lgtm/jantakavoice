// services/translationService.js
const axios = require('axios');

/**
 * Translation Service - Abstract provider pattern
 * Supports multiple translation providers via environment configuration
 */
class TranslationService {
  constructor() {
    this.provider = process.env.TRANSLATION_PROVIDER || 'openai';
    this.apiKey = process.env.TRANSLATION_API_KEY;
    this.apiUrl = process.env.TRANSLATION_API_URL || 'https://api.openai.com/v1/chat/completions';
    this.enabled = !!this.apiKey;
    
    console.log(`📝 Translation service initialized with provider: ${this.provider}`);
    console.log(`🔑 API Key set: ${this.enabled ? '✅ Yes' : '❌ No'}`);
    
    // Language mapping for prompts
    this.languageNames = {
      'en': 'English',
      'hi': 'Hindi',
      'as': 'Assamese',
      'bn': 'Bengali'
    };
  }

  /**
   * Translate text to a target language
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language code (en, hi, as, bn)
   * @param {string} targetLang - Target language code (en, hi, as, bn)
   * @returns {Promise<string>} - Translated text
   */
  async translate(text, sourceLang, targetLang) {
    // If no text or already in target language, return original
    if (!text || !text.trim()) return text;
    if (sourceLang === targetLang) return text;
    
    // If translation service is not enabled, return original
    if (!this.enabled) {
      console.warn('⚠️ Translation API not configured. Returning original text.');
      return text;
    }

    try {
      const result = await this._translateWithProvider(text, sourceLang, targetLang);
      return result || text;
    } catch (error) {
      console.error(`❌ Translation error (${sourceLang}→${targetLang}):`, error.message);
      return text; // Fallback to original
    }
  }

  /**
   * Translate multiple texts at once
   * @param {Object} texts - Object with fields to translate
   * @param {string} sourceLang - Source language
   * @param {string} targetLang - Target language
   * @returns {Promise<Object>} - Translated texts
   */
  async translateBatch(texts, sourceLang, targetLang) {
    if (!texts || typeof texts !== 'object') return texts;
    if (sourceLang === targetLang) return texts;

    const result = {};
    for (const [key, value] of Object.entries(texts)) {
      if (typeof value === 'string' && value.trim()) {
        result[key] = await this.translate(value, sourceLang, targetLang);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Detect language of text
   * @param {string} text - Text to detect
   * @returns {string} - Language code (en, hi, as, bn)
   */
  detectLanguage(text) {
    if (!text || !text.trim()) return 'en';

    // Check for Devanagari script (Hindi)
    if (/[\u0900-\u097F]/.test(text)) {
      return 'hi';
    }
    
    // Check for Bengali script
    if (/[\u0980-\u09FF]/.test(text)) {
      return 'bn';
    }
    
    // Check for Assamese script (Bengali script range with specific chars)
    if (/[\u0980-\u09FF]/.test(text)) {
      // Additional Assamese specific check
      const assameseChars = /[\u09F0-\u09F1]/.test(text);
      if (assameseChars) {
        return 'as';
      }
      // Bengali and Assamese share script, so use detection
      // Default to Bengali for now
      return 'bn';
    }
    
    // Default to English
    return 'en';
  }

  /**
   * Translate using configured provider
   * @private
   */
  async _translateWithProvider(text, sourceLang, targetLang) {
    switch (this.provider) {
      case 'openai':
        return await this._translateOpenAI(text, sourceLang, targetLang);
      case 'google':
        return await this._translateGoogle(text, sourceLang, targetLang);
      default:
        return text;
    }
  }

  /**
   * OpenAI Translation (GPT)
   * @private
   */
  async _translateOpenAI(text, sourceLang, targetLang) {
    const sourceName = this.languageNames[sourceLang] || sourceLang;
    const targetName = this.languageNames[targetLang] || targetLang;

    const response = await axios.post(
      this.apiUrl,
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text from ${sourceName} to ${targetName}. 
                      Only return the translation, no additional text, no explanations, no quotes.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: Math.min(text.length * 2 + 100, 500),
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    let translated = response.data.choices[0].message.content.trim();
    
    // Remove any quotes if present
    translated = translated.replace(/^["']|["']$/g, '');
    
    return translated;
  }

  /**
   * Google Translate API (placeholder)
   * @private
   */
  async _translateGoogle(text, sourceLang, targetLang) {
    // Google Translate API v2
    const url = `https://translation.googleapis.com/language/translate/v2`;
    const response = await axios.post(
      url,
      {
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text',
      },
      {
        params: {
          key: this.apiKey,
        },
        timeout: 30000,
      }
    );

    return response.data.data.translations[0].translatedText;
  }
}

// Export singleton instance
module.exports = new TranslationService();