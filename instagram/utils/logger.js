// instagram/utils/logger.js
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '../data/logs');
    this.ensureLogsDir();
  }

  ensureLogsDir() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  log(message, data = null) {
    const timestamp = this.getTimestamp();
    console.log(`[${timestamp}] 📝 ${message}`);
    if (data) {
      console.log('  ↳', data);
    }
  }

  info(message, data = null) {
    this.log(`ℹ️ ${message}`, data);
  }

  success(message, data = null) {
    this.log(`✅ ${message}`, data);
  }

  error(message, data = null) {
    this.log(`❌ ${message}`, data);
  }

  warn(message, data = null) {
    this.log(`⚠️ ${message}`, data);
  }
}

module.exports = new Logger();