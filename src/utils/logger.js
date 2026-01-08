/**
 * Logger Utility
 *
 * Simple console logger with timestamps, log levels, and color coding.
 * Provides consistent logging format across the application.
 *
 * @module logger
 */

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

/**
 * Log level configurations
 * Each level has a label, color, and emoji for visual distinction
 */
const levels = {
  log: {
    label: 'LOG',
    color: colors.white,
    emoji: '📝'
  },
  info: {
    label: 'INFO',
    color: colors.cyan,
    emoji: 'ℹ️'
  },
  success: {
    label: 'SUCCESS',
    color: colors.green,
    emoji: '✓'
  },
  warn: {
    label: 'WARN',
    color: colors.yellow,
    emoji: '⚠️'
  },
  error: {
    label: 'ERROR',
    color: colors.red,
    emoji: '✗'
  },
  debug: {
    label: 'DEBUG',
    color: colors.magenta,
    emoji: '🔍'
  }
};

/**
 * Formats a timestamp in a human-readable format
 * @returns {string} Formatted timestamp string
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Core logging function
 * @param {string} level - Log level (log, info, success, warn, error, debug)
 * @param {...any} args - Arguments to log
 */
function writeLog(level, ...args) {
  const config = levels[level] || levels.log;
  const timestamp = getTimestamp();

  // Build the log prefix with color
  const prefix = `${colors.dim}[${timestamp}]${colors.reset} ${config.color}${config.emoji} ${config.label}${colors.reset}`;

  // Log to console with appropriate method
  const logMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logMethod(prefix, ...args);
}

/**
 * Logger object with methods for different log levels
 */
const logger = {
  /**
   * General log message
   * @param {...any} args - Content to log
   */
  log(...args) {
    writeLog('log', ...args);
  },

  /**
   * Informational message (cyan)
   * @param {...any} args - Content to log
   */
  info(...args) {
    writeLog('info', ...args);
  },

  /**
   * Success message (green)
   * @param {...any} args - Content to log
   */
  success(...args) {
    writeLog('success', ...args);
  },

  /**
   * Warning message (yellow)
   * @param {...any} args - Content to log
   */
  warn(...args) {
    writeLog('warn', ...args);
  },

  /**
   * Error message (red)
   * @param {...any} args - Content to log
   */
  error(...args) {
    writeLog('error', ...args);
  },

  /**
   * Debug message (magenta)
   * Only logs if DEBUG environment variable is set
   * @param {...any} args - Content to log
   */
  debug(...args) {
    if (process.env.DEBUG === 'true') {
      writeLog('debug', ...args);
    }
  },

  /**
   * Logs a divider line for visual separation
   * @param {string} title - Optional title for the divider
   */
  divider(title = '') {
    const line = '═'.repeat(60);
    if (title) {
      const padding = Math.max(0, Math.floor((60 - title.length - 2) / 2));
      const divider = '═'.repeat(padding) + ` ${title} ` + '═'.repeat(padding);
      console.log(`${colors.dim}${divider}${colors.reset}`);
    } else {
      console.log(`${colors.dim}${line}${colors.reset}`);
    }
  },

  /**
   * Logs a section header
   * @param {string} title - Section title
   */
  section(title) {
    console.log();
    this.divider(title);
  },

  /**
   * Logs a blank line for spacing
   */
  space() {
    console.log();
  },

  /**
   * Access to color codes for custom formatting
   */
  colors
};

module.exports = logger;
