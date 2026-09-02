// instagram/config/config.js
const path = require('path');

module.exports = {
  // Session
  sessionDir: path.join(__dirname, '../data/session'),
  
  // Browser
  headless: false, // Keep false for debugging
  timeout: 30000,
  
  // URLs
  instagramUrl: 'https://www.instagram.com',
  instagramAccountUrl: 'https://www.instagram.com/jantakavoice247/', // YOUR ACCOUNT URL
  
  // Paths
  dataDir: path.join(__dirname, '../data'),
};