// middleware/languageMiddleware.js

const SUPPORTED_LANGUAGES = ['en', 'hi', 'as', 'bn'];
const DEFAULT_LANGUAGE = 'en';

/**
 * Language Middleware - Detects and sets the user's preferred language
 * Priority: Query param > Header > Default
 */
function languageMiddleware(req, res, next) {
  let language = DEFAULT_LANGUAGE;

  // 1. Check query parameter: ?lang=hi
  if (req.query.lang) {
    const queryLang = req.query.lang.toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(queryLang)) {
      language = queryLang;
    }
  }

  // 2. Check Accept-Language header
  if (!language || language === DEFAULT_LANGUAGE) {
    const acceptLang = req.headers['accept-language'];
    if (acceptLang) {
      // Parse Accept-Language header: "en-US,en;q=0.9,hi;q=0.8"
      const langs = acceptLang.split(',')
        .map(l => {
          const parts = l.trim().split(';');
          const code = parts[0].split('-')[0].toLowerCase();
          const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1;
          return { code, quality };
        })
        .sort((a, b) => b.quality - a.quality);

      for (const lang of langs) {
        if (SUPPORTED_LANGUAGES.includes(lang.code)) {
          language = lang.code;
          break;
        }
      }
    }
  }

  // Set language on request object
  req.language = language;
  res.setHeader('Content-Language', language);

  // Also set as a header for the frontend to use
  res.setHeader('X-Content-Language', language);

  next();
}

module.exports = languageMiddleware;