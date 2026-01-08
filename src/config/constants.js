/**
 * Constants Module
 *
 * Contains all constant values used throughout the Discord bot.
 * Includes gift preferences, equipment slots, item data, and other static values.
 *
 * @module constants
 */

// ============================================================================
// GIFT PREFERENCES
// ============================================================================

/**
 * Gift preferences data
 * Maps gift items to their effects on character relationships
 *
 * Structure:
 * - name: Display name of the gift
 * - cost: Cost in mochi
 * - loved: Characters who love this gift (+3 hearts)
 * - liked: Characters who like this gift (+2 hearts)
 * - neutral: Characters neutral to this gift (+1 heart)
 * - disliked: Characters who dislike this gift (-1 heart)
 */
const GIFT_PREFERENCES = [
  {
    name: 'Mochi',
    cost: 10,
    loved: ['Ochako', 'Momo', 'Tsuyu'],
    liked: ['Mina', 'Jiro', 'Hagakure'],
    neutral: ['Nejire', 'Mei'],
    disliked: []
  },
  {
    name: 'Tea Set',
    cost: 50,
    loved: ['Momo', 'Ochako'],
    liked: ['Tsuyu', 'Nejire'],
    neutral: ['Jiro', 'Mina'],
    disliked: ['Mei']
  },
  {
    name: 'Cute Plushie',
    cost: 30,
    loved: ['Ochako', 'Mina', 'Hagakure'],
    liked: ['Nejire', 'Tsuyu'],
    neutral: ['Momo', 'Jiro'],
    disliked: ['Mei']
  },
  {
    name: 'Fashion Magazine',
    cost: 20,
    loved: ['Mina', 'Hagakure', 'Momo'],
    liked: ['Ochako', 'Nejire'],
    neutral: ['Jiro'],
    disliked: ['Tsuyu', 'Mei']
  },
  {
    name: 'Music Album',
    cost: 35,
    loved: ['Jiro'],
    liked: ['Mina', 'Hagakure'],
    neutral: ['Ochako', 'Nejire'],
    disliked: []
  },
  {
    name: 'Engineering Kit',
    cost: 60,
    loved: ['Mei'],
    liked: ['Momo'],
    neutral: ['Jiro'],
    disliked: ['Mina', 'Hagakure']
  },
  {
    name: 'Flower Bouquet',
    cost: 25,
    loved: ['Ochako', 'Momo', 'Nejire'],
    liked: ['Tsuyu', 'Mina', 'Hagakure'],
    neutral: ['Jiro'],
    disliked: []
  },
  {
    name: 'Workout Gear',
    cost: 40,
    loved: ['Ochako', 'Mina'],
    liked: ['Tsuyu', 'Nejire'],
    neutral: ['Jiro', 'Mei'],
    disliked: ['Momo', 'Hagakure']
  },
  {
    name: 'Art Supplies',
    cost: 45,
    loved: ['Momo', 'Jiro'],
    liked: ['Nejire', 'Mei'],
    neutral: ['Ochako', 'Tsuyu'],
    disliked: []
  },
  {
    name: 'Cookbook',
    cost: 30,
    loved: ['Momo', 'Tsuyu'],
    liked: ['Ochako', 'Mina'],
    neutral: ['Nejire'],
    disliked: ['Jiro', 'Mei', 'Hagakure']
  },
  {
    name: 'Video Game',
    cost: 55,
    loved: ['Mina', 'Jiro'],
    liked: ['Ochako', 'Hagakure'],
    neutral: ['Nejire', 'Mei'],
    disliked: ['Momo', 'Tsuyu']
  },
  {
    name: 'Spa Voucher',
    cost: 70,
    loved: ['Momo', 'Nejire', 'Mina'],
    liked: ['Ochako', 'Hagakure'],
    neutral: ['Tsuyu', 'Jiro'],
    disliked: ['Mei']
  },
  {
    name: 'Science Book',
    cost: 35,
    loved: ['Momo', 'Mei'],
    liked: ['Tsuyu'],
    neutral: ['Jiro', 'Nejire'],
    disliked: ['Mina', 'Hagakure']
  },
  {
    name: 'Frog Plushie',
    cost: 30,
    loved: ['Tsuyu'],
    liked: ['Ochako', 'Nejire'],
    neutral: ['Mina', 'Hagakure'],
    disliked: []
  },
  {
    name: 'Concert Tickets',
    cost: 80,
    loved: ['Jiro', 'Mina'],
    liked: ['Hagakure', 'Nejire'],
    neutral: ['Ochako'],
    disliked: ['Tsuyu', 'Momo']
  },
  {
    name: 'Skincare Set',
    cost: 50,
    loved: ['Momo', 'Mina', 'Hagakure'],
    liked: ['Nejire', 'Ochako'],
    neutral: ['Jiro', 'Tsuyu'],
    disliked: ['Mei']
  },
  {
    name: 'Cute Accessories',
    cost: 25,
    loved: ['Ochako', 'Mina', 'Hagakure'],
    liked: ['Nejire', 'Momo'],
    neutral: ['Tsuyu', 'Jiro'],
    disliked: ['Mei']
  },
  {
    name: 'Mystery Novel',
    cost: 30,
    loved: ['Momo', 'Jiro'],
    liked: ['Tsuyu', 'Nejire'],
    neutral: ['Ochako'],
    disliked: ['Mina', 'Hagakure']
  },
  {
    name: 'Boba Tea',
    cost: 15,
    loved: ['Mina', 'Ochako', 'Hagakure'],
    liked: ['Nejire', 'Jiro'],
    neutral: ['Tsuyu', 'Momo'],
    disliked: []
  },
  {
    name: 'DIY Project Kit',
    cost: 40,
    loved: ['Mei', 'Momo'],
    liked: ['Jiro'],
    neutral: ['Tsuyu', 'Nejire'],
    disliked: ['Mina', 'Hagakure', 'Ochako']
  }
];

// ============================================================================
// EQUIPMENT SLOTS AND TYPES
// ============================================================================

/**
 * Available equipment slots for player characters
 */
const EQUIPMENT_SLOTS = {
  HEAD: 'head',
  BODY: 'body',
  WEAPON: 'weapon',
  ACCESSORY: 'accessory',
  PET: 'pet'
};

/**
 * Equipment slot display names
 */
const EQUIPMENT_SLOT_NAMES = {
  [EQUIPMENT_SLOTS.HEAD]: 'Head',
  [EQUIPMENT_SLOTS.BODY]: 'Body',
  [EQUIPMENT_SLOTS.WEAPON]: 'Weapon',
  [EQUIPMENT_SLOTS.ACCESSORY]: 'Accessory',
  [EQUIPMENT_SLOTS.PET]: 'Pet'
};

/**
 * Default equipment for new players
 */
const DEFAULT_EQUIPMENT = {
  [EQUIPMENT_SLOTS.HEAD]: null,
  [EQUIPMENT_SLOTS.BODY]: 'Training Outfit',
  [EQUIPMENT_SLOTS.WEAPON]: 'Wooden Staff',
  [EQUIPMENT_SLOTS.ACCESSORY]: null,
  [EQUIPMENT_SLOTS.PET]: null
};

// ============================================================================
// ITEM TYPES AND CATEGORIES
// ============================================================================

/**
 * Item type categories
 */
const ITEM_TYPES = {
  EQUIPMENT: 'equipment',
  CONSUMABLE: 'consumable',
  GIFT: 'gift',
  MATERIAL: 'material',
  SPECIAL: 'special'
};

/**
 * Item rarity levels
 */
const ITEM_RARITY = {
  COMMON: { name: 'Common', color: 0x808080 },
  UNCOMMON: { name: 'Uncommon', color: 0x00ff00 },
  RARE: { name: 'Rare', color: 0x0080ff },
  EPIC: { name: 'Epic', color: 0x9933ff },
  LEGENDARY: { name: 'Legendary', color: 0xffa500 },
  MYTHIC: { name: 'Mythic', color: 0xff00ff }
};

// ============================================================================
// CURRENCY AND ECONOMY
// ============================================================================

/**
 * Currency types
 */
const CURRENCY = {
  MOCHI: 'mochi',
  WATERLILY: 'waterlily'
};

/**
 * Currency display information
 */
const CURRENCY_INFO = {
  [CURRENCY.MOCHI]: {
    name: 'Mochi',
    emoji: '🍡',
    description: 'Primary currency earned through activities'
  },
  [CURRENCY.WATERLILY]: {
    name: 'Waterlily',
    emoji: '🪷',
    description: 'Premium currency for special purchases'
  }
};

/**
 * Daily reward amounts
 */
const DAILY_REWARDS = {
  BASE_MOCHI: 100,
  BASE_WATERLILY: 1,
  STREAK_BONUS_MOCHI: 20, // Per day of streak
  MAX_STREAK_BONUS: 7 // Maximum streak days counted
};

// ============================================================================
// EXPERIENCE AND LEVELING
// ============================================================================

/**
 * Experience required for each level
 * Formula: level * 100 * 1.2^(level - 1)
 */
const LEVEL_EXPERIENCE_BASE = 100;
const LEVEL_EXPERIENCE_MULTIPLIER = 1.2;

/**
 * Calculate experience required for a specific level
 * @param {number} level - Target level
 * @returns {number} Experience required
 */
function getExperienceForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(level * LEVEL_EXPERIENCE_BASE * Math.pow(LEVEL_EXPERIENCE_MULTIPLIER, level - 1));
}

/**
 * Maximum level cap
 */
const MAX_LEVEL = 100;

/**
 * Experience gain amounts
 */
const EXPERIENCE_GAINS = {
  MESSAGE: 5,
  COMMAND_USE: 10,
  DAILY_CLAIM: 50,
  GIFT_GIVEN: 20,
  RAID_PARTICIPATION: 100,
  QUEST_COMPLETION: 150
};

// ============================================================================
// COOLDOWNS
// ============================================================================

/**
 * Command cooldowns in milliseconds
 */
const COOLDOWNS = {
  DAILY: 24 * 60 * 60 * 1000, // 24 hours
  HOURLY: 60 * 60 * 1000, // 1 hour
  GIFT: 5 * 60 * 1000, // 5 minutes
  WORK: 30 * 60 * 1000, // 30 minutes
  RAID: 60 * 60 * 1000, // 1 hour
  TEA_CEREMONY: 24 * 60 * 60 * 1000 // 24 hours
};

// ============================================================================
// SHOP ITEMS
// ============================================================================

/**
 * Mochi shop items
 */
const MOCHI_SHOP_ITEMS = [
  { name: 'Health Potion', price: 50, type: ITEM_TYPES.CONSUMABLE },
  { name: 'Stamina Boost', price: 75, type: ITEM_TYPES.CONSUMABLE },
  { name: 'Experience Book', price: 100, type: ITEM_TYPES.CONSUMABLE },
  { name: 'Mystery Box', price: 200, type: ITEM_TYPES.SPECIAL }
];

/**
 * Waterlily shop items (premium)
 */
const WATERLILY_SHOP_ITEMS = [
  { name: 'Rare Equipment Box', price: 5, type: ITEM_TYPES.SPECIAL },
  { name: 'Name Color Change', price: 3, type: ITEM_TYPES.SPECIAL },
  { name: 'Profile Frame', price: 10, type: ITEM_TYPES.SPECIAL },
  { name: 'Limited Skin', price: 15, type: ITEM_TYPES.SPECIAL }
];

// ============================================================================
// CHARACTERS
// ============================================================================

/**
 * Available characters for relationship building
 */
const CHARACTERS = [
  'Ochako',
  'Momo',
  'Tsuyu',
  'Mina',
  'Jiro',
  'Hagakure',
  'Nejire',
  'Mei'
];

/**
 * Relationship levels
 */
const RELATIONSHIP_LEVELS = {
  STRANGER: { name: 'Stranger', hearts: 0 },
  ACQUAINTANCE: { name: 'Acquaintance', hearts: 5 },
  FRIEND: { name: 'Friend', hearts: 15 },
  CLOSE_FRIEND: { name: 'Close Friend', hearts: 30 },
  BEST_FRIEND: { name: 'Best Friend', hearts: 50 },
  SOULMATE: { name: 'Soulmate', hearts: 100 }
};

// ============================================================================
// EMBED COLORS
// ============================================================================

/**
 * Standard embed colors for different message types
 */
const EMBED_COLORS = {
  DEFAULT: 0x9d7dcd, // Ochako's purple
  SUCCESS: 0x57f287, // Green
  ERROR: 0xed4245, // Red
  WARNING: 0xfee75c, // Yellow
  INFO: 0x5865f2, // Blue
  MOCHI: 0xffb6c1, // Pink (mochi color)
  WATERLILY: 0x98d8c8, // Teal (waterlily color)
  LEGENDARY: 0xffa500, // Orange
  SPECIAL: 0xff00ff // Magenta
};

// ============================================================================
// RATE LIMITS
// ============================================================================

/**
 * Rate limiting configuration
 */
const RATE_LIMITS = {
  COMMANDS_PER_MINUTE: 10,
  MESSAGES_PER_MINUTE: 20,
  API_CALLS_PER_HOUR: 100
};

// ============================================================================
// AI CONVERSATION SETTINGS
// ============================================================================

/**
 * AI conversation configuration
 */
const AI_CONFIG = {
  MAX_CONTEXT_MESSAGES: 10,
  MAX_MESSAGE_LENGTH: 2000,
  DEFAULT_TEMPERATURE: 0.8,
  DEFAULT_MODEL: 'gpt-3.5-turbo',
  SYSTEM_PROMPT: 'You are Ochako, a cheerful and friendly character from My Hero Academia. Respond in a warm, enthusiastic manner.',
  MAX_TOKENS: 500
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Gift system
  GIFT_PREFERENCES,

  // Equipment
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_NAMES,
  DEFAULT_EQUIPMENT,

  // Items
  ITEM_TYPES,
  ITEM_RARITY,

  // Economy
  CURRENCY,
  CURRENCY_INFO,
  DAILY_REWARDS,
  MOCHI_SHOP_ITEMS,
  WATERLILY_SHOP_ITEMS,

  // Leveling
  LEVEL_EXPERIENCE_BASE,
  LEVEL_EXPERIENCE_MULTIPLIER,
  MAX_LEVEL,
  EXPERIENCE_GAINS,
  getExperienceForLevel,

  // Cooldowns
  COOLDOWNS,

  // Characters
  CHARACTERS,
  RELATIONSHIP_LEVELS,

  // UI
  EMBED_COLORS,

  // Rate limiting
  RATE_LIMITS,

  // AI
  AI_CONFIG
};
