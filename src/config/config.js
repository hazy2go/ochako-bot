/**
 * Configuration Module
 *
 * Loads and validates all environment variables for the Discord bot.
 * Provides a clean, typed configuration object with organized sections.
 *
 * @module config
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Validates that required environment variables are present
 * @param {string[]} requiredVars - Array of required variable names
 * @throws {Error} If any required variables are missing
 */
function validateRequiredVars(requiredVars) {
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required values are set.'
    );
  }
}

/**
 * Validates that a value is a valid Discord snowflake ID (numeric string)
 * @param {string} value - The value to validate
 * @param {string} name - The name of the variable (for error messages)
 * @returns {string} The validated value
 */
function validateId(value, name) {
  if (value && !/^\d+$/.test(value)) {
    throw new Error(`${name} must be a valid Discord ID (numeric string)`);
  }
  return value;
}

// Define required environment variables
const REQUIRED_VARS = [
  'DISCORD_TOKEN',
  'GUILD_ID'
];

// Validate required variables exist
validateRequiredVars(REQUIRED_VARS);

/**
 * Application Configuration
 *
 * Organized configuration object with all bot settings.
 * All Discord IDs are validated to ensure they are numeric strings.
 */
const config = {
  // ============================================================================
  // AUTHENTICATION
  // ============================================================================
  auth: {
    /** Discord bot token */
    discordToken: process.env.DISCORD_TOKEN,

    /** OpenAI API key for AI features */
    openaiApiKey: process.env.OPENAI_API_KEY || null
  },

  // ============================================================================
  // SERVER CONFIGURATION
  // ============================================================================
  server: {
    /** Discord guild (server) ID */
    guildId: validateId(process.env.GUILD_ID, 'GUILD_ID')
  },

  // ============================================================================
  // CHANNEL IDs
  // ============================================================================
  channels: {
    /** Channel where users post tweet links for raid coordination */
    tweet: validateId(process.env.TWEET_CHANNEL_ID, 'TWEET_CHANNEL_ID') || null,

    /** Forum channel for creating raid threads */
    forum: validateId(process.env.FORUM_CHANNEL_ID, 'FORUM_CHANNEL_ID') || null,

    /** Staff approval channel */
    staff: validateId(process.env.STAFF_CHANNEL_ID, 'STAFF_CHANNEL_ID') || null,

    /** Mochi shop channel */
    mochiShop: validateId(process.env.MOCHI_SHOP_CHANNEL, 'MOCHI_SHOP_CHANNEL') || null,

    /** Equipment shop channel */
    equipmentShop: validateId(process.env.EQUIPMENT_SHOP_CHANNEL, 'EQUIPMENT_SHOP_CHANNEL') || null,

    /** Waterlily shop channel */
    waterlilyShop: validateId(process.env.WATERLILY_SHOP_CHANNEL, 'WATERLILY_SHOP_CHANNEL') || null,

    /** General notification channel */
    notification: validateId(process.env.NOTIFICATION_CHANNEL, 'NOTIFICATION_CHANNEL') || null,

    /** Daily rewards channel */
    dailyRewards: validateId(process.env.DAILY_REWARDS_CHANNEL, 'DAILY_REWARDS_CHANNEL') || null,

    /** Tea-related activities channel */
    tea: validateId(process.env.TEA_CHANNEL_ID, 'TEA_CHANNEL_ID') || null,

    /** Channel for forwarding bot DMs */
    dmForward: validateId(process.env.DM_FORWARD_CHANNEL_ID, 'DM_FORWARD_CHANNEL_ID') || null
  },

  // ============================================================================
  // ROLE IDs
  // ============================================================================
  roles: {
    /** Tea ceremony role */
    tea: validateId(process.env.TEA_ROLE_ID, 'TEA_ROLE_ID') || null,

    /** Administrator role */
    admin: validateId(process.env.ADMIN_ROLE_ID, 'ADMIN_ROLE_ID') || null
  },

  // ============================================================================
  // AUTHORIZED USERS
  // ============================================================================
  users: {
    /** User ID authorized to send DMs to the bot */
    authorizedDm: validateId(process.env.AUTHORIZED_DM_USER_ID, 'AUTHORIZED_DM_USER_ID') || null
  },

  // ============================================================================
  // BOT SETTINGS
  // ============================================================================
  bot: {
    /** Command prefix for legacy text commands */
    prefix: process.env.PREFIX || '!',

    /** Timezone for cron jobs and scheduled tasks */
    timezone: process.env.TIMEZONE || 'America/New_York',

    /** Environment mode (development, production) */
    environment: process.env.NODE_ENV || 'development',

    /** Enable debug logging */
    debug: process.env.DEBUG === 'true'
  },

  // ============================================================================
  // PATHS
  // ============================================================================
  paths: {
    /** Root directory of the project */
    root: path.join(__dirname, '../..'),

    /** Main database path */
    mainDb: path.join(__dirname, '../../databases/main_database.db'),

    /** AI conversation database path */
    aiDb: path.join(__dirname, '../../databases/ai_conversations.db'),

    /** Fonts directory */
    fonts: path.join(__dirname, '../../fonts')
  }
};

// Validate that at least the Discord token is present (OpenAI is optional)
if (!config.auth.discordToken) {
  throw new Error('DISCORD_TOKEN is required but not set in environment variables');
}

/**
 * Check if a specific feature is enabled based on required configuration
 * @param {string} feature - Feature name ('ai', 'raids', 'shops', etc.)
 * @returns {boolean} Whether the feature is properly configured
 */
config.isFeatureEnabled = function(feature) {
  switch (feature) {
    case 'ai':
      return !!this.auth.openaiApiKey;
    case 'raids':
      return !!(this.channels.tweet && this.channels.forum);
    case 'shops':
      return !!(this.channels.mochiShop || this.channels.equipmentShop || this.channels.waterlilyShop);
    case 'tea':
      return !!(this.channels.tea && this.roles.tea);
    case 'dmForwarding':
      return !!(this.channels.dmForward && this.users.authorizedDm);
    default:
      return false;
  }
};

module.exports = config;
