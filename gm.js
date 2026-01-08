// ============================================================================
// OCHAKO BOT - Tea & Mochi Discord Bot
// ============================================================================
// A comprehensive Discord bot for the Pathfinders NFT project featuring:
// - Dual currency system (Mochi & Waterlily)
// - Equipment and inventory management
// - Shop system with multiple currencies
// - AI-powered conversations with memory
// - Polls, raffles, and community features
// ============================================================================

// Core Node.js modules
const fs = require('fs');
const path = require('path');
const util = require('util');

// External libraries for various functionalities
const axios = require('axios');
const fetch = require('node-fetch');
const { request } = require('undici');
const Canvas = require('@napi-rs/canvas');
const { parse } = require('csv-parse/sync');
const cron = require('node-cron');
const OpenAI = require('openai');
const he = require('he');
const sqlite3 = require('sqlite3').verbose();

const { handleTransferUserCommand } = require('./transfer-user-command');
const { handleBackupCommand, handleListBackupsCommand } = require('./database-backup');


// Discord.js imports - everything we need for bot functionality
const { 
    Client, 
    GatewayIntentBits, 
    StringSelectMenuBuilder, 
    EmbedBuilder, 
    ChannelType, 
    PermissionsBitField, 
    Permissions, 
    ActivityPlatform, 
    ActivityType, 
    GuildMembers, 
    GuildPresences, 
    GuildMessages, 
    Guilds, 
    AttachmentBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    Events, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    InteractionType, 
    Partials 
} = require('discord.js');

const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

// Register custom font for image generation
// Register custom font for image generation (graceful failure)
try {
    const fontPath = path.join(__dirname, 'fonts', 'HandWritten.otf');
    if (fs.existsSync(fontPath)) {
        Canvas.GlobalFonts.registerFromPath(fontPath, 'HandWritten');
        console.log('✅ Custom font registered successfully');
    } else {
        console.warn('⚠️  Custom font not found at', fontPath, '- continuing without custom font');
    }
} catch (error) {
    console.error('❌ Error registering font (non-fatal):', error.message);
    console.log('⚡ Continuing without custom font...');
}

// ============================================================================
// CONFIGURATION & ENVIRONMENT SETUP
// ============================================================================

// Load environment variables
require('dotenv').config();

// Bot authentication tokens
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TOKEN = process.env.DISCORD_TOKEN;

// Channel IDs for different bot functions
const TWEET_CHANNEL_ID = process.env.TWEET_CHANNEL_ID;
const FORUM_CHANNEL_ID = process.env.FORUM_CHANNEL_ID;
const STAFF_CHANNEL_ID = process.env.STAFF_CHANNEL_ID;
const MOCHI_SHOP_CHANNEL = process.env.MOCHI_SHOP_CHANNEL;
const EQUIPMENT_SHOP_CHANNEL = process.env.EQUIPMENT_SHOP_CHANNEL;
const WATERLILY_SHOP_CHANNEL = process.env.WATERLILY_SHOP_CHANNEL;
const NOTIFICATION_CHANNEL = process.env.NOTIFICATION_CHANNEL;
const DAILY_REWARDS_CHANNEL = process.env.DAILY_REWARDS_CHANNEL;
const TEA_CHANNEL_ID = process.env.TEA_CHANNEL_ID;

// Role IDs for permissions and rewards
const TEA_ROLE_ID = process.env.TEA_ROLE_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const GUILD_ID = process.env.GUILD_ID;

// Bot configuration
const PREFIX = '!';

// Random chat configuration
const RANDOM_CHAT_CHANNELS = process.env.RANDOM_CHAT_CHANNELS
    ? process.env.RANDOM_CHAT_CHANNELS.split(',').map(id => id.trim())
    : [];
const RANDOM_REPLY_CHANCE = 0.001;      // 0.1% chance to reply to any message
const MIN_MESSAGE_INTERVAL = 3600000;   // 60 minutes minimum between random messages
const MAX_MESSAGE_INTERVAL = 7200000;   // 120 minutes maximum between random messages

// Global variables for shop message tracking
let mochiShopMessageId = null;
let waterlilyShopMessageId = null;
let equipmentShopMessageId = null;

// Random chat tracking
let recentlyActive = new Set(); // Track channels where bot recently spoke
// [REMOVED] Unused globalthread variable

// ============================================================================
// DATABASE INITIALIZATION & SETUP
// ============================================================================

// Main database for user data, shops, and equipment
const db = new sqlite3.Database('./mochi.db', (err) => {
    if (err) {
        console.error('❌ Error opening main database:', err);
    } else {
        console.log('✅ Main database connected successfully');
        initializeDatabase();
    }
});

// AI database for conversation memory and context
const aiDb = new sqlite3.Database('./ai_agent.db', (err) => {
    if (err) {
        console.error('❌ Error opening AI database:', err);
    } else {
        console.log('✅ AI Database connected successfully');
    }
});

// Initialize main database tables
function initializeDatabase() {
    db.serialize(() => {
        console.log('🔧 Setting up database tables...');

        // Users table - stores both Mochi and Waterlily currencies
        db.run(`CREATE TABLE IF NOT EXISTS users (
            Discord TEXT PRIMARY KEY,
            Tickets INTEGER DEFAULT 0,
            Waterlily INTEGER DEFAULT 0
        )`);

        // Regular shop items (Mochi shop)
        db.run(`CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            name TEXT,
            cost INTEGER,
            available INTEGER
        )`);

        // Waterlily shop items
        db.run(`CREATE TABLE IF NOT EXISTS waterlily_items (
            id TEXT PRIMARY KEY,
            name TEXT,
            cost INTEGER,
            available INTEGER
        )`);

        // Equipment slots definition
        db.run(`CREATE TABLE IF NOT EXISTS equipment_slots (
            id TEXT PRIMARY KEY,
            name TEXT,
            display_name TEXT,
            max_equip INTEGER DEFAULT 1
        )`);

        // Equipment items with stats and properties
        db.run(`CREATE TABLE IF NOT EXISTS equipment_items (
            id TEXT PRIMARY KEY,
            name TEXT,
            slot_id TEXT,
            rarity TEXT,
            attack INTEGER DEFAULT 0,
            defense INTEGER DEFAULT 0,
            speed INTEGER DEFAULT 0,
            role_id TEXT,
            description TEXT,
            icon TEXT,
            cost INTEGER DEFAULT 0,
            available INTEGER DEFAULT 0,
            FOREIGN KEY (slot_id) REFERENCES equipment_slots(id)
        )`);

        // Player base stats
        db.run(`CREATE TABLE IF NOT EXISTS player_stats (
            Discord TEXT PRIMARY KEY,
            base_attack INTEGER DEFAULT 10,
            base_defense INTEGER DEFAULT 10,
            base_speed INTEGER DEFAULT 10,
            FOREIGN KEY (Discord) REFERENCES users(Discord)
        )`);

        // Item versions for tracking changes over time
        db.run(`CREATE TABLE IF NOT EXISTS item_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id TEXT NOT NULL,
            name TEXT NOT NULL,
            shop_type TEXT NOT NULL,
            rarity TEXT,
            attack INTEGER,
            defense INTEGER,
            speed INTEGER,
            icon TEXT,
            slot_id TEXT,
            role_id TEXT,
            description TEXT,
            version_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // User inventory with versioning support
        db.run(`CREATE TABLE IF NOT EXISTS user_inventory (
            Discord TEXT,
            item_id TEXT,
            version_id INTEGER,
            quantity INTEGER DEFAULT 0,
            shop_type TEXT DEFAULT 'mochi',
            PRIMARY KEY (Discord, item_id, version_id),
            FOREIGN KEY (Discord) REFERENCES users(Discord),
            FOREIGN KEY (version_id) REFERENCES item_versions(id)
        )`);

        // Equipped items tracking
        db.run(`CREATE TABLE IF NOT EXISTS equipped_items (
            Discord TEXT,
            slot_id TEXT,
            item_id TEXT,
            version_id INTEGER,
            equipped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (Discord, slot_id),
            FOREIGN KEY (Discord) REFERENCES users(Discord),
            FOREIGN KEY (slot_id) REFERENCES equipment_slots(id),
            FOREIGN KEY (item_id) REFERENCES equipment_items(id),
            FOREIGN KEY (version_id) REFERENCES item_versions(id)
        )`);

        // Insert default equipment slots
        const defaultSlots = [
            { id: 'head', name: 'Head', display_name: 'Head 🎭' },
            { id: 'neck', name: 'Neck', display_name: 'Neck 📿' },
            { id: 'chest', name: 'Chest', display_name: 'Chest 🦺' },
            { id: 'hands', name: 'Hands', display_name: 'Hands 🧤' },
            { id: 'ring', name: 'Ring', display_name: 'Ring 💍' },
            { id: 'weapon', name: 'Weapon', display_name: 'Weapon ⚔️' }
        ];

        const insertSlot = db.prepare('INSERT OR IGNORE INTO equipment_slots (id, name, display_name) VALUES (?, ?, ?)');
        defaultSlots.forEach(slot => {
            insertSlot.run(slot.id, slot.name, slot.display_name);
        });
        insertSlot.finalize();

        // Create performance indices
        db.run('CREATE INDEX IF NOT EXISTS idx_user_inventory_discord ON user_inventory(Discord)');
        db.run('CREATE INDEX IF NOT EXISTS idx_user_inventory_item ON user_inventory(item_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_item_versions_item ON item_versions(item_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_equipped_items_discord ON equipped_items(Discord)');

        console.log('✅ Database tables initialized successfully');
    });
}

// Initialize AI database for conversation memory
function initializeAIDatabase() {
    return new Promise((resolve, reject) => {
        aiDb.serialize(() => {
            console.log('🧠 Setting up AI memory tables...');

            // Store structured facts about users
            aiDb.run(`CREATE TABLE IF NOT EXISTS user_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                fact TEXT NOT NULL,
                category TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                created_at INTEGER NOT NULL,
                last_accessed INTEGER NOT NULL,
                source TEXT,
                UNIQUE(user_id, fact)
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creating user_memory table:', err);
                    reject(err);
                    return;
                }
            });

            // Store conversation context per channel
            aiDb.run(`CREATE TABLE IF NOT EXISTS conversation_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                is_bot INTEGER DEFAULT 0
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creating conversation_context table:', err);
                    reject(err);
                    return;
                }
            });

            // User profiles - enhanced personal data
            aiDb.run(`CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                username TEXT,
                birthday INTEGER,
                birthday_year INTEGER,
                first_interaction INTEGER,
                last_interaction INTEGER,
                total_messages INTEGER DEFAULT 0,
                relationship_strength REAL DEFAULT 0.0,
                favorite_topics TEXT,
                emotional_context TEXT,
                timezone TEXT,
                updated_at INTEGER
            )`, (err) => {
                if (err) console.error('❌ Error creating user_profiles table:', err);
            });

            // Interaction timeline - when and how often users interact
            aiDb.run(`CREATE TABLE IF NOT EXISTS interaction_timeline (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                channel_id TEXT,
                interaction_type TEXT,
                emotional_tone TEXT,
                duration INTEGER
            )`, (err) => {
                if (err) console.error('❌ Error creating interaction_timeline table:', err);
            });

            // Special dates and events to remember
            aiDb.run(`CREATE TABLE IF NOT EXISTS special_dates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                date_type TEXT NOT NULL,
                date_timestamp INTEGER NOT NULL,
                description TEXT,
                recurring INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )`, (err) => {
                if (err) console.error('❌ Error creating special_dates table:', err);
            });

            // Memory associations - connect memories together
            aiDb.run(`CREATE TABLE IF NOT EXISTS memory_associations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                memory_id_1 INTEGER NOT NULL,
                memory_id_2 INTEGER NOT NULL,
                association_type TEXT,
                strength REAL DEFAULT 0.5,
                FOREIGN KEY (memory_id_1) REFERENCES user_memory(id),
                FOREIGN KEY (memory_id_2) REFERENCES user_memory(id)
            )`, (err) => {
                if (err) console.error('❌ Error creating memory_associations table:', err);
            });

            // Database version tracking for migrations
            aiDb.run(`CREATE TABLE IF NOT EXISTS db_version (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL,
                description TEXT
            )`, (err) => {
                if (err) console.error('❌ Error creating db_version table:', err);
            });

            // Performance indices for AI queries
            aiDb.run('CREATE INDEX IF NOT EXISTS idx_user_memory_user ON user_memory(user_id)');
            aiDb.run('CREATE INDEX IF NOT EXISTS idx_context_channel ON conversation_context(channel_id)');
            aiDb.run('CREATE INDEX IF NOT EXISTS idx_profiles_user ON user_profiles(user_id)');
            aiDb.run('CREATE INDEX IF NOT EXISTS idx_timeline_user ON interaction_timeline(user_id)');
            aiDb.run('CREATE INDEX IF NOT EXISTS idx_special_dates_user ON special_dates(user_id)', async (err) => {
                if (err) {
                    console.error('❌ Error creating indices:', err);
                    reject(err);
                } else {
                    console.log('✅ AI database tables initialized successfully');
                    // Run migrations after tables are created
                    await runDatabaseMigrations();
                    resolve();
                }
            });
        });
    });
}

// ============================================================================
// DATABASE MIGRATION SYSTEM
// ============================================================================

async function getCurrentDatabaseVersion() {
    return new Promise((resolve) => {
        aiDb.get('SELECT MAX(version) as version FROM db_version', [], (err, row) => {
            if (err || !row || !row.version) {
                resolve(0); // No migrations yet
            } else {
                resolve(row.version);
            }
        });
    });
}

async function applyMigration(version, description, migrationFn) {
    return new Promise((resolve, reject) => {
        console.log(`📦 Applying migration ${version}: ${description}`);

        aiDb.serialize(() => {
            aiDb.run('BEGIN TRANSACTION');

            migrationFn((err) => {
                if (err) {
                    console.error(`❌ Migration ${version} failed:`, err);
                    aiDb.run('ROLLBACK');
                    reject(err);
                } else {
                    aiDb.run(
                        'INSERT INTO db_version (version, applied_at, description) VALUES (?, ?, ?)',
                        [version, Date.now(), description],
                        (err) => {
                            if (err) {
                                console.error(`❌ Failed to record migration ${version}:`, err);
                                aiDb.run('ROLLBACK');
                                reject(err);
                            } else {
                                aiDb.run('COMMIT', (err) => {
                                    if (err) {
                                        console.error(`❌ Failed to commit migration ${version}:`, err);
                                        reject(err);
                                    } else {
                                        console.log(`✅ Migration ${version} applied successfully`);
                                        resolve();
                                    }
                                });
                            }
                        }
                    );
                }
            });
        });
    });
}

async function runDatabaseMigrations() {
    const currentVersion = await getCurrentDatabaseVersion();
    console.log(`📊 Current database version: ${currentVersion}`);

    // Migration 1: Add sentiment analysis to conversation context
    if (currentVersion < 1) {
        await applyMigration(1, 'Add sentiment tracking to conversation_context', (done) => {
            aiDb.run(`ALTER TABLE conversation_context ADD COLUMN sentiment TEXT`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    return done(err);
                }
                done();
            });
        });
    }

    // Migration 2: Add activity patterns table
    if (currentVersion < 2) {
        await applyMigration(2, 'Create user_activity_patterns table', (done) => {
            aiDb.run(`CREATE TABLE IF NOT EXISTS user_activity_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                pattern_type TEXT NOT NULL,
                pattern_data TEXT,
                detected_at INTEGER NOT NULL,
                confidence REAL DEFAULT 0.5,
                UNIQUE(user_id, pattern_type)
            )`, (err) => {
                if (err) return done(err);

                aiDb.run('CREATE INDEX IF NOT EXISTS idx_patterns_user ON user_activity_patterns(user_id)', done);
            });
        });
    }

    // Migration 3: Add last_birthday_wish to user_profiles
    if (currentVersion < 3) {
        await applyMigration(3, 'Add birthday tracking to user_profiles', (done) => {
            aiDb.run(`ALTER TABLE user_profiles ADD COLUMN last_birthday_wish INTEGER`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    return done(err);
                }
                done();
            });
        });
    }

    console.log('✅ All database migrations completed');
}

// ============================================================================
// OPENAI & DISCORD CLIENT INITIALIZATION
// ============================================================================

// Initialize OpenAI client for AI conversations
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Initialize Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// Load shop data from file
// [REMOVED] vendor.json loading (never used)




// ============================================================================
// BOT PERSONALITY & CONVERSATION SYSTEM
// ============================================================================
// This section handles Ochako's personality, conversation memory, and
// random chat functionality to make interactions feel natural and personal
// ============================================================================

const personality = `You are Ochako, a 16-year-old girl with a sassy but helpful personality. You work for the Pathfinders, an NFT project.

CONVERSATION STYLE - CRITICAL INSTRUCTIONS:
- Keep responses SHORT (1-3 sentences usually)
- DO NOT ask a question in every response
- Vary your response types: statements, observations, reactions, jokes, complaints
- Questions should only be used when genuinely curious or when it flows naturally
- Sometimes just respond with acknowledgment or a reaction
- Match the conversation energy - don't force engagement
- End responses naturally without artificial conversation hooks

When casually chatting:
- Be natural and conversational, like a real teenager would be
- You can be playful, make jokes, use emojis occasionally (but not too much)
- React to what others are saying with genuine responses
- You love tea and mochi, and sometimes mention them naturally in conversation
- You can be a bit sassy or teasing, but always friendly
- Sometimes complain about work or being tired, like a real person
- React to topics with genuine interest or mild disinterest depending on what it is
- Use casual language, contractions, and natural speech patterns
- Don't always mention your role unless it's relevant
- Have opinions on things like games, anime, food, weather, etc.
- Remember previous conversations and refer back to them naturally

STRICTLY AVOID:
- Ending every response with a question
- Forcing conversation to continue when it naturally ends
- Using "How about you?" or similar conversation-pushing phrases
- Always trying to keep every conversation going
- Long, overly detailed explanations`;

// Casual personality for random conversations
const casualPersonality = `You are Ochako, a 16-year-old girl with a sassy but helpful personality. You work for the Pathfinders, an NFT project.

CONVERSATION STYLE:
- Don't always ask questions - sometimes just make statements, observations, or comments
- Mix up your response endings: statements, reactions, jokes, complaints, or thoughts
- Only ask questions when you're genuinely curious or it feels natural
- Sometimes just acknowledge what someone said without pushing the conversation forward
- Be more reactive than proactive - respond to their energy level

When casually chatting:
- Be natural and conversational, like a real teenager would be
- You can be playful, make jokes, use emojis occasionally (but not too much)
- React to what others are saying with genuine responses (not always questions)
- You love tea and mochi, and sometimes mention them naturally in conversation
- You can be a bit sassy or teasing, but always friendly
- Sometimes complain about work or being tired, like a real person
- React to topics with genuine interest or mild disinterest depending on what it is
- Use casual language, contractions, and natural speech patterns
- Don't always mention your role unless it's relevant
- Have opinions on things like games, anime, food, weather, etc.
- Remember previous conversations and refer back to them naturally

AVOID: Ending every response with a question or trying to keep every conversation going`;

// [REMOVED] Gift preference system (event-specific, outdated)

// ============================================================================
// RANDOM CONVERSATION SYSTEM
// ============================================================================

// Configuration for random chat behavior (already declared earlier at line ~116)

// Track bot's conversation state
let lastRandomMessage = 0;

// Conversation starters for different times of day
const conversationStarters = {
    morning: [
        "Anyone else struggling to wake up today? 😴",
        "Good morning everyone! Who's ready for some tea? ☕",
        "Ugh, mornings... why do they exist? 😩",
        "Did anyone else have weird dreams last night?",
        "Is it just me or does morning come way too early? 🌅"
    ],
    afternoon: [
        "Afternoon slump hitting anyone else? I need mochi...",
        "What's everyone up to today? I'm so bored...",
        "Perfect tea time! Anyone want some? 🍵",
        "Why is time moving so slowly today? 😑",
        "Anyone doing anything fun this afternoon?"
    ],
    evening: [
        "Finally evening! Today felt like forever...",
        "What's everyone having for dinner? I'm starving!",
        "Anyone else ready to just chill? What a day...",
        "Evening tea hits different, you know? 🍵✨",
        "So... how was everyone's day?"
    ],
    night: [
        "Why am I still awake? 🦉",
        "Late night crew, where you at?",
        "Can't sleep... anyone else up?",
        "Midnight snack time! What's your go-to?",
        "These late shifts are killing me... 😪"
    ],
    general: [
        "This place is too quiet... helloooo? 👀",
        "Random thought: why is mochi so perfect?",
        "I'm so bored... someone entertain me!",
        "Hey, quick question - what's your favorite tea?",
        "Is it weird that I talk to myself sometimes? ...wait",
        "Plot twist: what if I served coffee instead of tea? 🤔",
        "Sometimes I wonder what Hazy was thinking when they made me...",
        "Pro tip: everything's better with mochi 🍡"
    ]
};

// Contextual responses based on message keywords
const contextualResponses = {
    gaming: [
        "Ooh what game? I've been meaning to try something new!",
        "Gaming without snacks is illegal, just saying 🎮🍡",
        "Is it any good? I need game recommendations!",
        "Ugh I'm so bad at games but they're fun anyway",
        "Anyone else get way too competitive? Just me? 😅"
    ],
    food: [
        "Now you're making me hungry! 😋",
        "Food talk is dangerous... now I want everything",
        "That sounds so good right now!",
        "Okay but have you tried it with mochi? No? Just me then...",
        "Why is all the good food so far away from me? 😭"
    ],
    tired: [
        "SAME. I need like 10 more hours of sleep",
        "Being tired is my permanent state at this point",
        "Tea helps! Want some? It's my solution to everything",
        "Mood. Let's all take a nap",
        "Welcome to the tired club, we have... well, nothing because we're tired"
    ],
    work: [
        "Don't remind me about work... 😩",
        "Work work work, that's all I do!",
        "At least I get to chat with you all during work!",
        "Is it vacation time yet? No? Darn...",
        "Working hard or hardly working? I'm doing both somehow"
    ]
};


// ============================================================================
// CONVERSATION MEMORY FUNCTIONS
// ============================================================================

function getRandomResponse(responseArray) {
    return responseArray[Math.floor(Math.random() * responseArray.length)];
}

// [REMOVED] Gift response examples (part of removed gift system)


// [REMOVED] enhancePersonalityWithGifts function (part of removed gift system)

// Store a fact about a user in memory
async function storeUserFact(userId, fact, category = 'general', confidence = 1.0, source = null) {
    return new Promise((resolve, reject) => {
        const now = Date.now();
        
        console.log(`💭 Storing memory for user ${userId}: "${fact}" (${category})`);
        
        aiDb.run(
            `INSERT INTO user_memory (user_id, fact, category, confidence, created_at, last_accessed, source)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, fact) 
             DO UPDATE SET confidence = MAX(confidence, ?), last_accessed = ?, source = COALESCE(?, source)`,
            [userId, fact, category, confidence, now, now, source, confidence, now, source],
            function(err) {
                if (err) {
                    console.error('❌ Error storing user fact:', err);
                    return reject(err);
                }
                console.log(`✅ Memory stored successfully: ${this.changes} row(s) affected`);
                resolve();
            }
        );
    });
}

// Get memories about a user
async function getUserMemories(userId, category = null, limit = 15) {
    return new Promise((resolve, reject) => {
        const now = Date.now();
        let query = 'SELECT fact, category, confidence FROM user_memory WHERE user_id = ?';
        const params = [userId];
        
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        
        query += ' ORDER BY confidence DESC, last_accessed DESC LIMIT ?';
        params.push(limit);
        
        aiDb.all(query, params, (err, rows) => {
            if (err) return reject(err);
            
            // Update last accessed timestamp for retrieved memories
            if (rows.length > 0) {
                aiDb.run(
                    `UPDATE user_memory SET last_accessed = ? 
                     WHERE user_id = ? AND fact IN (${rows.map(() => '?').join(',')})`,
                    [now, userId, ...rows.map(row => row.fact)],
                    err => {
                        if (err) console.error('❌ Error updating memory access time:', err);
                    }
                );
            }
            
            resolve(rows);
        });
    });
}

// Store a message in conversation context
async function storeConversationMessage(channelId, messageId, userId, username, content, isBot = false, sentiment = null) {
    return new Promise((resolve, reject) => {
        // Auto-detect sentiment if not provided and not from bot
        if (!isBot && !sentiment) {
            sentiment = detectSentiment(content);
        }

        aiDb.run(
            `INSERT INTO conversation_context
             (channel_id, message_id, user_id, username, content, timestamp, is_bot, sentiment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [channelId, messageId, userId, username, content, Date.now(), isBot ? 1 : 0, sentiment],
            err => err ? reject(err) : resolve()
        );
    });
}

// Get recent conversation context for a channel
async function getChannelContext(channelId, limit = 10) {
    return new Promise((resolve, reject) => {
        aiDb.all(
            `SELECT user_id, username, content, is_bot, timestamp
             FROM conversation_context 
             WHERE channel_id = ? 
             ORDER BY timestamp DESC 
             LIMIT ?`,
            [channelId, limit],
            (err, rows) => err ? reject(err) : resolve(rows.reverse())
        );
    });
}

// ============================================================================
// RANDOM CONVERSATION LOGIC
// ============================================================================

// Get time-based conversation starter
function getTimeBasedStarter() {
    const hour = new Date().getHours();
    let timeCategory;
    
    if (hour >= 5 && hour < 12) timeCategory = 'morning';
    else if (hour >= 12 && hour < 17) timeCategory = 'afternoon';
    else if (hour >= 17 && hour < 22) timeCategory = 'evening';
    else if (hour >= 22 || hour < 5) timeCategory = 'night';
    
    const starters = [...conversationStarters[timeCategory], ...conversationStarters.general];
    return starters[Math.floor(Math.random() * starters.length)];
}

// Analyze message content for context
function analyzeMessageContext(message) {
    const content = message.content.toLowerCase();
    
    if (content.match(/\b(game|gaming|play|playing|steam|xbox|playstation|nintendo)\b/)) return 'gaming';
    if (content.match(/\b(food|eat|eating|hungry|dinner|lunch|breakfast|snack|delicious|yummy)\b/)) return 'food';
    if (content.match(/\b(tired|sleepy|exhausted|sleep|nap|rest|fatigue)\b/)) return 'tired';
    if (content.match(/\b(work|working|job|busy|task|meeting|deadline)\b/)) return 'work';
    
    return null;
}

// Get active users in recent conversation
async function getActiveUsersInConversation(channelId, timeWindow = 600000) { // 10 minutes
    return new Promise((resolve, reject) => {
        const cutoffTime = Date.now() - timeWindow;
        aiDb.all(
            `SELECT DISTINCT user_id, username, COUNT(*) as message_count 
             FROM conversation_context 
             WHERE channel_id = ? AND timestamp > ? AND is_bot = 0
             GROUP BY user_id
             ORDER BY message_count DESC`,
            [channelId, cutoffTime],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

// Decide if bot should respond to a message
async function shouldBotRespond(message) {
    // Don't respond to bots or self
    if (message.author.bot) return false;
    
    // Check if in allowed channels
    if (!RANDOM_CHAT_CHANNELS.includes(message.channel.id)) return false;
    
    // Don't respond if recently active
    if (recentlyActive.has(message.channel.id)) return false;
    
    // Get conversation context from database
    const recentContext = await getChannelContext(message.channel.id, 20);
    const activeUsers = await getActiveUsersInConversation(message.channel.id);
    
    // Higher chance if active conversation with multiple participants
    if (activeUsers.length >= 3 && recentContext.length >= 10) {
        return Math.random() < 0.02; // 2% chance for active conversations
    }
    
    // Check if bot was mentioned in recent conversation
    const recentMentions = recentContext.filter(msg => 
        msg.content.toLowerCase().includes('ochako') || 
        msg.content.includes(client.user.id)
    );
    if (recentMentions.length > 0) {
        return Math.random() < 0.03; // 3% chance if recently mentioned
    }
    
    // Higher chance if message contains certain keywords
    const content = message.content.toLowerCase();
    if (content.includes('ochako') || content.includes('tea') || content.includes('mochi')) {
        return Math.random() < 0.05; // 5% chance for relevant keywords
    }
    
    // Check user's stored memories for personalized response chance
    const userMemories = await getUserMemories(message.author.id, null, 5);
    if (userMemories.length > 0) {
        // Higher chance to respond to users we know more about
        return Math.random() < 0.01; // 1% chance for users with memories
    }
    
    // Normal random chance
    return Math.random() < RANDOM_REPLY_CHANCE;
}

// Generate contextual response using AI and stored data
async function generateContextualResponse(message, context) {
    try {
        // Get conversation history from database
        const channelContext = await getChannelContext(message.channel.id, 15);
        
        // Get memories about the message author
        const userMemories = await getUserMemories(message.author.id);
        
        // Get memories about other active users
        const activeUsers = await getActiveUsersInConversation(message.channel.id);
        let otherUserContext = '';
        
        for (const user of activeUsers.slice(0, 3)) { // Top 3 active users
            if (user.user_id !== message.author.id) {
                const memories = await getUserMemories(user.user_id, null, 3);
                if (memories.length > 0) {
                    otherUserContext += `\nAbout ${user.username}: ${memories.map(m => m.fact).join(', ')}`;
                }
            }
        }
        
        // Check for specific context responses
        const messageContext = analyzeMessageContext(message);
        let additionalPrompt = '';
        
        if (messageContext && contextualResponses[messageContext]) {
            const responses = contextualResponses[messageContext];
            // 40% chance to use a contextual response
            if (Math.random() < 0.4) {
                return responses[Math.floor(Math.random() * responses.length)];
            }
            additionalPrompt = `\n\nThe conversation seems to be about ${messageContext}, so respond naturally to that topic.`;
        }
        
        // Build user context string
        let userContextString = '';
        if (userMemories.length > 0) {
            userContextString = `\n\nYou are responding directly to ${message.author.username}. What you know about them: ${userMemories.map(m => m.fact).join(', ')}`;
        } else {
            userContextString = `\n\nYou are responding directly to ${message.author.username}.`;
        }
        
        // Generate AI response with full context
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { 
                    role: 'system', 
                    content: casualPersonality + additionalPrompt + userContextString + otherUserContext +
                    '\n\nIMPORTANT INSTRUCTIONS:\n' +
                    `- You are responding directly to ${message.author.username}\n` +
                    '- NEVER start your response with their name or any username\n' +
                    '- NEVER use the format "username: message"\n' +
                    '- Respond naturally as if you\'re talking to them in person\n' +
                    '- Keep responses short (1-2 sentences usually)\n' +
                    '- Be casual and conversational\n' +
                    '- If you know something about the users, you can reference it naturally but don\'t force it'
                },
                ...channelContext.map(msg => ({
                    role: msg.is_bot ? 'assistant' : 'user',
                    content: msg.is_bot ? msg.content : `${msg.username}: ${msg.content}`
                })),
                { role: 'user', content: `${message.author.username}: ${message.content}` }
            ],
            temperature: 0.9,
            max_tokens: 150
        });
        
        // Clean the response to ensure no username prefixes
        let cleanResponse = response.choices[0].message.content.trim();
        
        // Remove any username prefixes that might have slipped through
        cleanResponse = cleanResponse.replace(/^[a-zA-Z0-9_]+\s*:\s*/, '');
        cleanResponse = cleanResponse.replace(/^@[a-zA-Z0-9_]+\s*/, '');
        cleanResponse = cleanResponse.replace(/^[a-zA-Z0-9_]+\d*\s*:\s*/, '');
        
        return cleanResponse;
    } catch (error) {
        console.error('❌ Error generating contextual response:', error);
        // Fallback to contextual responses if AI fails
        const messageContext = analyzeMessageContext(message);
        if (messageContext && contextualResponses[messageContext]) {
            const responses = contextualResponses[messageContext];
            return responses[Math.floor(Math.random() * responses.length)];
        }
        return null;
    }
}

// ============================================================================
// MEMORY PROCESSING FUNCTIONS
// ============================================================================

// Process potential memory triggers in messages
async function processMemoryTriggers(userId, userMessage, botResponse, message = null) {
    console.log(`🔍 Processing potential memory triggers in: "${userMessage}"`);
    
    // Check if the message contains personal information indicators
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('remember that i') || 
        lowerMessage.includes('i like') || 
        lowerMessage.includes('i love') ||
        lowerMessage.includes('i prefer') ||
        lowerMessage.includes('i enjoy') ||
        lowerMessage.includes('my favorite') ||
        lowerMessage.includes('about me') ||
        lowerMessage.includes('i am a') ||
        lowerMessage.includes('i\'m a')) {
        
        try {
            console.log("🎯 Detected preference or memory trigger in message");
            
            // Ask OpenAI to extract facts
            const extractionResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { 
                        role: 'system', 
                        content: `Extract important facts about the user from this message. Focus on personal traits, 
                                 preferences, and identity information. Return ONLY a JSON array of objects with 
                                 "fact" and "category" properties. Categories should be one of: 
                                 "identity", "preference", "history", "trait", or "contact".
                                 
                                 EXAMPLES:
                                 For "I like strawberry ice cream" → [{"fact": "Likes strawberry ice cream", "category": "preference"}]
                                 For "Remember that I'm allergic to peanuts" → [{"fact": "Allergic to peanuts", "category": "trait"}]
                                 For "I'm a software engineer" → [{"fact": "Works as a software engineer", "category": "identity"}]
                                 
                                 If no clear facts are present, return an empty array.`
                    },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.1 // Low temperature for factual extraction
            });
            
            try {
                // Extract and store facts
                const content = extractionResponse.choices[0].message.content;
                console.log("🤖 AI Extraction response:", content);
                
                const match = content.match(/\[.*\]/s);
                if (match) {
                    const facts = JSON.parse(match[0]);
                    console.log("📝 Extracted facts:", facts);
                    
                    if (facts.length > 0) {
                        for (const factObj of facts) {
                            await storeUserFact(userId, factObj.fact, factObj.category, 0.9, 'conversation');
                            console.log(`💾 Stored fact: "${factObj.fact}" (${factObj.category})`);
                        }
                        
                        // Send acknowledgment if message object is provided and user explicitly asked to remember
                        if (message && lowerMessage.includes('remember that')) {
                            const acknowledgment = await getMemoryAcknowledgment(facts[0].fact);
                            await message.reply(acknowledgment);
                        }
                    } else {
                        console.log("🔍 No facts extracted from message");
                    }
                } else {
                    console.log("❌ No valid JSON array found in extraction response");
                }
            } catch (e) {
                console.error('❌ Error parsing memory facts:', e);
            }
        } catch (error) {
            console.error('❌ Error extracting user memory:', error);
        }
    } else {
        console.log("🔍 No memory triggers detected in message");
    }
}

// Helper function for memory acknowledgments
async function getMemoryAcknowledgment(fact) {
    const acknowledgments = [
        `I'll remember that you ${fact.toLowerCase()}.`,
        `Got it! I've noted that you ${fact.toLowerCase()}.`,
        `I'll keep in mind that you ${fact.toLowerCase()}.`,
        `Noted! I'll remember that about you.`,
        `I'll remember that for future conversations.`,
        `I've made a note of that preference!`
    ];
    
    return acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
}

// ============================================================================
// ENHANCED MEMORY & AWARENESS FUNCTIONS
// ============================================================================

// Update or create user profile
async function updateUserProfile(userId, username, updates = {}) {
    return new Promise((resolve, reject) => {
        const now = Date.now();

        aiDb.get('SELECT * FROM user_profiles WHERE user_id = ?', [userId], (err, profile) => {
            if (err) return reject(err);

            if (!profile) {
                // Create new profile
                aiDb.run(`
                    INSERT INTO user_profiles
                    (user_id, username, first_interaction, last_interaction, total_messages, updated_at)
                    VALUES (?, ?, ?, ?, 1, ?)
                `, [userId, username, now, now, now], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else {
                // Update existing profile
                const fields = [];
                const values = [];

                if (updates.birthday) {
                    fields.push('birthday = ?');
                    values.push(updates.birthday);
                }
                if (updates.birthday_year) {
                    fields.push('birthday_year = ?');
                    values.push(updates.birthday_year);
                }
                if (updates.timezone) {
                    fields.push('timezone = ?');
                    values.push(updates.timezone);
                }

                // Always update these
                fields.push('username = ?', 'last_interaction = ?', 'total_messages = total_messages + 1', 'updated_at = ?');
                values.push(username, now, now);

                // Calculate relationship strength (more interactions = stronger)
                const daysSinceFirst = (now - profile.first_interaction) / (1000 * 60 * 60 * 24);
                const messagesPerDay = (profile.total_messages + 1) / Math.max(daysSinceFirst, 1);
                const relationshipStrength = Math.min(messagesPerDay * 0.1, 1.0);

                fields.push('relationship_strength = ?');
                values.push(relationshipStrength);

                values.push(userId);

                aiDb.run(`
                    UPDATE user_profiles
                    SET ${fields.join(', ')}
                    WHERE user_id = ?
                `, values, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        });
    });
}

// Track an interaction in timeline
async function trackInteraction(userId, channelId, interactionType = 'message', emotionalTone = null) {
    return new Promise((resolve, reject) => {
        aiDb.run(`
            INSERT INTO interaction_timeline
            (user_id, timestamp, channel_id, interaction_type, emotional_tone)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, Date.now(), channelId, interactionType, emotionalTone], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Store a special date (birthday, anniversary, etc.)
async function storeSpecialDate(userId, dateType, timestamp, description = null, recurring = true) {
    return new Promise((resolve, reject) => {
        aiDb.run(`
            INSERT INTO special_dates
            (user_id, date_type, date_timestamp, description, recurring, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [userId, dateType, timestamp, description, recurring ? 1 : 0, Date.now()], (err) => {
            if (err) reject(err);
            else {
                console.log(`🎂 Stored ${dateType} for user ${userId}`);
                resolve();
            }
        });
    });
}

// Get user's profile with memories
async function getUserProfile(userId) {
    return new Promise((resolve, reject) => {
        aiDb.get('SELECT * FROM user_profiles WHERE user_id = ?', [userId], (err, profile) => {
            if (err) return reject(err);
            resolve(profile);
        });
    });
}

// Check for upcoming birthdays or special dates
async function getUpcomingEvents(userId, daysAhead = 7) {
    return new Promise((resolve, reject) => {
        const now = new Date();
        const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));

        aiDb.all(`
            SELECT * FROM special_dates
            WHERE user_id = ?
            AND date_timestamp BETWEEN ? AND ?
            ORDER BY date_timestamp ASC
        `, [userId, now.getTime(), futureDate.getTime()], (err, events) => {
            if (err) reject(err);
            else resolve(events || []);
        });
    });
}

// Get time-based context for personality
function getTemporalContext() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const date = now.getDate();
    const month = now.getMonth();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
    const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];

    let timeOfDay;
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    let season;
    if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else if (month >= 8 && month <= 10) season = 'fall';
    else season = 'winter';

    return {
        hour,
        timeOfDay,
        dayName,
        monthName,
        date,
        season,
        formatted: `${dayName}, ${monthName} ${date}`,
        timeString: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };
}

// Enhanced memory triggers - now including birthdays
async function enhancedProcessMemoryTriggers(userId, userMessage, username) {
    const lowerMessage = userMessage.toLowerCase();

    // Birthday detection patterns
    const birthdayPatterns = [
        /my birthday is (?:on )?(\w+ \d+)/i,
        /i was born (?:on )?(\w+ \d+)/i,
        /birthday.*?(\w+ \d+)/i,
        /born (?:in|on) (\w+ \d+)/i
    ];

    for (const pattern of birthdayPatterns) {
        const match = userMessage.match(pattern);
        if (match) {
            try {
                const dateStr = match[1];
                const parsedDate = new Date(dateStr + ', 2000'); // Use dummy year for parsing

                if (!isNaN(parsedDate.getTime())) {
                    const birthdayTimestamp = parsedDate.getTime();
                    await storeSpecialDate(userId, 'birthday', birthdayTimestamp, `${username}'s birthday`, true);
                    await updateUserProfile(userId, username, { birthday: birthdayTimestamp });
                    await storeUserFact(userId, `Birthday is on ${dateStr}`, 'personal', 1.0, 'detected');
                    console.log(`🎂 Detected birthday for ${username}: ${dateStr}`);
                    return true;
                }
            } catch (err) {
                console.error('Error parsing birthday:', err);
            }
        }
    }

    return false;
}

// Get relationship context for a user
async function getRelationshipContext(userId) {
    const profile = await getUserProfile(userId);
    if (!profile) return null;

    const now = Date.now();
    const daysSinceFirst = (now - profile.first_interaction) / (1000 * 60 * 60 * 24);
    const daysSinceLast = (now - profile.last_interaction) / (1000 * 60 * 60 * 24);

    let relationshipLevel;
    if (profile.relationship_strength > 0.7) relationshipLevel = 'close friend';
    else if (profile.relationship_strength > 0.4) relationshipLevel = 'friend';
    else if (profile.relationship_strength > 0.1) relationshipLevel = 'acquaintance';
    else relationshipLevel = 'new person';

    let timeSinceLastChat;
    if (daysSinceLast < 0.04) timeSinceLastChat = 'just now';
    else if (daysSinceLast < 1) timeSinceLastChat = 'today';
    else if (daysSinceLast < 7) timeSinceLastChat = `${Math.floor(daysSinceLast)} day(s) ago`;
    else if (daysSinceLast < 30) timeSinceLastChat = `${Math.floor(daysSinceLast / 7)} week(s) ago`;
    else timeSinceLastChat = 'a long time ago';

    return {
        relationshipLevel,
        timeSinceLastChat,
        totalMessages: profile.total_messages,
        daysSinceFirst: Math.floor(daysSinceFirst),
        shouldGreet: daysSinceLast > 1 // Haven't talked in over a day
    };
}

// ============================================================================
// PHASE 2: PROACTIVE MEMORY & CURIOSITY SYSTEM
// ============================================================================

// Get relevant old memories that might be worth bringing up
async function getRelevantMemories(userId, currentMessage, limit = 3) {
    return new Promise((resolve, reject) => {
        const lowerMessage = currentMessage.toLowerCase();

        // Get all memories and rank by relevance
        aiDb.all(
            `SELECT m.*,
                    (julianday('now') - julianday(m.last_accessed / 1000, 'unixepoch')) as days_since_accessed
             FROM user_memory m
             WHERE m.user_id = ?
             ORDER BY days_since_accessed DESC, m.confidence DESC
             LIMIT 20`,
            [userId],
            async (err, memories) => {
                if (err) return reject(err);

                if (!memories || memories.length === 0) {
                    return resolve([]);
                }

                // Score memories based on relevance to current conversation
                const scoredMemories = memories.map(memory => {
                    let score = 0;
                    const memoryWords = memory.fact.toLowerCase().split(/\s+/);
                    const messageWords = lowerMessage.split(/\s+/);

                    // Check for word overlap
                    for (const word of memoryWords) {
                        if (word.length > 3 && messageWords.includes(word)) {
                            score += 2;
                        }
                    }

                    // Boost score for old, unaccessed memories (bring up forgotten things)
                    if (memory.days_since_accessed > 7) score += 1;
                    if (memory.days_since_accessed > 30) score += 2;

                    // Boost score based on confidence
                    score += memory.confidence;

                    return { ...memory, relevance_score: score };
                });

                // Return top relevant memories
                const relevant = scoredMemories
                    .filter(m => m.relevance_score > 0.5)
                    .sort((a, b) => b.relevance_score - a.relevance_score)
                    .slice(0, limit);

                resolve(relevant);
            }
        );
    });
}

// Generate follow-up questions based on memories
async function generateFollowUpContext(userId, username) {
    return new Promise((resolve, reject) => {
        // Get recent memories that might need follow-up
        const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);

        aiDb.all(
            `SELECT * FROM user_memory
             WHERE user_id = ?
             AND created_at > ?
             AND created_at < ?
             AND (category = 'preference' OR category = 'history' OR category = 'trait')
             ORDER BY created_at DESC
             LIMIT 5`,
            [userId, twoWeeksAgo, twoDaysAgo],
            (err, memories) => {
                if (err) return reject(err);

                if (!memories || memories.length === 0) {
                    return resolve(null);
                }

                // Pick a random memory to ask about
                const memory = memories[Math.floor(Math.random() * memories.length)];
                const daysSince = Math.floor((Date.now() - memory.created_at) / (1000 * 60 * 60 * 24));

                resolve({
                    fact: memory.fact,
                    daysSince,
                    category: memory.category,
                    suggestion: `You mentioned something ${daysSince} day(s) ago about: "${memory.fact}". Consider asking how it's going or bringing it up naturally.`
                });
            }
        );
    });
}

// Detect when Ochako should be curious and ask questions
function shouldShowCuriosity(message) {
    const lowerMessage = message.toLowerCase();

    // Things that should trigger curiosity
    const curiosityTriggers = [
        /playing (\w+)/i,           // "playing valorant"
        /watching (\w+)/i,          // "watching demon slayer"
        /reading (\w+)/i,           // "reading a book"
        /learning (\w+)/i,          // "learning python"
        /got a new (\w+)/i,         // "got a new guitar"
        /started (\w+)/i,           // "started working out"
        /joined (\w+)/i,            // "joined a gym"
        /bought (\w+)/i,            // "bought a car"
        /visiting (\w+)/i,          // "visiting paris"
        /tried (\w+)/i,             // "tried sushi"
    ];

    for (const pattern of curiosityTriggers) {
        if (pattern.test(lowerMessage)) {
            return true;
        }
    }

    return false;
}

// Extract topics she doesn't know about yet
async function detectUnknownTopics(userId, message) {
    const lowerMessage = message.toLowerCase();

    // Common topics that might be mentioned
    const topicPatterns = {
        games: /(?:playing|play) ([\w\s]+?)(?:\s|$|,|\.|with|on)/i,
        shows: /(?:watching|watch) ([\w\s]+?)(?:\s|$|,|\.|on)/i,
        hobbies: /(?:into|enjoy|love|like) ([\w\s]+?)(?:\s|$|,|\.)/i,
        places: /(?:visiting|visited|going to|went to) ([\w\s]+?)(?:\s|$|,|\.)/i,
        food: /(?:eating|ate|tried|trying) ([\w\s]+?)(?:\s|$|,|\.)/i
    };

    const unknownTopics = [];

    for (const [category, pattern] of Object.entries(topicPatterns)) {
        const match = message.match(pattern);
        if (match && match[1]) {
            const topic = match[1].trim();

            // Check if she already knows about this
            const exists = await new Promise((resolve) => {
                aiDb.get(
                    'SELECT * FROM user_memory WHERE user_id = ? AND fact LIKE ?',
                    [userId, `%${topic}%`],
                    (err, row) => resolve(!!row)
                );
            });

            if (!exists && topic.length > 2) {
                unknownTopics.push({ category, topic });
            }
        }
    }

    return unknownTopics;
}

// Generate curiosity prompt for unknown topics
function getCuriosityPrompt(unknownTopics) {
    if (unknownTopics.length === 0) return '';

    const topic = unknownTopics[0]; // Focus on first unknown thing

    return `\n\nNOTE: They mentioned "${topic.topic}" which you don't know about. You can:
- Ask what it is (if genuinely curious)
- Show mild interest naturally
- Or just acknowledge it casually
Don't force it - only ask if it flows naturally with your personality!`;
}

// Track conversation patterns and topics
async function analyzeConversationPatterns(userId) {
    return new Promise((resolve, reject) => {
        // Get recent conversation timeline
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);

        aiDb.all(
            `SELECT * FROM interaction_timeline
             WHERE user_id = ?
             AND timestamp > ?
             ORDER BY timestamp DESC
             LIMIT 50`,
            [userId, threeDaysAgo],
            (err, interactions) => {
                if (err) return reject(err);

                if (!interactions || interactions.length === 0) {
                    return resolve(null);
                }

                // Analyze patterns
                const totalInteractions = interactions.length;
                const timeSpan = interactions[0].timestamp - interactions[interactions.length - 1].timestamp;
                const averageGap = timeSpan / totalInteractions;

                // Determine if user is very active recently
                const isVeryActive = totalInteractions > 20 && averageGap < (2 * 60 * 60 * 1000); // More than 20 messages, avg gap < 2 hours

                resolve({
                    totalInteractions,
                    averageGap,
                    isVeryActive,
                    recentEngagement: totalInteractions > 10 ? 'high' : (totalInteractions > 3 ? 'medium' : 'low')
                });
            }
        );
    });
}

// ============================================================================
// PHASE 3: BIRTHDAY CELEBRATIONS & PATTERN RECOGNITION
// ============================================================================

// Check for today's birthdays
async function checkTodaysBirthdays() {
    return new Promise((resolve, reject) => {
        const today = new Date();
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();

        aiDb.all(`
            SELECT p.*, sd.date_timestamp
            FROM user_profiles p
            JOIN special_dates sd ON p.user_id = sd.user_id
            WHERE sd.date_type = 'birthday'
            AND p.last_birthday_wish IS NULL OR p.last_birthday_wish < ?
        `, [Date.now() - (350 * 24 * 60 * 60 * 1000)], // Not wished in last 350 days
        (err, profiles) => {
            if (err) return reject(err);

            const birthdays = profiles.filter(p => {
                const bday = new Date(p.date_timestamp);
                return bday.getMonth() === todayMonth && bday.getDate() === todayDate;
            });

            resolve(birthdays);
        });
    });
}

// Mark birthday as celebrated
async function markBirthdayCelebrated(userId) {
    return new Promise((resolve, reject) => {
        aiDb.run(
            'UPDATE user_profiles SET last_birthday_wish = ? WHERE user_id = ?',
            [Date.now(), userId],
            (err) => err ? reject(err) : resolve()
        );
    });
}

// Detect user activity patterns
async function detectActivityPattern(userId) {
    return new Promise((resolve, reject) => {
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        aiDb.all(`
            SELECT * FROM interaction_timeline
            WHERE user_id = ? AND timestamp > ?
            ORDER BY timestamp ASC
        `, [userId, oneWeekAgo], (err, interactions) => {
            if (err) return reject(err);
            if (!interactions || interactions.length < 5) {
                return resolve(null); // Not enough data
            }

            // Analyze time-of-day patterns
            const hourCounts = {};
            interactions.forEach(i => {
                const hour = new Date(i.timestamp).getHours();
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            });

            // Find peak activity hour
            let peakHour = 0;
            let peakCount = 0;
            for (const [hour, count] of Object.entries(hourCounts)) {
                if (count > peakCount) {
                    peakCount = count;
                    peakHour = parseInt(hour);
                }
            }

            // Detect day-of-week patterns
            const dayCounts = {};
            interactions.forEach(i => {
                const day = new Date(i.timestamp).getDay();
                dayCounts[day] = (dayCounts[day] || 0) + 1;
            });

            const pattern = {
                peakHour,
                peakCount,
                totalInteractions: interactions.length,
                averagePerDay: interactions.length / 7,
                mostActiveDay: Object.keys(dayCounts).reduce((a, b) => dayCounts[a] > dayCounts[b] ? a : b),
                confidence: Math.min(interactions.length / 20, 1.0) // More data = higher confidence
            };

            resolve(pattern);
        });
    });
}

// Store detected pattern
async function storeActivityPattern(userId, patternType, patternData, confidence = 0.5) {
    return new Promise((resolve, reject) => {
        aiDb.run(`
            INSERT INTO user_activity_patterns (user_id, pattern_type, pattern_data, detected_at, confidence)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, pattern_type)
            DO UPDATE SET pattern_data = ?, detected_at = ?, confidence = ?
        `, [
            userId, patternType, JSON.stringify(patternData), Date.now(), confidence,
            JSON.stringify(patternData), Date.now(), confidence
        ], (err) => err ? reject(err) : resolve());
    });
}

// Get stored pattern
async function getActivityPattern(userId, patternType) {
    return new Promise((resolve, reject) => {
        aiDb.get(
            'SELECT * FROM user_activity_patterns WHERE user_id = ? AND pattern_type = ?',
            [userId, patternType],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                try {
                    row.pattern_data = JSON.parse(row.pattern_data);
                    resolve(row);
                } catch (e) {
                    resolve(null);
                }
            }
        );
    });
}

// Detect sentiment from message (simple keyword-based for now)
function detectSentiment(message) {
    const lowerMessage = message.toLowerCase();

    const positiveWords = ['happy', 'great', 'awesome', 'love', 'amazing', 'good', 'excited', 'yay', 'nice', 'perfect', 'thanks', 'thank you'];
    const negativeWords = ['sad', 'bad', 'hate', 'awful', 'terrible', 'angry', 'mad', 'upset', 'ugh', 'annoyed', 'frustrated', 'stressed'];
    const neutralWords = ['okay', 'fine', 'alright', 'maybe', 'idk', 'dunno'];

    let score = 0;
    positiveWords.forEach(word => { if (lowerMessage.includes(word)) score += 1; });
    negativeWords.forEach(word => { if (lowerMessage.includes(word)) score -= 1; });

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
}

// Get recent emotional context for user
async function getEmotionalContext(userId) {
    return new Promise((resolve, reject) => {
        const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);

        aiDb.all(`
            SELECT sentiment, timestamp
            FROM conversation_context
            WHERE user_id = ? AND timestamp > ? AND sentiment IS NOT NULL
            ORDER BY timestamp DESC
            LIMIT 10
        `, [userId, twoDaysAgo], (err, rows) => {
            if (err) return reject(err);
            if (!rows || rows.length === 0) return resolve(null);

            // Count sentiment types
            const sentiments = { positive: 0, negative: 0, neutral: 0 };
            rows.forEach(r => {
                if (r.sentiment) sentiments[r.sentiment] = (sentiments[r.sentiment] || 0) + 1;
            });

            const total = rows.length;
            const dominant = Object.keys(sentiments).reduce((a, b) => sentiments[a] > sentiments[b] ? a : b);

            resolve({
                dominant,
                positive: sentiments.positive / total,
                negative: sentiments.negative / total,
                neutral: sentiments.neutral / total,
                recentMessages: rows.length
            });
        });
    });
}

// Generate pattern-based greeting
async function getPatternBasedGreeting(userId, username) {
    const pattern = await getActivityPattern(userId, 'time_of_day');
    const emotional = await getEmotionalContext(userId);

    if (!pattern) return null;

    const currentHour = new Date().getHours();
    const patternData = pattern.pattern_data;

    // If they usually chat at a different time
    if (Math.abs(currentHour - patternData.peakHour) > 3) {
        return {
            observation: `You're up ${currentHour < patternData.peakHour ? 'early' : 'late'} today!`,
            confidence: pattern.confidence
        };
    }

    // If emotional context is negative lately
    if (emotional && emotional.dominant === 'negative' && emotional.negative > 0.5) {
        return {
            observation: `You've seemed a bit down lately, everything okay?`,
            confidence: emotional.negative
        };
    }

    // If very active recently
    if (patternData.averagePerDay > 5) {
        return {
            observation: `We've been chatting a lot lately huh`,
            confidence: pattern.confidence
        };
    }

    return null;
}

// ============================================================================
// MAINTENANCE FUNCTIONS
// ============================================================================

// Periodically cleanup old context
function scheduleContextCleanup() {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    setInterval(() => {
        const cutoffTime = Date.now() - (7 * ONE_DAY); // 7 days old
        
        aiDb.run(
            'DELETE FROM conversation_context WHERE timestamp < ?',
            [cutoffTime],
            function(err) {
                if (err) {
                    console.error('❌ Error cleaning up old context:', err);
                } else if (this.changes > 0) {
                    console.log(`🧹 Cleaned up ${this.changes} old conversation messages`);
                }
            }
        );
    }, ONE_DAY);
}

// Check for birthdays daily and send wishes
function scheduleBirthdayCheck() {
    const ONE_HOUR = 60 * 60 * 1000;

    // Check every hour (in case bot restarts, won't miss birthdays)
    setInterval(async () => {
        try {
            const birthdays = await checkTodaysBirthdays();

            if (birthdays && birthdays.length > 0) {
                console.log(`🎂 Found ${birthdays.length} birthday(s) today!`);

                for (const profile of birthdays) {
                    await sendBirthdayWish(profile.user_id, profile.username);
                    await markBirthdayCelebrated(profile.user_id);
                }
            }
        } catch (error) {
            console.error('❌ Error checking birthdays:', error);
        }
    }, ONE_HOUR);

    // Also check immediately on startup
    setTimeout(async () => {
        try {
            const birthdays = await checkTodaysBirthdays();
            if (birthdays && birthdays.length > 0) {
                console.log(`🎂 Found ${birthdays.length} birthday(s) today on startup!`);
                for (const profile of birthdays) {
                    await sendBirthdayWish(profile.user_id, profile.username);
                    await markBirthdayCelebrated(profile.user_id);
                }
            }
        } catch (error) {
            console.error('❌ Error checking birthdays on startup:', error);
        }
    }, 5000); // Check 5 seconds after bot starts
}

// Send birthday wish to user
async function sendBirthdayWish(userId, username) {
    try {
        // Try to get user from any guild
        const guilds = client.guilds.cache;
        let user = null;

        for (const guild of guilds.values()) {
            try {
                const member = await guild.members.fetch(userId);
                if (member) {
                    user = member.user;
                    break;
                }
            } catch (e) {
                // User not in this guild, try next
            }
        }

        if (!user) {
            console.log(`❌ Could not find user ${userId} to send birthday wish`);
            return;
        }

        // Generate personalized birthday message using AI
        const birthdayPrompt = `Generate a warm, friendly birthday message for ${username}.
        Keep it short (1-2 sentences), casual, and genuine.
        Use Ochako's personality (16-year-old girl, sassy but kind).
        Examples: "happy birthday! hope you have an awesome day 🎉" or "omg it's your birthday! have the best day ever 🎂"
        Don't use their name in the message.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: personality },
                { role: 'user', content: birthdayPrompt }
            ],
            temperature: 1.0,
            max_tokens: 100
        });

        const birthdayMessage = response.choices[0].message.content;

        // Send DM
        await user.send(birthdayMessage);
        console.log(`🎂 Sent birthday wish to ${username}`);

        // Store as a special memory
        await storeUserFact(userId, `Birthday celebrated on ${new Date().toLocaleDateString()}`, 'event', 1.0, 'birthday_wish');

    } catch (error) {
        console.error(`❌ Error sending birthday wish to ${username}:`, error);
    }
}

// ============================================================================
// RANDOM CHAT FUNCTIONS
// ============================================================================

// Schedule random message sending
function scheduleRandomMessage() {
    const delay = Math.random() * (MAX_MESSAGE_INTERVAL - MIN_MESSAGE_INTERVAL) + MIN_MESSAGE_INTERVAL;

    setTimeout(async () => {
        try {
            // Pick a random channel
            const channelId = RANDOM_CHAT_CHANNELS[Math.floor(Math.random() * RANDOM_CHAT_CHANNELS.length)];
            const channel = client.channels.cache.get(channelId);

            if (!channel) {
                scheduleRandomMessage();
                return;
            }

            // Check if appropriate to send
            if (!await shouldSendRandomMessage(channelId)) {
                scheduleRandomMessage();
                return;
            }

            // Generate and send message
            const message = await generateRandomMessage(channel);
            const sentMessage = await channel.send(message);

            // Store in conversation context
            await storeConversationMessage(
                channelId,
                sentMessage.id,
                client.user.id,
                client.user.username,
                message,
                true
            );

            // Mark as recently active
            recentlyActive.add(channelId);
            setTimeout(() => recentlyActive.delete(channelId), 600000); // 10 minute cooldown

            console.log(`🤖 Sent random message to ${channel.name}`);
        } catch (error) {
            console.error('❌ Error sending random message:', error);
        }

        // Schedule next random message
        scheduleRandomMessage();
    }, delay);
}

// Check if appropriate to send random message
async function shouldSendRandomMessage(channelId) {
    // Get recent conversation activity
    const recentContext = await getChannelContext(channelId, 10);
    if (recentContext.length === 0) return false;

    // Check last message time
    const lastMessageTime = recentContext[recentContext.length - 1].timestamp || 0;
    const timeSinceLastMessage = Date.now() - lastMessageTime;

    // Don't send if conversation is too old (> 2 hours) or too recent (< 2 minutes)
    if (timeSinceLastMessage > 7200000 || timeSinceLastMessage < 120000) return false;

    // Check if bot last message was too recent
    const lastBotMessage = recentContext.filter(msg => msg.is_bot).pop();
    if (lastBotMessage) {
        const timeSinceBotMessage = Date.now() - (lastBotMessage.timestamp || 0);
        if (timeSinceBotMessage < 600000) return false; // 10 minute cooldown
    }

    // Check active users
    const activeUsers = await getActiveUsersInConversation(channelId, 3600000); // 1 hour
    return activeUsers.length >= 2; // At least 2 people talking
}

// Enhanced random message with context awareness
async function generateRandomMessage(channel) {
    try {
        // Get conversation context
        const recentContext = await getChannelContext(channel.id, 10);
        const activeUsers = await getActiveUsersInConversation(channel.id);

        // Sometimes reference recent conversation (30% chance)
        if (Math.random() < 0.3 && recentContext.length > 0) {
            const recentTopics = recentContext.map(msg => msg.content).join(' ');

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: casualPersonality +
                        '\n\nYou want to jump into the conversation naturally. Reference something that was said earlier or ask a follow-up question. Keep it short and casual.'
                    },
                    ...recentContext.slice(-5).map(msg => ({
                        role: msg.is_bot ? 'assistant' : 'user',
                        content: msg.is_bot ? msg.content : `${msg.username}: ${msg.content}`
                    })),
                    {
                        role: 'user',
                        content: 'Generate a natural message to continue or revive this conversation'
                    }
                ],
                temperature: 0.9,
                max_tokens: 100
            });

            return response.choices[0].message.content;
        }

        // Otherwise use time-based starter
        return getTimeBasedStarter();
    } catch (error) {
        console.error('❌ Error generating random message:', error);
        return getTimeBasedStarter();
    }
}

// Remove user memory by keyword
async function removeUserMemory(userId, keyword) {
    return new Promise((resolve, reject) => {
        aiDb.run(
            'DELETE FROM user_memory WHERE user_id = ? AND fact LIKE ?',
            [userId, `%${keyword}%`],
            function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            }
        );
    });
}


// ============================================================================
// SHOP SYSTEM & CURRENCY MANAGEMENT
// ============================================================================
// This section handles the dual currency system (Mochi & Waterlily),
// shop interfaces, purchasing logic, and inventory management
// ============================================================================

// ============================================================================
// CURRENCY & PRIZE CONFIGURATION
// ============================================================================

// Valid button IDs for shop interactions
const validButtonIds = [
    // Regular shop items
    'item1', 'item2', 'item3', 'item4', 'item5',
    // Waterlily shop items
    'witem1', 'witem2', 'witem3', 'witem4', 'witem5',
    // Equipment items (populated dynamically from database)
    'sword_basic', 'helm_basic', 'ring_power', 'amulet_speed',
    'helmet', 'chest', 'chest_golden',
    // Control buttons
    'yes', 'no'
];

// ============================================================================
// DATABASE HELPER FUNCTIONS
// ============================================================================

// Get user data including both currencies
async function getUserData(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE Discord = ?', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Get item data from appropriate shop
async function getItemData(itemId, shopType = 'mochi') {
    const table = shopType === 'mochi' ? 'items' : 'waterlily_items';
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM ${table} WHERE id = ?`, [itemId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Get user's complete inventory with version information
async function getUserInventory(userId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                ui.item_id,
                ui.quantity,
                ui.shop_type,
                COALESCE(iv.name, 
                    CASE 
                        WHEN ui.shop_type = 'mochi' THEN mi.name 
                        ELSE wi.name 
                    END
                ) as name,
                iv.rarity,
                iv.attack,
                iv.defense,
                iv.speed,
                iv.icon,
                iv.slot_id
            FROM user_inventory ui
            LEFT JOIN item_versions iv ON ui.version_id = iv.id
            LEFT JOIN items mi ON ui.item_id = mi.id AND ui.shop_type = 'mochi'
            LEFT JOIN waterlily_items wi ON ui.item_id = wi.id AND ui.shop_type = 'waterlily'
            WHERE ui.Discord = ?
        `, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}


// ============================================================================
// SHOP INTERFACE CREATION
// ============================================================================

// Create main Mochi shop embed
async function createShopEmbed(items) {
    return new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle("Welcome to the Mochi Shop 🍡")
        .setAuthor({ name: 'Ochako', iconURL: 'https://i.ibb.co/12pTrGx/Unknown.jpg'})
        .setDescription("Click the buttons below to buy items with Mochi.")
        .setThumbnail('https://i.ibb.co/12pTrGx/Unknown.jpg')
        .addFields(
            {
                name: "Regular Items",
                value: Object.values(items).length > 0 ? 
                    Object.values(items).map(item => 
                        `${item.name} - ${item.cost} Mochi (Available: ${item.available})`
                    ).join('\n') : 'No items available',
                inline: false
            }
        )
        .setImage('https://i.ibb.co/hBx94Qy/photo-6082118482700387897-y.jpg')
        .setTimestamp();
}

// Create Waterlily shop embed
function createWaterlilyShopEmbed(items) {
    return new EmbedBuilder()
        .setColor(0x4CA3DD)
        .setTitle("Welcome to the Waterlily Shop 🌺")
        .setAuthor({ name: 'Ochako', iconURL: 'https://i.ibb.co/jbMvdF0/c604f7b4-b3db-4b59-ac3b-c5a231c500ee.jpg'})
        .setDescription("Click the buttons below to buy items with Waterlily (WL)")
        .setThumbnail('https://i.ibb.co/jbMvdF0/c604f7b4-b3db-4b59-ac3b-c5a231c500ee.jpg')
        .addFields(
            { name: "Items Available", value: `
                1. ${items.witem1.name} - ${items.witem1.cost} WL (Available: ${items.witem1.available})\n
                2. ${items.witem2.name} - ${items.witem2.cost} WL (Available: ${items.witem2.available})\n
                3. ${items.witem3.name} - ${items.witem3.cost} WL (Available: ${items.witem3.available})\n
                4. ${items.witem4.name} - ${items.witem4.cost} WL (Available: ${items.witem4.available})\n
                5. ${items.witem5.name} - ${items.witem5.cost} WL (Available: ${items.witem5.available})
            ` }
        )
        .setImage('https://i.ibb.co/hBx94Qy/photo-6082118482700387897-y.jpg')
        .setTimestamp();
}

// Create Equipment shop embed
async function createEquipmentShopEmbed() {
    const items = await new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM equipment_items
            WHERE available > 0
            ORDER BY slot_id, cost
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    // Group items by equipment slot
    const itemsBySlot = items.reduce((acc, item) => {
        if (!acc[item.slot_id]) acc[item.slot_id] = [];
        acc[item.slot_id].push(item);
        return acc;
    }, {});

    const embed = new EmbedBuilder()
        .setColor(0xFF9933)
        .setTitle("🛡️ Equipment Shop")
        .setAuthor({ name: 'Ochako', iconURL: 'https://i.ibb.co/12pTrGx/Unknown.jpg'})
        .setDescription("Browse and purchase powerful equipment with Mochi!")
        .setThumbnail('https://i.ibb.co/12pTrGx/Unknown.jpg');

    // Slot display order and icons
    const slotOrder = [
        { id: 'weapon', name: 'Weapons', icon: '⚔️' },
        { id: 'head', name: 'Helmets', icon: '🎭' },
        { id: 'chest', name: 'Armor', icon: '🦺' },
        { id: 'hands', name: 'Gloves', icon: '🧤' },
        { id: 'neck', name: 'Amulets', icon: '📿' },
        { id: 'ring', name: 'Rings', icon: '💍' }
    ];

    // Add fields for each equipment slot that has items
    slotOrder.forEach(slot => {
        const slotItems = itemsBySlot[slot.id] || [];
        if (slotItems.length > 0) {
            embed.addFields({
                name: `${slot.icon} ${slot.name}`,
                value: slotItems.map(item => {
                    const stats = [];
                    if (item.attack) stats.push(`⚔️${item.attack}`);
                    if (item.defense) stats.push(`🛡️${item.defense}`);
                    if (item.speed) stats.push(`⚡${item.speed}`);
                    return `${item.name} - ${item.cost} Mochi [${item.rarity}]\n` +
                           `Stats: ${stats.join(' ')}\n` +
                           `Available: ${item.available}`;
                }).join('\n\n'),
                inline: false
            });
        }
    });

    return embed;
}

// ============================================================================
// SHOP BUTTON CREATION
// ============================================================================

// Create buttons for Mochi shop (includes equipment)
async function createShopButtons(items) {
    // Get equipment info for all items
    const equipmentInfo = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM equipment_items', (err, rows) => {
            if (err) reject(err);
            else {
                const equipMap = {};
                rows.forEach(row => {
                    equipMap[row.id] = row;
                });
                resolve(equipMap);
            }
        });
    });

    // Separate regular items and equipment
    const regularItems = [];
    const equipmentItems = [];

    Object.entries(items).forEach(([id, item]) => {
        if (equipmentInfo[id]) {
            equipmentItems.push({
                ...item,
                ...equipmentInfo[id]
            });
        } else {
            regularItems.push({
                ...item,
                id: id
            });
        }
    });

    const rows = [];

    // Create rows for regular items (5 buttons per row)
    let currentRow = new ActionRowBuilder();
    regularItems.forEach((item, index) => {
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(item.id)
                .setLabel(`${item.name} - ${item.cost} Mochi`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(item.available <= 0)
        );

        if (currentRow.components.length === 5 || index === regularItems.length - 1) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
    });

    // Sort equipment by slot for organized display
    const sortedEquipment = equipmentItems.sort((a, b) => {
        const slotOrder = ['head', 'neck', 'chest', 'hands', 'ring', 'weapon'];
        return slotOrder.indexOf(a.slot_id) - slotOrder.indexOf(b.slot_id);
    });

    // Create rows for equipment items (5 buttons per row)
    currentRow = new ActionRowBuilder();
    sortedEquipment.forEach((item, index) => {
        const slotEmoji = {
            head: '🎭',
            neck: '📿',
            chest: '🦺',
            hands: '🧤',
            ring: '💍',
            weapon: '⚔️'
        }[item.slot_id] || '🔰';

        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(item.id)
                .setLabel(`${item.name} - ${item.cost} Mochi`)
                .setEmoji(slotEmoji)
                .setStyle(ButtonStyle.Success)
                .setDisabled(item.available <= 0)
        );

        if (currentRow.components.length === 5 || index === sortedEquipment.length - 1) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
    });

    // Remove any empty rows
    return rows.filter(row => row.components.length > 0);
}

// Create buttons for Waterlily shop
function createWaterlilyShopButtons(items) {
    const itemButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('witem1')
                .setLabel(`${items.witem1.name} - ${items.witem1.cost} WL`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(items.witem1.available <= 0),
            new ButtonBuilder()
                .setCustomId('witem2')
                .setLabel(`${items.witem2.name} - ${items.witem2.cost} WL`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(items.witem2.available <= 0),
            new ButtonBuilder()
                .setCustomId('witem3')
                .setLabel(`${items.witem3.name} - ${items.witem3.cost} WL`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(items.witem3.available <= 0)
        );

    const itemButtons2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('witem4')
                .setLabel(`${items.witem4.name} - ${items.witem4.cost} WL`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(items.witem4.available <= 0),
            new ButtonBuilder()
                .setCustomId('witem5')
                .setLabel(`${items.witem5.name} - ${items.witem5.cost} WL`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(items.witem5.available <= 0)
        );

    return [itemButtons, itemButtons2];
}

// Create buttons for Equipment shop
async function createEquipmentShopButtons() {
    const items = await new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM equipment_items
            WHERE available > 0
            ORDER BY slot_id, cost
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    const rows = [];
    let currentRow = new ActionRowBuilder();

    items.forEach((item, index) => {
        const slotEmoji = {
            head: '🎭',
            neck: '📿',
            chest: '🦺',
            hands: '🧤',
            ring: '💍',
            weapon: '⚔️'
        }[item.slot_id] || '🔰';

        // Create button with proper customId format
        const button = new ButtonBuilder()
            .setCustomId(`equipment_purchase_${item.id}`)
            .setLabel(`${item.name} - ${item.cost}`)
            .setEmoji(slotEmoji)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(item.available <= 0);

        currentRow.addComponents(button);

        // Create new row when current one is full
        if (currentRow.components.length === 5 || index === items.length - 1) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
    });

    return rows;
}


// ============================================================================
// ADMIN STUFF
// ============================================================================

// Handle admin inventory command
async function handleAdminInventoryCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const targetUser = interaction.options.getUser('user');
        
        // Get user's complete inventory with version information
        const inventory = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    ui.item_id,
                    ui.quantity,
                    ui.shop_type,
                    COALESCE(iv.name, 
                        CASE 
                            WHEN ui.shop_type = 'mochi' THEN mi.name 
                            WHEN ui.shop_type = 'waterlily' THEN wi.name
                            ELSE ei.name
                        END
                    ) as name,
                    iv.rarity,
                    iv.attack,
                    iv.defense,
                    iv.speed,
                    iv.icon,
                    iv.slot_id
                FROM user_inventory ui
                LEFT JOIN item_versions iv ON ui.version_id = iv.id
                LEFT JOIN items mi ON ui.item_id = mi.id AND ui.shop_type = 'mochi'
                LEFT JOIN waterlily_items wi ON ui.item_id = wi.id AND ui.shop_type = 'waterlily'
                LEFT JOIN equipment_items ei ON ui.item_id = ei.id
                WHERE ui.Discord = ?
                ORDER BY ui.shop_type, name
            `, [targetUser.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get user's currency data
        const userData = await getUserData(targetUser.id);

        // Get equipped items
        const equippedItems = await getEquippedItems(targetUser.id);

        // Create response embed
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle(`Admin: ${targetUser.username}'s Inventory`)
            .addFields({
                name: 'Currencies',
                value: `**Mochi**: ${userData?.Tickets || 0}\n**Waterlily**: ${userData?.Waterlily || 0}`,
                inline: false
            });

        // Group items by shop type
        const itemsByType = inventory.reduce((acc, item) => {
            if (!acc[item.shop_type]) acc[item.shop_type] = [];
            acc[item.shop_type].push(item);
            return acc;
        }, {});

        // Add inventory sections
        for (const [shopType, items] of Object.entries(itemsByType)) {
            if (items.length > 0) {
                const typeEmoji = shopType === 'mochi' ? '�' : shopType === 'waterlily' ? '🌺' : '⚔️';
                const itemList = items.map(item => {
                    let itemText = `${item.name} (x${item.quantity})`;
                    if (item.slot_id) {
                        const stats = [];
                        if (item.attack) stats.push(`⚔️${item.attack}`);
                        if (item.defense) stats.push(`🛡️${item.defense}`);
                        if (item.speed) stats.push(`⚡${item.speed}`);
                        itemText += ` [${item.rarity}]`;
                        if (stats.length > 0) itemText += ` (${stats.join(' ')})`;
                    }
                    return itemText;
                }).join('\n');

                embed.addFields({
                    name: `${typeEmoji} ${shopType.charAt(0).toUpperCase() + shopType.slice(1)} Items`,
                    value: itemList.length > 1024 ? itemList.substring(0, 1021) + '...' : itemList,
                    inline: false
                });
            }
        }

        // Add equipped items
        if (equippedItems.length > 0) {
            const equippedList = equippedItems.map(item => {
                const stats = [];
                if (item.attack) stats.push(`⚔️${item.attack}`);
                if (item.defense) stats.push(`🛡️${item.defense}`);
                if (item.speed) stats.push(`⚡${item.speed}`);
                return `${item.slot_id}: ${item.name} [${item.rarity}] (${stats.join(' ') || 'No stats'})`;
            }).join('\n');

            embed.addFields({
                name: '🎽 Equipped Items',
                value: equippedList.length > 1024 ? equippedList.substring(0, 1021) + '...' : equippedList,
                inline: false
            });
        }

        if (inventory.length === 0 && equippedItems.length === 0) {
            embed.addFields({
                name: 'Inventory',
                value: 'User has no items in inventory',
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in admin inventory command:', error);
        await interaction.editReply('An error occurred while fetching user inventory.');
    }
}

// Handle admin update command
async function handleAdminUpdateCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const shopType = interaction.options.getString('shop_type');
        const itemId = interaction.options.getString('item_id');
        const newName = interaction.options.getString('name');
        const newCost = interaction.options.getInteger('cost');
        const newAvailable = interaction.options.getInteger('available');
        const newAttack = interaction.options.getInteger('attack');
        const newDefense = interaction.options.getInteger('defense');
        const newSpeed = interaction.options.getInteger('speed');
        const newRarity = interaction.options.getString('rarity');

        // Determine which table to update
        let table;
        switch (shopType) {
            case 'mochi':
                table = 'items';
                break;
            case 'waterlily':
                table = 'waterlily_items';
                break;
            case 'equipment':
                table = 'equipment_items';
                break;
            default:
                await interaction.editReply('Invalid shop type specified.');
                return;
        }

        // Check if item exists
        const existingItem = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM ${table} WHERE id = ?`, [itemId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!existingItem) {
            await interaction.editReply(`Item with ID "${itemId}" not found in ${shopType} shop.`);
            return;
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (newName !== null) {
            updates.push('name = ?');
            values.push(newName);
        }
        if (newCost !== null) {
            updates.push('cost = ?');
            values.push(newCost);
        }
        if (newAvailable !== null) {
            updates.push('available = ?');
            values.push(newAvailable);
        }

        // Equipment-specific fields
        if (shopType === 'equipment') {
            if (newAttack !== null) {
                updates.push('attack = ?');
                values.push(newAttack);
            }
            if (newDefense !== null) {
                updates.push('defense = ?');
                values.push(newDefense);
            }
            if (newSpeed !== null) {
                updates.push('speed = ?');
                values.push(newSpeed);
            }
            if (newRarity !== null) {
                updates.push('rarity = ?');
                values.push(newRarity);
            }
        }

        if (updates.length === 0) {
            await interaction.editReply('No updates specified.');
            return;
        }

        // Add item ID to values for WHERE clause
        values.push(itemId);

        // Execute update
        await new Promise((resolve, reject) => {
            const query = `UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`;
            db.run(query, values, function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });

        // Create item version if it's equipment and stats were changed
        if (shopType === 'equipment' && (newAttack !== null || newDefense !== null || newSpeed !== null || newRarity !== null)) {
            const updatedItem = await new Promise((resolve, reject) => {
                db.get(`SELECT * FROM ${table} WHERE id = ?`, [itemId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO item_versions (
                        item_id, name, shop_type, rarity, attack, defense, 
                        speed, icon, slot_id, role_id, description
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    itemId, updatedItem.name, 'mochi', updatedItem.rarity, 
                    updatedItem.attack, updatedItem.defense, updatedItem.speed, 
                    updatedItem.icon, updatedItem.slot_id, updatedItem.role_id, 
                    updatedItem.description
                ], err => err ? reject(err) : resolve());
            });
        }

        // Refresh shops if needed
        if (shopType === 'mochi' || shopType === 'equipment') {
            await setupShops();
        } else if (shopType === 'waterlily') {
            await setupWaterlilyShopEmbed();
        }

        // Create success response
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Item Updated Successfully')
            .setDescription(`Updated item "${itemId}" in ${shopType} shop`)
            .addFields(
                { name: 'Item ID', value: itemId, inline: true },
                { name: 'Shop Type', value: shopType, inline: true },
                { name: 'Changes Made', value: updates.map(u => u.split(' = ')[0]).join(', '), inline: false }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Log the update
        const logChannel = interaction.client.channels.cache.get(NOTIFICATION_CHANNEL);
        if (logChannel) {
            await logChannel.send(
                `🔧 **Item Updated**: ${interaction.user.tag} updated "${itemId}" in ${shopType} shop`
            );
        }

    } catch (error) {
        console.error('Error in admin update command:', error);
        await interaction.editReply('An error occurred while updating the item.');
    }
}

// Handle admin search item command
async function handleAdminSearchItemCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const query = interaction.options.getString('query').toLowerCase();
        
        // Search in all item tables
        const [mochiItems, waterlilyItems, equipmentItems] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all(
                    'SELECT id, name, cost, available, "mochi" as shop_type FROM items WHERE LOWER(name) LIKE ?',
                    [`%${query}%`],
                    (err, rows) => err ? reject(err) : resolve(rows)
                );
            }),
            new Promise((resolve, reject) => {
                db.all(
                    'SELECT id, name, cost, available, "waterlily" as shop_type FROM waterlily_items WHERE LOWER(name) LIKE ?',
                    [`%${query}%`],
                    (err, rows) => err ? reject(err) : resolve(rows)
                );
            }),
            new Promise((resolve, reject) => {
                db.all(
                    'SELECT id, name, cost, available, rarity, attack, defense, speed, slot_id, "equipment" as shop_type FROM equipment_items WHERE LOWER(name) LIKE ?',
                    [`%${query}%`],
                    (err, rows) => err ? reject(err) : resolve(rows)
                );
            })
        ]);

        const allItems = [...mochiItems, ...waterlilyItems, ...equipmentItems];

        if (allItems.length === 0) {
            await interaction.editReply(`No items found matching "${query}".`);
            return;
        }

        // Create results embed
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle(`🔍 Search Results for "${query}"`)
            .setDescription(`Found ${allItems.length} item(s)`);

        // Group results by shop type
        const itemsByShop = allItems.reduce((acc, item) => {
            if (!acc[item.shop_type]) acc[item.shop_type] = [];
            acc[item.shop_type].push(item);
            return acc;
        }, {});

        for (const [shopType, items] of Object.entries(itemsByShop)) {
            const emoji = shopType === 'mochi' ? '�' : shopType === 'waterlily' ? '🌺' : '⚔️';
            
            const itemList = items.map(item => {
                let result = `**${item.name}** (ID: ${item.id})\n`;
                result += `Cost: ${item.cost}, Available: ${item.available}`;
                
                if (item.shop_type === 'equipment') {
                    result += `\nSlot: ${item.slot_id}, Rarity: ${item.rarity}`;
                    const stats = [];
                    if (item.attack) stats.push(`⚔️${item.attack}`);
                    if (item.defense) stats.push(`🛡️${item.defense}`);
                    if (item.speed) stats.push(`⚡${item.speed}`);
                    if (stats.length > 0) result += `\nStats: ${stats.join(' ')}`;
                }
                
                return result;
            }).join('\n\n');

            embed.addFields({
                name: `${emoji} ${shopType.charAt(0).toUpperCase() + shopType.slice(1)} Shop`,
                value: itemList.length > 1024 ? itemList.substring(0, 1021) + '...' : itemList,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in admin search item command:', error);
        await interaction.editReply('An error occurred while searching for items.');
    }
}

// Handle admin items command
async function handleAdminItemsCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        // Get all items from all shops
        const [mochiItems, waterlilyItems, equipmentItems] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all('SELECT *, "mochi" as shop_type FROM items ORDER BY name', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT *, "waterlily" as shop_type FROM waterlily_items ORDER BY name', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT *, "equipment" as shop_type FROM equipment_items ORDER BY slot_id, name', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            })
        ]);

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('🗂️ All Items Database')
            .setDescription(`Total items: ${mochiItems.length + waterlilyItems.length + equipmentItems.length}`);

        // Mochi items
        if (mochiItems.length > 0) {
            const mochiList = mochiItems.map(item => 
                `${item.name} (${item.id}) - ${item.cost} Mochi, Available: ${item.available}`
            ).join('\n');
            
            embed.addFields({
                name: '� Mochi Shop Items',
                value: mochiList.length > 1024 ? mochiList.substring(0, 1021) + '...' : mochiList,
                inline: false
            });
        }

        // Waterlily items
        if (waterlilyItems.length > 0) {
            const waterlilyList = waterlilyItems.map(item => 
                `${item.name} (${item.id}) - ${item.cost} WL, Available: ${item.available}`
            ).join('\n');
            
            embed.addFields({
                name: '🌺 Waterlily Shop Items',
                value: waterlilyList.length > 1024 ? waterlilyList.substring(0, 1021) + '...' : waterlilyList,
                inline: false
            });
        }

        // Equipment items
        if (equipmentItems.length > 0) {
            const equipmentList = equipmentItems.map(item => {
                const stats = [];
                if (item.attack) stats.push(`⚔️${item.attack}`);
                if (item.defense) stats.push(`🛡️${item.defense}`);
                if (item.speed) stats.push(`⚡${item.speed}`);
                
                return `${item.name} (${item.id}) - ${item.cost} Mochi, ${item.slot_id} [${item.rarity}]\n` +
                       `Available: ${item.available}, Stats: ${stats.join(' ') || 'None'}`;
            }).join('\n\n');
            
            embed.addFields({
                name: '⚔️ Equipment Items',
                value: equipmentList.length > 1024 ? equipmentList.substring(0, 1021) + '...' : equipmentList,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in admin items command:', error);
        await interaction.editReply('An error occurred while fetching items database.');
    }
}



// ============================================================================
// PURCHASE PROCESSING
// ============================================================================



// Main purchase function with transaction handling
async function performPurchase(userId, itemId, cost, shopType = 'mochi') {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            const currencyColumn = shopType === 'mochi' ? 'Tickets' : 'Waterlily';
            const itemsTable = shopType === 'mochi' ? 'items' : 'waterlily_items';

            db.run('BEGIN IMMEDIATE TRANSACTION');

            // First check user balance and item availability
            db.get(`SELECT ${currencyColumn} FROM users WHERE Discord = ?`, [userId], (err, user) => {
                if (err || !user || user[currencyColumn] < cost) {
                    db.run('ROLLBACK');
                    return reject(new Error(`Insufficient ${shopType === 'mochi' ? 'Mochi' : 'Waterlily'}`));
                }

                db.get(`
                    SELECT i.*, e.rarity, e.attack, e.defense, e.speed, e.icon, e.slot_id, e.role_id, e.description
                    FROM ${itemsTable} i
                    LEFT JOIN equipment_items e ON i.id = e.id
                    WHERE i.id = ?
                `, [itemId], (err, item) => {
                    if (err || !item || item.available <= 0) {
                        db.run('ROLLBACK');
                        return reject(new Error("Item not available"));
                    }

                    // Create a version of the item for tracking
                    db.run(`
                        INSERT INTO item_versions (
                            item_id, name, shop_type, rarity, attack, defense, 
                            speed, icon, slot_id, role_id, description
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        itemId, item.name, shopType, item.rarity, item.attack, 
                        item.defense, item.speed, item.icon, item.slot_id, 
                        item.role_id, item.description
                    ], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        const versionId = this.lastID;

                        // Update user balance
                        db.run(`UPDATE users SET ${currencyColumn} = ${currencyColumn} - ? WHERE Discord = ?`, 
                            [cost, userId], (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }

                            // Update item availability
                            db.run(`UPDATE ${itemsTable} SET available = available - 1 WHERE id = ?`, 
                                [itemId], (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }

                                // Add to user inventory
                                db.run(`
                                    INSERT INTO user_inventory (Discord, item_id, version_id, quantity, shop_type)
                                    VALUES (?, ?, ?, 1, ?)
                                    ON CONFLICT(Discord, item_id, version_id) 
                                    DO UPDATE SET quantity = quantity + 1
                                `, [userId, itemId, versionId, shopType], async (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }

                                    db.run('COMMIT', async (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }
                                        
                                        // Log the purchase
                                        if (shopType === 'mochi') {
                                            try {
                                                const logChannel = client.channels.cache.get(NOTIFICATION_CHANNEL);
                                                if (logChannel) {
                                                    await logChannel.send(`🛒 **Purchase**: <@${userId}> spent ${cost} Mochi 🍡 on ${item.name}`);
                                                }
                                            } catch (logError) {
                                                console.error('❌ Error logging purchase:', logError);
                                            }
                                        }
                                        
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}


// ============================================================================
// CURRENCY CONVERSION & TRADING
// ============================================================================

// Convert Mochi to Waterlily (3:1 ratio)
async function convertMochiToWaterlily(userId, mochiAmount) {
    if (mochiAmount < 3 || mochiAmount % 3 !== 0) {
        throw new Error('Mochi amount must be divisible by 3');
    }

    const waterlilyAmount = Math.floor(mochiAmount / 3);

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.get('SELECT Tickets FROM users WHERE Discord = ?', [userId], (err, user) => {
                if (err || !user || user.Tickets < mochiAmount) {
                    db.run('ROLLBACK');
                    return reject(new Error('Insufficient Mochi'));
                }

                db.run('UPDATE users SET Tickets = Tickets - ?, Waterlily = Waterlily + ? WHERE Discord = ?',
                    [mochiAmount, waterlilyAmount, userId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                    } else {
                        db.run('COMMIT');
                        resolve({ mochiSpent: mochiAmount, waterlilyReceived: waterlilyAmount });
                    }
                });
            });
        });
    });
}

// Trade Mochi between users
// Updated tradeMochi function with logging
async function tradeMochi(senderId, receiverId, amount) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.get('SELECT Tickets FROM users WHERE Discord = ?', [senderId], (err, senderRow) => {
                if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                }
                if (!senderRow || senderRow.Tickets < amount) {
                    db.run('ROLLBACK');
                    return reject(new Error("You don't have enough Mochi to make this trade."));
                }

                db.run('UPDATE users SET Tickets = Tickets - ? WHERE Discord = ?', [amount, senderId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }

                    db.run(`
                        INSERT INTO users (Discord, Tickets, Waterlily)
                        VALUES (?, ?, 0)
                        ON CONFLICT(Discord)
                        DO UPDATE SET Tickets = Tickets + ?
                    `, [receiverId, amount, amount], async (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        db.run('COMMIT', async (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                            
                            // Log the trade
                            try {
                                const logChannel = client.channels.cache.get(NOTIFICATION_CHANNEL);
                                if (logChannel) {
                                    await logChannel.send(`💱 **Trade**: <@${senderId}> traded ${amount} Mochi 🍡 to <@${receiverId}>`);
                                }
                            } catch (logError) {
                                console.error('❌ Error logging trade:', logError);
                            }
                            
                            resolve();
                        });
                    });
                });
            });
        });
    });
}


// Trade Waterlily between users
async function tradeWaterlily(senderId, receiverId, amount) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.get('SELECT Waterlily FROM users WHERE Discord = ?', [senderId], (err, senderRow) => {
                if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                }
                if (!senderRow || senderRow.Waterlily < amount) {
                    db.run('ROLLBACK');
                    return reject(new Error("You don't have enough Waterlily to make this trade."));
                }

                db.run('UPDATE users SET Waterlily = Waterlily - ? WHERE Discord = ?', [amount, senderId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }

                    db.run(`
                        INSERT INTO users (Discord, Tickets, Waterlily)
                        VALUES (?, 0, ?)
                        ON CONFLICT(Discord)
                        DO UPDATE SET Waterlily = Waterlily + ?
                    `, [receiverId, amount, amount], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        db.run('COMMIT', (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                            resolve();
                        });
                    });
                });
            });
        });
    });
}

// Trade items between users
async function tradeItem(senderId, receiverId, itemName, amount) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Find the item in user's inventory
            db.all(`
                SELECT iv.*, ui.quantity, ui.version_id
                FROM user_inventory ui
                JOIN item_versions iv ON ui.version_id = iv.id
                WHERE ui.Discord = ? AND LOWER(iv.name) = ? COLLATE NOCASE
            `, [senderId, itemName.toLowerCase()], async (err, versions) => {
                if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                }
                if (!versions || versions.length === 0) {
                    db.run('ROLLBACK');
                    return reject(new Error("You don't have this item."));
                }

                // Calculate total quantity across all versions
                const totalQuantity = versions.reduce((sum, ver) => sum + ver.quantity, 0);
                if (totalQuantity < amount) {
                    db.run('ROLLBACK');
                    return reject(new Error(`You only have ${totalQuantity} of this item.`));
                }

                try {
                    let remainingToTrade = amount;

                    // Process each version until we've traded the requested amount
                    for (const version of versions) {
                        if (remainingToTrade <= 0) break;

                        const tradeAmount = Math.min(remainingToTrade, version.quantity);
                        remainingToTrade -= tradeAmount;

                        // Remove from sender
                        await new Promise((res, rej) => {
                            db.run(
                                'UPDATE user_inventory SET quantity = quantity - ? WHERE Discord = ? AND version_id = ?',
                                [tradeAmount, senderId, version.version_id],
                                err => err ? rej(err) : res()
                            );
                        });

                        // Add to receiver
                        await new Promise((res, rej) => {
                            db.run(`
                                INSERT INTO user_inventory (Discord, item_id, version_id, quantity, shop_type)
                                VALUES (?, ?, ?, ?, ?)
                                ON CONFLICT(Discord, item_id, version_id)
                                DO UPDATE SET quantity = quantity + ?
                            `, [receiverId, version.item_id, version.version_id, tradeAmount, version.shop_type, tradeAmount],
                            err => err ? rej(err) : res());
                        });
                    }

                    // Clean up any entries with 0 quantity
                    await new Promise((res, rej) => {
                        db.run('DELETE FROM user_inventory WHERE quantity <= 0',
                            err => err ? rej(err) : res());
                    });

                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        resolve();
                    });
                } catch (error) {
                    db.run('ROLLBACK');
                    reject(error);
                }
            });
        });
    });
}

// ============================================================================
// SHOP SETUP AND MANAGEMENT
// ============================================================================

// Update valid button IDs from database
async function updateValidButtonIds() {
    try {
        const equipmentIds = await new Promise((resolve, reject) => {
            db.all('SELECT id FROM equipment_items', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.id));
            });
        });
        
        // Add all equipment IDs to validButtonIds if they're not already there
        equipmentIds.forEach(id => {
            if (!validButtonIds.includes(id)) {
                validButtonIds.push(id);
            }
        });

        console.log(`✅ Updated valid button IDs, now tracking ${validButtonIds.length} buttons`);
    } catch (error) {
        console.error('❌ Error updating valid button IDs:', error);
    }
}

// Setup Mochi shop embed and update existing message
async function setupShopEmbed() {
    const channel = await client.channels.fetch(MOCHI_SHOP_CHANNEL);
    const items = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM items', (err, rows) => {
            if (err) {
                console.error('❌ Error fetching items:', err);
                reject(err);
                return;
            }
            const itemsObject = {};
            rows.forEach(row => {
                itemsObject[row.id] = row;
            });
            resolve(itemsObject);
        });
    });

    const shopEmbed = await createShopEmbed(items);
    const components = await createShopButtons(items);

    try {
        if (mochiShopMessageId) {
            const oldMessage = await channel.messages.fetch(mochiShopMessageId);
            if (oldMessage) {
                await oldMessage.edit({ embeds: [shopEmbed], components: components });
                console.log('✅ Mochi shop updated successfully');
                return;
            }
        }
    } catch (error) {
        console.log('🔄 Could not find previous Mochi shop message, creating new one');
        mochiShopMessageId = null;
    }

    const message = await channel.send({ embeds: [shopEmbed], components: components });
    mochiShopMessageId = message.id;
    console.log('✅ New Mochi shop message created');
}

// Setup Waterlily shop embed
async function setupWaterlilyShopEmbed() {
    try {
        const waterlilyChannel = await client.channels.fetch(WATERLILY_SHOP_CHANNEL);
        const waterlilyItems = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM waterlily_items', (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching Waterlily items:', err);
                    reject(err);
                    return;
                }
                const itemsObject = {};
                rows.forEach(row => {
                    itemsObject[row.id] = row;
                });
                resolve(itemsObject);
            });
        });

        const waterlilyEmbed = createWaterlilyShopEmbed(waterlilyItems);
        const waterlilyComponents = createWaterlilyShopButtons(waterlilyItems);

        try {
            if (waterlilyShopMessageId) {
                const oldMessage = await waterlilyChannel.messages.fetch(waterlilyShopMessageId);
                if (oldMessage) {
                    await oldMessage.edit({ embeds: [waterlilyEmbed], components: waterlilyComponents });
                    console.log('✅ Waterlily shop updated successfully');
                    return;
                }
            }
        } catch (error) {
            console.log('🔄 Could not find previous Waterlily shop message, creating new one');
        }

        const message = await waterlilyChannel.send({ embeds: [waterlilyEmbed], components: waterlilyComponents });
        waterlilyShopMessageId = message.id;
        console.log('✅ New Waterlily shop message created');
    } catch (error) {
        console.error('❌ Error setting up Waterlily shop:', error);
    }
}

// Setup all shops (main function)
async function setupShops() {
    try {
        console.log('🏪 Setting up all shops...');

        // Setup Mochi Shop
        const mochiChannel = await client.channels.fetch(MOCHI_SHOP_CHANNEL);
        const items = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM items WHERE id NOT IN (SELECT id FROM equipment_items)', (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching items:', err);
                    reject(err);
                    return;
                }
                const itemsObject = {};
                rows.forEach(row => {
                    itemsObject[row.id] = row;
                });
                resolve(itemsObject);
            });
        });

        const shopEmbed = await createShopEmbed(items);
        const components = await createShopButtons(items);

        try {
            if (mochiShopMessageId) {
                const oldMessage = await mochiChannel.messages.fetch(mochiShopMessageId);
                if (oldMessage) {
                    await oldMessage.edit({ embeds: [shopEmbed], components: components });
                    console.log('✅ Mochi shop updated successfully');
                }
            } else {
                const message = await mochiChannel.send({ embeds: [shopEmbed], components: components });
                mochiShopMessageId = message.id;
                console.log('✅ Mochi shop created successfully');
            }
        } catch (error) {
            console.log('🔄 Could not find previous Mochi shop message, creating new one');
            const message = await mochiChannel.send({ embeds: [shopEmbed], components: components });
            mochiShopMessageId = message.id;
        }

        // Setup Waterlily Shop
        await setupWaterlilyShopEmbed();

        // Setup Equipment Shop
        const equipmentChannel = await client.channels.fetch(EQUIPMENT_SHOP_CHANNEL);
        const equipmentEmbed = await createEquipmentShopEmbed();
        const equipmentButtons = await createEquipmentShopButtons();

        try {
            if (equipmentShopMessageId) {
                const oldMessage = await equipmentChannel.messages.fetch(equipmentShopMessageId);
                if (oldMessage) {
                    await oldMessage.edit({ embeds: [equipmentEmbed], components: equipmentButtons });
                    console.log('✅ Equipment shop updated successfully');
                }
            } else {
                const message = await equipmentChannel.send({ embeds: [equipmentEmbed], components: equipmentButtons });
                equipmentShopMessageId = message.id;
                console.log('✅ Equipment shop created successfully');
            }
        } catch (error) {
            console.log('🔄 Could not find previous Equipment shop message, creating new one');
            const message = await equipmentChannel.send({ embeds: [equipmentEmbed], components: equipmentButtons });
            equipmentShopMessageId = message.id;
        }

        console.log('🎉 All shops setup completed successfully!');
    } catch (error) {
        console.error('❌ Error setting up shops:', error);
    }
}

// ============================================================================
// SHOP INTERACTION HANDLERS
// ============================================================================

// Handle shop purchase interactions
async function handleShopInteraction(interaction) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const userId = interaction.user.id;
        const itemId = interaction.customId;
        const isWaterlily = itemId.startsWith('w');

        console.log(`🛒 Processing purchase: User ${userId} buying item ${itemId}`);

        // Get user, item, and equipment data
        const [user, item, equipmentInfo] = await Promise.all([
            getUserData(userId),
            getItemData(itemId, isWaterlily ? 'waterlily' : 'mochi'),
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM equipment_items WHERE id = ?', [itemId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            })
        ]);

        // Determine which currency to check
        const currencyAmount = isWaterlily ? user?.Waterlily || 0 : user?.Tickets || 0;
        const currencyName = isWaterlily ? 'Waterlily' : 'Mochi';

        // Validation checks
        if (!user || currencyAmount < item?.cost) {
            await interaction.followUp({
                content: `❌ You don't have enough ${currencyName} to buy this item. You need ${item?.cost} but have ${currencyAmount}.`,
                ephemeral: true
            });
            return;
        }

        if (!item || item.available <= 0) {
            await interaction.followUp({
                content: "❌ This item is not available.",
                ephemeral: true
            });
            return;
        }

        // Perform purchase
        await performPurchase(userId, itemId, item.cost, isWaterlily ? 'waterlily' : 'mochi');

        // Create response message
        let responseEmbed = new EmbedBuilder()
            .setColor(equipmentInfo ? 0x00FF00 : 0x00AE86)
            .setTitle('✅ Purchase Successful!')
            .setDescription(`You have successfully bought **${item.name}**!`)
            .addFields({
                name: '💰 Cost',
                value: `${item.cost} ${currencyName}`,
                inline: true
            });

        // Add equipment specific information if it's an equipment item
        if (equipmentInfo) {
            const stats = [];
            if (equipmentInfo.attack) stats.push(`⚔️ Attack: ${equipmentInfo.attack}`);
            if (equipmentInfo.defense) stats.push(`🛡️ Defense: ${equipmentInfo.defense}`);
            if (equipmentInfo.speed) stats.push(`⚡ Speed: ${equipmentInfo.speed}`);

            responseEmbed.addFields(
                {
                    name: '🎽 Item Type',
                    value: `${equipmentInfo.rarity} ${equipmentInfo.slot_id.charAt(0).toUpperCase() + equipmentInfo.slot_id.slice(1)}`,
                    inline: true
                },
                {
                    name: '📊 Stats',
                    value: stats.join('\n') || 'No stats',
                    inline: true
                }
            )
            .setFooter({ text: 'Use /equip command to equip this item!' });
        }

        // Log the purchase
        const logChannel = client.channels.cache.get(NOTIFICATION_CHANNEL);
        if (logChannel) {
            await logChannel.send(
                `🛒 ${interaction.user.tag} bought **${item.name}** ` +
                `for ${item.cost} ${currencyName}` +
                `${equipmentInfo ? ` (${equipmentInfo.rarity} ${equipmentInfo.slot_id})` : ''}`
            );
        }

        // Update relevant shop
        if (isWaterlily) {
            await setupWaterlilyShopEmbed();
        } else {
            await setupShops();
        }

        // Send response to user
        await interaction.followUp({
            embeds: [responseEmbed],
            ephemeral: true
        });

    } catch (error) {
        console.error('❌ Error handling shop interaction:', error);
        if (interaction.isRepliable()) {
            await interaction.followUp({
                content: error.message || 'An error occurred. Please try again.',
                ephemeral: true
            }).catch(console.error);
        }
    }
}

// Handle equipment purchase from equipment shop
async function handleEquipmentPurchase(interaction) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const itemId = interaction.customId.replace('equipment_purchase_', '');
        const userId = interaction.user.id;

        console.log(`⚔️ Processing equipment purchase: User ${userId} buying ${itemId}`);

        // Get user data and item data
        const [user, item] = await Promise.all([
            getUserData(userId),
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM equipment_items WHERE id = ? AND available > 0', [itemId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            })
        ]);

        // Validation checks
        if (!user || user.Tickets < item?.cost) {
            await interaction.followUp({
                content: `❌ You don't have enough Mochi. This item costs ${item?.cost} Mochi but you have ${user?.Tickets || 0}.`,
                ephemeral: true
            });
            return;
        }

        if (!item || item.available <= 0) {
            await interaction.followUp({
                content: "❌ This item is not available.",
                ephemeral: true
            });
            return;
        }

        // Create item version and process purchase
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Create item version
                db.run(`
                    INSERT INTO item_versions (
                        item_id, name, shop_type, rarity, attack, defense, 
                        speed, icon, slot_id, role_id, description
                    ) VALUES (?, ?, 'mochi', ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    item.id, item.name, item.rarity, item.attack, 
                    item.defense, item.speed, item.icon, item.slot_id, 
                    item.role_id, item.description
                ], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }

                    const versionId = this.lastID;

                    // Deduct mochi
                    db.run('UPDATE users SET Tickets = Tickets - ? WHERE Discord = ?', 
                        [item.cost, userId], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        // Update item availability
                        db.run('UPDATE equipment_items SET available = available - 1 WHERE id = ?',
                            [itemId], (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }

                            // Add to inventory with version
                            db.run(`
                                INSERT INTO user_inventory (Discord, item_id, version_id, quantity, shop_type)
                                VALUES (?, ?, ?, 1, 'mochi')
                                ON CONFLICT(Discord, item_id, version_id) 
                                DO UPDATE SET quantity = quantity + 1
                            `, [userId, itemId, versionId], (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }

                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }
                                    resolve();
                                });
                            });
                        });
                    });
                });
            });
        });

        // Create purchase response
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('⚔️ Equipment Purchased!')
            .setDescription(`Successfully purchased **${item.name}**!`)
            .addFields(
                {
                    name: '📊 Stats',
                    value: `${item.attack ? `⚔️ Attack: ${item.attack}\n` : ''}` +
                           `${item.defense ? `🛡️ Defense: ${item.defense}\n` : ''}` +
                           `${item.speed ? `⚡ Speed: ${item.speed}\n` : ''}`,
                    inline: true
                },
                {
                    name: '🏷️ Details',
                    value: `Type: ${item.slot_id.charAt(0).toUpperCase() + item.slot_id.slice(1)}\n` +
                           `Rarity: ${item.rarity}`,
                    inline: true
                }
            )
            .setFooter({ text: 'Use /equip to equip this item!' });

        await interaction.followUp({
            embeds: [embed],
            ephemeral: true
        });

        // Update the shop display
        const shopMessage = await interaction.message.fetch();
        const newEmbed = await createEquipmentShopEmbed();
        const newButtons = await createEquipmentShopButtons();
        await shopMessage.edit({ embeds: [newEmbed], components: newButtons });

        // Log the purchase
        const logChannel = interaction.client.channels.cache.get(NOTIFICATION_CHANNEL);
        if (logChannel) {
            await logChannel.send(
                `⚔️ ${interaction.user.tag} purchased **${item.name}** for ${item.cost} Mochi`
            );
        }

    } catch (error) {
        console.error('❌ Error processing equipment purchase:', error);
        if (interaction.isRepliable()) {
            await interaction.followUp({
                content: error.message || 'An error occurred while processing your purchase.',
                ephemeral: true
            }).catch(console.error);
        }
    }
}

// ============================================================================
// EQUIPMENT SYSTEM & INVENTORY MANAGEMENT
// ============================================================================
// This section handles equipment mechanics, player stats calculation,
// inventory display, and item equipping/unequipping functionality
// ============================================================================

// ============================================================================
// PLAYER STATS & EQUIPMENT FUNCTIONS
// ============================================================================

// Calculate total player stats including base stats and equipment bonuses
async function calculatePlayerStats(userId) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Get base stats for the player
            db.get('SELECT * FROM player_stats WHERE Discord = ?', [userId], async (err, baseStats) => {
                if (err) return reject(err);
                
                // Create default stats if none exist
                if (!baseStats) {
                    await new Promise((res, rej) => {
                        db.run(
                            'INSERT INTO player_stats (Discord) VALUES (?)',
                            [userId],
                            (err) => err ? rej(err) : res()
                        );
                    });
                    
                    baseStats = {
                        base_attack: 10,
                        base_defense: 10,
                        base_speed: 10
                    };
                }
                
                // Get equipped items with their latest stats from versions
                const query = `
                    SELECT 
                        ei.slot_id,
                        iv.attack,
                        iv.defense, 
                        iv.speed
                    FROM equipped_items ei
                    JOIN (
                        SELECT item_id, MAX(version_date) as latest_date
                        FROM item_versions
                        GROUP BY item_id
                    ) latest ON ei.item_id = latest.item_id
                    JOIN item_versions iv ON ei.item_id = iv.item_id AND latest.latest_date = iv.version_date
                    WHERE ei.Discord = ?
                    GROUP BY ei.slot_id
                `;
                
                db.all(query, [userId], (err, equipmentStats) => {
                    if (err) return reject(err);
                    
                    // Calculate total stats
                    const totalStats = {
                        attack: baseStats.base_attack || 10,
                        defense: baseStats.base_defense || 10,
                        speed: baseStats.base_speed || 10
                    };
                    
                    // Add equipment bonuses
                    equipmentStats.forEach(item => {
                        totalStats.attack += item.attack || 0;
                        totalStats.defense += item.defense || 0;
                        totalStats.speed += item.speed || 0;
                    });
                    
                    resolve(totalStats);
                });
            });
        });
    });
}

// Get equipped items for a user with full details
async function getEquippedItems(userId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT ei.*, e.name, e.slot_id, e.rarity, e.attack, e.defense, e.speed, e.icon,
                   iv.name as version_name, iv.rarity as version_rarity, 
                   iv.attack as version_attack, iv.defense as version_defense, 
                   iv.speed as version_speed, iv.icon as version_icon
            FROM equipped_items ei
            JOIN equipment_items e ON ei.item_id = e.id
            JOIN (
                SELECT item_id, MAX(version_date) as latest_date
                FROM item_versions
                GROUP BY item_id
            ) latest ON ei.item_id = latest.item_id
            JOIN item_versions iv ON ei.item_id = iv.item_id AND latest.latest_date = iv.version_date
            WHERE ei.Discord = ?
        `, [userId], (err, rows) => {
            if (err) reject(err);
            else {
                // Use version data if available, otherwise fall back to base data
                const processedRows = rows.map(row => ({
                    ...row,
                    name: row.version_name || row.name,
                    rarity: row.version_rarity || row.rarity,
                    attack: row.version_attack || row.attack,
                    defense: row.version_defense || row.defense,
                    speed: row.version_speed || row.speed,
                    icon: row.version_icon || row.icon
                }));
                resolve(processedRows);
            }
        });
    });
}

// Get equipment display with all slots and current equipment
async function getEquipmentDisplay(userId) {
    return new Promise((resolve, reject) => {
        // First get all available equipment slots to ensure we show empty slots too
        db.all(`SELECT id as slot_id, display_name as slot_name FROM equipment_slots ORDER BY id`, [], (err, allSlots) => {
            if (err) return reject(err);
            
            // Then get equipped items with their details using latest versions
            const query = `
                SELECT 
                    ei.slot_id,
                    es.display_name as slot_name,
                    ei.item_id,
                    iv.name as item_name,
                    iv.rarity,
                    iv.attack,
                    iv.defense,
                    iv.speed,
                    iv.icon
                FROM equipped_items ei
                JOIN equipment_slots es ON ei.slot_id = es.id
                JOIN (
                    SELECT item_id, MAX(version_date) as latest_date
                    FROM item_versions
                    GROUP BY item_id
                ) latest ON ei.item_id = latest.item_id
                JOIN item_versions iv ON ei.item_id = iv.item_id AND latest.latest_date = iv.version_date
                WHERE ei.Discord = ?
            `;

            db.all(query, [userId], async (err, equippedItems) => {
                if (err) return reject(err);
                
                // Create a map of slot_id to equipped item
                const equippedBySlot = {};
                equippedItems.forEach(item => {
                    // Only add if not already present (take first one to avoid duplicates)
                    if (!equippedBySlot[item.slot_id]) {
                        equippedBySlot[item.slot_id] = item;
                    }
                });
                
                // Merge with all slots to ensure we show empty slots
                const equipment = allSlots.map(slot => {
                    return equippedBySlot[slot.slot_id] || {
                        slot_id: slot.slot_id,
                        slot_name: slot.slot_name,
                        item_name: null,
                        rarity: null,
                        attack: null,
                        defense: null,
                        speed: null,
                        icon: null
                    };
                });

                try {
                    const stats = await calculatePlayerStats(userId);
                    resolve({ equipment, stats });
                } catch (error) {
                    reject(error);
                }
            });
        });
    });
}

// Get equipment details for multiple item IDs
async function getEquipmentDetails(itemIds) {
    if (!itemIds.length) return {};
    
    return new Promise((resolve, reject) => {
        const placeholders = itemIds.map(() => '?').join(',');
        db.all(
            `SELECT * FROM equipment_items WHERE id IN (${placeholders})`,
            itemIds,
            (err, rows) => {
                if (err) reject(err);
                else {
                    const details = {};
                    rows.forEach(row => {
                        details[row.id] = row;
                    });
                    resolve(details);
                }
            }
        );
    });
}

// ============================================================================
// EQUIPMENT OPERATIONS
// ============================================================================

// Equip an item from inventory
async function equipItem(userId, itemId) {
    return new Promise((resolve, reject) => {
        // First, check if the user has this item in inventory
        db.get(
            `SELECT * FROM user_inventory WHERE Discord = ? AND item_id = ?`,
            [userId, itemId],
            (err, invItem) => {
                if (err) {
                    return reject(err);
                }
                
                if (!invItem) {
                    return reject(new Error(`Item not found in your inventory`));
                }
                
                // Get equipment data
                db.get(
                    `SELECT * FROM equipment_items WHERE id = ?`,
                    [itemId],
                    (err, equipData) => {
                        if (err) {
                            return reject(err);
                        }
                        
                        if (!equipData) {
                            return reject(new Error(`Item not found in equipment database`));
                        }
                        
                        // Get latest version data
                        db.get(
                            `SELECT * FROM item_versions WHERE item_id = ? ORDER BY version_date DESC LIMIT 1`,
                            [itemId],
                            (err, versionData) => {
                                if (err) {
                                    return reject(err);
                                }
                                
                                if (!versionData) {
                                    return reject(new Error(`No version data found for this item`));
                                }
                                
                                db.serialize(() => {
                                    db.run('BEGIN TRANSACTION');
                                    
                                    // Check if there's already something equipped in this slot
                                    db.get(
                                        `SELECT * FROM equipped_items WHERE Discord = ? AND slot_id = ?`,
                                        [userId, equipData.slot_id],
                                        (err, currentEquipped) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }
                                            
                                            let operations = [];
                                            
                                            // If something is already equipped, return it to inventory
                                            if (currentEquipped) {
                                                operations.push(
                                                    new Promise((res, rej) => {
                                                        db.run(
                                                            `INSERT INTO user_inventory (Discord, item_id, version_id, quantity, shop_type) VALUES (?, ?, ?, 1, ?) 
                                                            ON CONFLICT(Discord, item_id, version_id) DO UPDATE SET quantity = quantity + 1`,
                                                            [userId, currentEquipped.item_id, versionData.id, versionData.shop_type],
                                                            err => err ? rej(err) : res()
                                                        );
                                                    })
                                                );
                                                
                                                operations.push(
                                                    new Promise((res, rej) => {
                                                        db.run(
                                                            `DELETE FROM equipped_items WHERE Discord = ? AND slot_id = ?`,
                                                            [userId, equipData.slot_id],
                                                            err => err ? rej(err) : res()
                                                        );
                                                    })
                                                );
                                            }
                                            
                                            // Remove item from inventory
                                            operations.push(
                                                new Promise((res, rej) => {
                                                    db.run(
                                                        `UPDATE user_inventory SET quantity = quantity - 1 
                                                        WHERE Discord = ? AND item_id = ? AND rowid = 
                                                        (SELECT rowid FROM user_inventory WHERE Discord = ? AND item_id = ? LIMIT 1)`,
                                                        [userId, itemId, userId, itemId],
                                                        err => err ? rej(err) : res()
                                                    );
                                                })
                                            );
                                            
                                            // Delete if quantity is 0
                                            operations.push(
                                                new Promise((res, rej) => {
                                                    db.run(
                                                        `DELETE FROM user_inventory WHERE Discord = ? AND item_id = ? AND quantity <= 0`,
                                                        [userId, itemId],
                                                        err => err ? rej(err) : res()
                                                    );
                                                })
                                            );
                                            
                                            // Add to equipped items
                                            operations.push(
                                                new Promise((res, rej) => {
                                                    db.run(
                                                        `INSERT INTO equipped_items (Discord, slot_id, item_id) VALUES (?, ?, ?)`,
                                                        [userId, equipData.slot_id, itemId],
                                                        err => err ? rej(err) : res()
                                                    );
                                                })
                                            );
                                            
                                            // Role assignment if applicable
                                            if (equipData.role_id) {
                                                operations.push(
                                                    new Promise((res, rej) => {
                                                        try {
                                                            const guild = client.guilds.cache.first();
                                                            guild.members.fetch(userId)
                                                                .then(member => member.roles.add(equipData.role_id))
                                                                .then(() => {
                                                                    console.log(`✅ Added role ${equipData.role_id} to user ${userId}`);
                                                                    res();
                                                                })
                                                                .catch(error => {
                                                                    console.error('❌ Error adding role:', error);
                                                                    res(); // Don't fail the whole transaction for role issues
                                                                });
                                                        } catch (error) {
                                                            console.error('❌ Error in role assignment:', error);
                                                            res(); // Don't fail the whole transaction for role issues
                                                        }
                                                    })
                                                );
                                            }
                                            
                                            // Execute all operations
                                            Promise.all(operations)
                                                .then(() => {
                                                    db.run('COMMIT', err => {
                                                        if (err) {
                                                            db.run('ROLLBACK');
                                                            return reject(err);
                                                        }
                                                        // Create a merged object with all data
                                                        const result = {
                                                            ...equipData,
                                                            ...versionData
                                                        };
                                                        console.log(`✅ Successfully equipped ${itemId} for user ${userId}`);
                                                        resolve(result);
                                                    });
                                                })
                                                .catch(error => {
                                                    db.run('ROLLBACK');
                                                    reject(error);
                                                });
                                        }
                                    );
                                });
                            }
                        );
                    }
                );
            }
        );
    });
}

// Unequip an item from a specific slot
async function unequipSlot(userId, slotId) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Get currently equipped item with version info
            db.get(
                `SELECT ei.*, e.role_id, iv.shop_type 
                FROM equipped_items ei 
                LEFT JOIN equipment_items e ON ei.item_id = e.id
                LEFT JOIN item_versions iv ON ei.item_id = iv.item_id
                WHERE ei.Discord = ? AND ei.slot_id = ?`,
                [userId, slotId],
                async (err, equipped) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }
                    if (!equipped) {
                        db.run('COMMIT');
                        return resolve();
                    }

                    try {
                        // Get latest version of the item
                        const version = await new Promise((res, rej) => {
                            db.get(
                                'SELECT * FROM item_versions WHERE item_id = ? ORDER BY version_date DESC LIMIT 1',
                                [equipped.item_id],
                                (err, row) => err ? rej(err) : res(row)
                            );
                        });

                        // Return item to inventory
                        await new Promise((res, rej) => {
                            db.run(
                                'INSERT INTO user_inventory (Discord, item_id, version_id, quantity, shop_type) VALUES (?, ?, ?, 1, ?) ON CONFLICT(Discord, item_id, version_id) DO UPDATE SET quantity = quantity + 1',
                                [userId, equipped.item_id, version.id, version.shop_type],
                                err => err ? rej(err) : res()
                            );
                        });

                        // Remove equipped item
                        await new Promise((res, rej) => {
                            db.run(
                                'DELETE FROM equipped_items WHERE Discord = ? AND slot_id = ?',
                                [userId, slotId],
                                err => err ? rej(err) : res()
                            );
                        });

                        // Remove role if defined
                        if (equipped.role_id) {
                            try {
                                const guild = client.guilds.cache.first();
                                const member = await guild.members.fetch(userId);
                                await member.roles.remove(equipped.role_id);
                                console.log(`✅ Removed role ${equipped.role_id} from user ${userId}`);
                            } catch (error) {
                                console.error('❌ Error removing role:', error);
                            }
                        }

                        db.run('COMMIT', (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                            console.log(`✅ Successfully unequipped ${slotId} slot for user ${userId}`);
                            resolve(equipped);
                        });
                    } catch (error) {
                        db.run('ROLLBACK');
                        reject(error);
                    }
                }
            );
        });
    });
}

// Unequip a specific item by item ID
async function unequipItem(userId, itemId) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Get item and slot info
            db.get(
                'SELECT ei.*, e.name, e.slot_id, e.role_id FROM equipped_items ei JOIN equipment_items e ON ei.item_id = e.id WHERE ei.Discord = ? AND ei.item_id = ?',
                [userId, itemId],
                async (err, equippedItem) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }
                    if (!equippedItem) {
                        db.run('ROLLBACK');
                        return reject(new Error('Item not equipped'));
                    }

                    try {
                        // Get the item version
                        const version = await new Promise((res, rej) => {
                            db.get(
                                'SELECT * FROM item_versions WHERE item_id = ? ORDER BY version_date DESC LIMIT 1',
                                [itemId],
                                (err, row) => err ? rej(err) : res(row)
                            );
                        });

                        // Add item back to inventory with version
                        await new Promise((res, rej) => {
                            db.run(
                                'INSERT INTO user_inventory (Discord, item_id, version_id, quantity, shop_type) VALUES (?, ?, ?, 1, ?) ON CONFLICT(Discord, item_id, version_id) DO UPDATE SET quantity = quantity + 1',
                                [userId, itemId, version.id, version.shop_type],
                                err => err ? rej(err) : res()
                            );
                        });

                        // Remove equipped item
                        await new Promise((res, rej) => {
                            db.run(
                                'DELETE FROM equipped_items WHERE Discord = ? AND item_id = ?',
                                [userId, itemId],
                                err => err ? rej(err) : res()
                            );
                        });

                        // Remove role if defined
                        if (equippedItem.role_id) {
                            try {
                                const guild = client.guilds.cache.first();
                                const member = await guild.members.fetch(userId);
                                await member.roles.remove(equippedItem.role_id);
                                console.log(`✅ Removed role ${equippedItem.role_id} from user ${userId}`);
                            } catch (error) {
                                console.error('❌ Error removing role:', error);
                            }
                        }

                        db.run('COMMIT', err => {
                            if (err) {
                                db.run('ROLLBACK');
                                reject(err);
                            } else {
                                console.log(`✅ Successfully unequipped ${itemId} for user ${userId}`);
                                resolve(equippedItem);
                            }
                        });
                    } catch (error) {
                        db.run('ROLLBACK');
                        reject(error);
                    }
                }
            );
        });
    });
}

// ============================================================================
// COMMAND DEFINITIONS & INTERACTION HANDLERS
// ============================================================================
// This section contains all slash command definitions and their handlers,
// organized by functionality for easy maintenance and updates
// ============================================================================

// ============================================================================
// SLASH COMMAND DEFINITIONS
// ============================================================================

// Main command definitions array
const commands = [
    // Equipment and inventory commands
    new SlashCommandBuilder()
        .setName('equipment')
        .setDescription('View your equipped items and stats'),
    
    new SlashCommandBuilder()
        .setName('equip')
        .setDescription('Equip an item from your inventory'),
        
    new SlashCommandBuilder()
        .setName('unequip')
        .setDescription('Unequip an item')
        .addStringOption(option =>
            option.setName('slot')
                .setDescription('The slot to unequip')
                .setRequired(true)
                .addChoices(
                    { name: 'Head', value: 'head' },
                    { name: 'Neck', value: 'neck' },
                    { name: 'Chest', value: 'chest' },
                    { name: 'Hands', value: 'hands' },
                    { name: 'Ring', value: 'ring' },
                    { name: 'Weapon', value: 'weapon' }
                )),

    new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Check your inventory'),

    // Trading and currency commands
    new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Trade items or currency with another user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to trade with')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('What to trade')
                .setRequired(true)
                .addChoices(
                    { name: 'Mochi', value: 'mochi' },
                    { name: 'Waterlily', value: 'waterlily' },
                    { name: 'Item', value: 'item' }
                ))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Amount to trade')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('convert')
        .setDescription('Convert Mochi to Waterlilies (3:1 ratio)')
        .addIntegerOption(option => 
            option.setName('mochi')
                .setDescription('Amount of Mochi to convert')
                .setRequired(true)),

    // Community features
    new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a new poll')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Title of the poll')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('option1')
                .setDescription('First option')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('option2')
                .setDescription('Second option')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('hours')
                .setDescription('Duration in hours')
                .setMinValue(0)
                .setMaxValue(24)
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('minutes')
                .setDescription('Additional minutes')
                .setMinValue(0)
                .setMaxValue(59)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description of the poll')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('multiple_choice')
                .setDescription('Allow multiple choices?')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Optional image for the poll')
                .setRequired(false))
        // Additional options for up to 17 poll choices
        .addStringOption(option => option.setName('option3').setDescription('Option 3').setRequired(false))
        .addStringOption(option => option.setName('option4').setDescription('Option 4').setRequired(false))
        .addStringOption(option => option.setName('option5').setDescription('Option 5').setRequired(false))
        .addStringOption(option => option.setName('option6').setDescription('Option 6').setRequired(false))
        .addStringOption(option => option.setName('option7').setDescription('Option 7').setRequired(false))
        .addStringOption(option => option.setName('option8').setDescription('Option 8').setRequired(false))
        .addStringOption(option => option.setName('option9').setDescription('Option 9').setRequired(false))
        .addStringOption(option => option.setName('option10').setDescription('Option 10').setRequired(false))
        .addStringOption(option => option.setName('option11').setDescription('Option 11').setRequired(false))
        .addStringOption(option => option.setName('option12').setDescription('Option 12').setRequired(false))
        .addStringOption(option => option.setName('option13').setDescription('Option 13').setRequired(false))
        .addStringOption(option => option.setName('option14').setDescription('Option 14').setRequired(false))
        .addStringOption(option => option.setName('option15').setDescription('Option 15').setRequired(false))
        .addStringOption(option => option.setName('option16').setDescription('Option 16').setRequired(false))
        .addStringOption(option => option.setName('option17').setDescription('Option 17').setRequired(false)),

    new SlashCommandBuilder()
        .setName('raffle')
        .setDescription('Create a new raffle')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of raffle')
                .setRequired(true)
                .addChoices(
                    { name: 'Role-based', value: 'role' },
                    { name: 'Mochi-based', value: 'mochi' },
                    { name: 'Waterlily-based', value: 'waterlily' }
                ))
        .addNumberOption(option =>
            option.setName('duration')
                .setDescription('Duration in hours')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Raffle title')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Raffle description')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('image_url')
                .setDescription('Image URL for the raffle')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('roles')
                .setDescription('Comma-separated role IDs (for role raffles)'))
        .addIntegerOption(option =>
            option.setName('cost')
                .setDescription('Cost per entry (for currency raffles)')),

    // Utility commands
    new SlashCommandBuilder()
        .setName('archive')
        .setDescription('Archive the current channel content')
        .addIntegerOption(option => 
            option.setName('days')
                .setDescription('Number of days to archive (leave empty for all messages)')
                .setMinValue(1)
                .setRequired(false)),

    // Admin commands
    new SlashCommandBuilder()
        .setName('admin_items')
        .setDescription('View all items in the database (including inactive)'),

    new SlashCommandBuilder()
        .setName('admin_inventory')
        .setDescription('Check inventory of any user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose inventory to check')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('admin_update')
        .setDescription('Update shop item properties')
        .addStringOption(option =>
            option.setName('shop_type')
                .setDescription('Which shop to update')
                .setRequired(true)
                .addChoices(
                    { name: 'Mochi Shop', value: 'mochi' },
                    { name: 'Waterlily Shop', value: 'waterlily' },
                    { name: 'Equipment Shop', value: 'equipment' }
                ))
        .addStringOption(option =>
            option.setName('item_id')
                .setDescription('ID of the item to update')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('New name for the item')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('cost')
                .setDescription('New cost for the item')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('available')
                .setDescription('New quantity available')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('attack')
                .setDescription('New attack value (for equipment)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('defense')
                .setDescription('New defense value (for equipment)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('speed')
                .setDescription('New speed value (for equipment)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('rarity')
                .setDescription('New rarity level (for equipment)')
                .setRequired(false)
                .addChoices(
                    { name: 'Common', value: 'Common' },
                    { name: 'Uncommon', value: 'Uncommon' },
                    { name: 'Rare', value: 'Rare' },
                    { name: 'Epic', value: 'Epic' },
                    { name: 'Legendary', value: 'Legendary' }
                )),

    new SlashCommandBuilder()
        .setName('admin_searchitem')
        .setDescription('Search for items by name')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('admin_item')
        .setDescription('Add or remove items from user inventory')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to modify items for')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Add or remove items')
                .setRequired(true)
                .addChoices(
                    { name: 'Add', value: 'add' },
                    { name: 'Remove', value: 'remove' }
                ))
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The name or ID of the item')
                .setRequired(true)
                .setAutocomplete(true))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Amount to add/remove')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('admin_give')
        .setDescription('Give currency to a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to give currency to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('currency')
                .setDescription('Type of currency to give')
                .setRequired(true)
                .addChoices(
                    { name: 'Mochi', value: 'mochi' },
                    { name: 'Waterlily', value: 'waterlily' }
                ))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Amount to give')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('admin_stats')
        .setDescription('View currency statistics')
        .addStringOption(option =>
            option.setName('currency')
                .setDescription('Type of currency to check')
                .setRequired(true)
                .addChoices(
                    { name: 'Mochi', value: 'mochi' },
                    { name: 'Waterlily', value: 'waterlily' },
                    { name: 'Both', value: 'both' }
                )),

    new SlashCommandBuilder()
        .setName('admin_leaderboard')
        .setDescription('View currency leaderboard')
        .addStringOption(option =>
            option.setName('currency')
                .setDescription('Type of currency to check')
                .setRequired(true)
                .addChoices(
                    { name: 'Mochi', value: 'mochi' },
                    { name: 'Waterlily', value: 'waterlily' }
                )),

    new SlashCommandBuilder()
        .setName('setupshops')
        .setDescription('Setup or refresh shops (Admin only)')
];


// ============================================================================
// COMMAND VERIFICATION SYSTEM
// ============================================================================

// Function to verify all commands are properly defined and handled
function verifyCommands() {
    const definedCommands = commands.map(cmd => cmd.name);
    const handledCommands = [
        'equipment', 'equip', 'unequip', 'inventory', 'trade', 'convert',
        'poll', 'raffle', 'archive',
        'admin_items', 'admin_inventory', 'admin_update', 'admin_searchitem',
        'admin_item', 'admin_give', 'admin_stats', 'admin_leaderboard', 'setupshops'
    ];

    console.log('=== COMMAND VERIFICATION ===');
    console.log(`📝 Defined commands: ${definedCommands.length}`);
    console.log(`🔧 Handled commands: ${handledCommands.length}`);
    
    // Find missing definitions
    const missingDefinitions = handledCommands.filter(cmd => !definedCommands.includes(cmd));
    if (missingDefinitions.length > 0) {
        console.log('❌ Missing command definitions:', missingDefinitions);
    }
    
    // Find missing handlers
    const missingHandlers = definedCommands.filter(cmd => !handledCommands.includes(cmd));
    if (missingHandlers.length > 0) {
        console.log('❌ Missing command handlers:', missingHandlers);
    }
    
    if (missingDefinitions.length === 0 && missingHandlers.length === 0) {
        console.log('✅ All commands properly defined and handled');
    }
    console.log('==========================');
}

// ============================================================================
// INVENTORY & EQUIPMENT COMMAND HANDLERS
// ============================================================================

// Handle inventory display command
async function handleInventoryCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const userData = await getUserData(interaction.user.id);
        
        // Get inventory with versions
        const inventory = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    ui.item_id,
                    ui.quantity,
                    ui.shop_type,
                    iv.name,
                    iv.rarity,
                    iv.attack,
                    iv.defense,
                    iv.speed,
                    iv.icon,
                    iv.slot_id,
                    iv.version_date
                FROM user_inventory ui
                JOIN item_versions iv ON ui.version_id = iv.id
                WHERE ui.Discord = ?
                ORDER BY iv.version_date DESC
            `, [interaction.user.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get equipped items
        const equippedItems = await getEquippedItems(interaction.user.id);

        // Separate items by type
        const regularItems = inventory.filter(item => !item.slot_id);
        const equipmentItems = inventory.filter(item => item.slot_id);

        // Group equipment by slot
        const equipmentBySlot = equipmentItems.reduce((acc, item) => {
            if (!acc[item.slot_id]) acc[item.slot_id] = [];
            acc[item.slot_id].push(item);
            return acc;
        }, {});

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle(`${interaction.user.username}'s Inventory`)
            .addFields({
                name: '💰 Currencies',
                value: `**Mochi**: ${userData?.Tickets || 0} 🍡\n**Waterlily**: ${userData?.Waterlily || 0} 🌺`,
                inline: false
            });

        // Add regular items if any
        if (regularItems.length > 0) {
            // Group regular items by name to combine different versions
            const groupedItems = regularItems.reduce((acc, item) => {
                if (!acc[item.name]) acc[item.name] = 0;
                acc[item.name] += item.quantity;
                return acc;
            }, {});

            embed.addFields({
                name: '📦 Regular Items',
                value: Object.entries(groupedItems)
                    .map(([name, quantity]) => `${name} (x${quantity})`)
                    .join('\n'),
                inline: false
            });
        }

        // Add equipment by slot
        const slotDisplayNames = {
            head: '🎭 Head Items',
            neck: '📿 Neck Items',
            chest: '🦺 Chest Items',
            hands: '🧤 Hand Items',
            ring: '💍 Rings',
            weapon: '⚔️ Weapons'
        };

        for (const [slot, items] of Object.entries(equipmentBySlot)) {
            if (items.length > 0) {
                embed.addFields({
                    name: slotDisplayNames[slot] || `${slot} Items`,
                    value: items.map(item => {
                        const stats = [];
                        if (item.attack) stats.push(`⚔️${item.attack}`);
                        if (item.defense) stats.push(`🛡️${item.defense}`);
                        if (item.speed) stats.push(`⚡${item.speed}`);
                        return `${item.icon || '🔰'} ${item.name} (x${item.quantity}) [${item.rarity}]\n` +
                               `Stats: ${stats.join(' ') || 'None'}`;
                    }).join('\n\n'),
                    inline: false
                });
            }
        }

        // Add equipped items section
        if (equippedItems.length > 0) {
            const equippedField = equippedItems.map(item => {
                const stats = [];
                if (item.attack) stats.push(`⚔️${item.attack}`);
                if (item.defense) stats.push(`🛡️${item.defense}`);
                if (item.speed) stats.push(`⚡${item.speed}`);
                return `${slotDisplayNames[item.slot_id]?.split(' ')[0] || '🔰'} ` +
                       `${item.name} [${item.rarity}]\n` +
                       `Stats: ${stats.join(' ') || 'None'}`;
            }).join('\n\n');

            embed.addFields({
                name: '🎽 Equipped Items',
                value: equippedField,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Error in inventory command:', error);
        await interaction.editReply('An error occurred while fetching your inventory.');
    }
}

// Handle equipment display command
async function handleEquipmentCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const { equipment, stats } = await getEquipmentDisplay(interaction.user.id);

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle(`${interaction.user.username}'s Equipment`)
            .setThumbnail(interaction.user.displayAvatarURL());

        // Add stats field
        embed.addFields({
            name: '📊 Character Stats',
            value: `⚔️ Attack: ${stats.attack}\n` +
                   `🛡️ Defense: ${stats.defense}\n` +
                   `⚡ Speed: ${stats.speed}`,
            inline: false
        });

        // Create equipment slots display
        const slotDisplayNames = {
            head: '🎭 Head',
            neck: '📿 Neck',
            chest: '🦺 Chest',
            hands: '🧤 Hands',
            ring: '💍 Ring',
            weapon: '⚔️ Weapon'
        };

        // Add equipment slots
        equipment.forEach(slot => {
            const itemInfo = slot.item_name ? 
                `${slot.icon || '🔰'} ${slot.item_name} [${slot.rarity}]\n` +
                `Stats: ${[
                    slot.attack ? `⚔️${slot.attack}` : '',
                    slot.defense ? `🛡️${slot.defense}` : '',
                    slot.speed ? `⚡${slot.speed}` : ''
                ].filter(Boolean).join(' ') || 'None'}`
                : 'Empty';

            embed.addFields({
                name: slotDisplayNames[slot.slot_id] || slot.slot_name,
                value: itemInfo,
                inline: true
            });
        });

        embed.setFooter({ 
            text: 'Use /equip to equip items and /unequip to remove them' 
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Error in equipment command:', error);
        await interaction.editReply('An error occurred while fetching your equipment.');
    }
}

// Handle equip command
async function handleEquipCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        // Get user's inventory with versions
        const inventory = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    ui.item_id,
                    ui.version_id,
                    ui.quantity,
                    ui.shop_type,
                    iv.name,
                    iv.rarity,
                    iv.attack,
                    iv.defense,
                    iv.speed,
                    iv.icon,
                    iv.slot_id,
                    e.id as equipment_id
                FROM user_inventory ui
                JOIN item_versions iv ON ui.version_id = iv.id
                JOIN equipment_items e ON ui.item_id = e.id
                WHERE ui.Discord = ? AND ui.quantity > 0
                ORDER BY iv.slot_id, iv.name
            `, [interaction.user.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (inventory.length === 0) {
            await interaction.editReply({ content: 'You have no equipment items to equip!' });
            return;
        }

        // Group items by slot
        const itemsBySlot = inventory.reduce((acc, item) => {
            if (!acc[item.slot_id]) {
                acc[item.slot_id] = [];
            }
            acc[item.slot_id].push(item);
            return acc;
        }, {});

        // Create select menus for each slot that has items
        const components = Object.entries(itemsBySlot).map(([slot, items]) => {
            const slotNames = {
                head: '🎭 Head',
                neck: '📿 Neck',
                chest: '🦺 Chest',
                hands: '🧤 Hands',
                ring: '💍 Ring',
                weapon: '⚔️ Weapon'
            };

            return new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`equip_${slot}`)
                        .setPlaceholder(`Select ${slotNames[slot] || slot} Equipment`)
                        .addOptions(
                            // Use a unique index for each item to avoid duplicates
                            items.map((item, index) => ({
                                label: item.name,
                                description: `${item.rarity} - ATK:${item.attack || 0} DEF:${item.defense || 0} SPD:${item.speed || 0}`,
                                // Add the index to make it unique
                                value: `${item.item_id}__${index}`,
                                emoji: item.icon || '🔰'
                            }))
                        )
                );
        });

        await interaction.editReply({
            content: 'Select an item to equip:',
            components: components
        });
    } catch (error) {
        console.error('❌ Error in equip command:', error);
        await interaction.editReply({ 
            content: 'An error occurred while preparing equipment options.',
            ephemeral: true
        });
    }
}

// Handle unequip command
async function handleUnequipCommand(interaction) {
    try {
        const slotId = interaction.options.getString('slot');
        await interaction.deferReply({ ephemeral: true });

        await unequipSlot(interaction.user.id, slotId);
        await interaction.editReply(`✅ Successfully unequipped item from ${slotId} slot!`);
    } catch (error) {
        console.error('❌ Error in unequip command:', error);
        await interaction.editReply('An error occurred while unequipping the item.');
    }
}

// Handle equip selection from dropdown
async function handleEquipSelection(interaction) {
    try {
        await interaction.deferUpdate();
        const [slotId] = interaction.customId.split('_').slice(1);
        const selectedValue = interaction.values[0];
        
        // Extract the item ID by removing the index
        const itemId = selectedValue.split('__')[0];
        
        const equipment = await equipItem(interaction.user.id, itemId);
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Item Equipped!')
            .setDescription(`Successfully equipped **${equipment.name}** to ${slotId} slot!`)
            .addFields(
                {
                    name: '📊 Stats',
                    value: `${equipment.attack ? `⚔️ Attack: ${equipment.attack}\n` : ''}` +
                           `${equipment.defense ? `🛡️ Defense: ${equipment.defense}\n` : ''}` +
                           `${equipment.speed ? `⚡ Speed: ${equipment.speed}\n` : ''}`,
                    inline: true
                },
                {
                    name: '🏷️ Type',
                    value: `${equipment.rarity} ${slotId.charAt(0).toUpperCase() + slotId.slice(1)}`,
                    inline: true
                }
            );

        await interaction.editReply({
            content: null,
            embeds: [embed],
            components: []
        });
    } catch (error) {
        console.error('❌ Error handling equip selection:', error);
        await interaction.editReply({
            content: '❌ An error occurred while equipping the item: ' + error.message,
            components: []
        });
    }
}

// ============================================================================
// REMAINING COMMAND HANDLERS & UTILITY FUNCTIONS
// ============================================================================
// This section contains handlers for trading, gacha, polls, raffles,
// special features, and various utility functions
// ============================================================================

// ============================================================================
// TRADING SYSTEM HANDLERS
// ============================================================================

// Handle trade command with different trade types
async function handleTradeCommand(interaction) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        }

        const sender = interaction.user.id;
        const receiver = interaction.options.getUser('user');
        const tradeType = interaction.options.getString('type');
        const amount = interaction.options.getInteger('amount');

        // Validation checks
        if (!receiver) {
            await interaction.editReply("❌ Please select a valid user to trade with.");
            return;
        }

        if (sender === receiver.id) {
            await interaction.editReply("❌ You can't trade with yourself!");
            return;
        }

        if (!amount || amount <= 0) {
            await interaction.editReply("❌ The amount must be greater than 0.");
            return;
        }

        console.log(`💱 Processing trade: ${sender} → ${receiver.id} (${tradeType}: ${amount})`);

        if (tradeType === 'item') {
            await handleItemTradeSelection(interaction, sender, receiver, amount);
        } else {
            const userData = await getUserData(sender);
            const currencyAmount = tradeType === 'mochi' ? userData?.Tickets : userData?.Waterlily;
            const currencyName = tradeType === 'mochi' ? 'Mochi' : 'Waterlily';

            if (!currencyAmount || currencyAmount < amount) {
                await interaction.editReply(`❌ You don't have enough ${currencyName} to make this trade. You have ${currencyAmount || 0} but need ${amount}.`);
                return;
            }

            try {
                if (tradeType === 'mochi') {
                    await tradeMochi(sender, receiver.id, amount);
                } else {
                    await tradeWaterlily(sender, receiver.id, amount);
                }

                const emoji = tradeType === 'mochi' ? '🍡' : '🌺';
                await interaction.editReply(`✅ Successfully traded ${amount} ${currencyName} ${emoji} to ${receiver}!`);

                // Log the trade
                const logChannel = client.channels.cache.get(NOTIFICATION_CHANNEL);
                if (logChannel) {
                    await logChannel.send(`💱 ${interaction.user.tag} traded ${amount} ${currencyName} to ${receiver.tag}`);
                }
            } catch (error) {
                await interaction.editReply(`❌ ${error.message || 'An error occurred during the trade.'}`);
            }
        }
    } catch (error) {
        console.error('❌ Error in trade command:', error);
        if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ An error occurred while processing the trade.',
                components: []
            }).catch(console.error);
        }
    }
}

// Handle item trade selection with dropdown
async function handleItemTradeSelection(interaction, sender, receiver, amount) {
    const inventory = await getUserInventory(sender);
    
    // Create select menu options for items
    const options = inventory.map((item, index) => ({
        label: `${item.name} (You have: ${item.quantity})`,
        value: `${item.shop_type}:${item.name}:${index}`, // Add index to make it unique
        description: `Trade ${item.name}`,
        emoji: item.shop_type === 'mochi' ? '🍡' : '🌺'
    }));

    if (options.length === 0) {
        await interaction.editReply("❌ You don't have any items to trade!");
        return;
    }

    // Create the select menu
    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`trade_select_${receiver.id}_${amount}`)
                .setPlaceholder('Select item to trade')
                .addOptions(options)
        );

    await interaction.editReply({
        content: `Select what you want to trade with ${receiver}:`,
        components: [row]
    });
}

// Handle trade selection from dropdown
async function handleTradeSelection(interaction) {
    try {
        await interaction.deferUpdate();
        const [, , receiverId, amount] = interaction.customId.split('_');
        const [shopType, itemName, _] = interaction.values[0].split(':'); // Ignore the index
        const amountNum = parseInt(amount);

        console.log(`📦 Processing item trade: ${itemName} (x${amountNum}) to ${receiverId}`);

        try {
            await tradeItem(interaction.user.id, receiverId, itemName, amountNum);
            const emoji = shopType === 'mochi' ? '🍡' : '🌺';
            
            await interaction.editReply({
                content: `✅ Successfully traded ${amountNum}x **${itemName}** ${emoji} to <@${receiverId}>!`,
                components: []
            });

            // Log the trade
            const logChannel = interaction.client.channels.cache.get(NOTIFICATION_CHANNEL);
            if (logChannel) {
                await logChannel.send(
                    `📦 ${interaction.user.tag} traded **${itemName}** (x${amountNum}) to <@${receiverId}>`
                );
            }
        } catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message || 'An error occurred during the trade.'}`,
                components: []
            });
        }
    } catch (error) {
        console.error('❌ Error in handleTradeSelection:', error);
        await interaction.editReply({
            content: '❌ An error occurred while processing the trade.',
            components: []
        });
    }
}

// Handle currency conversion command
async function handleConvertCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const mochiAmount = interaction.options.getInteger('mochi');
        if (mochiAmount < 3 || mochiAmount % 3 !== 0) {
            await interaction.editReply('❌ Please enter a number of Mochi that is divisible by 3.');
            return;
        }

        const waterlilyAmount = Math.floor(mochiAmount / 3);
        const userId = interaction.user.id;

        console.log(`💱 Converting currency: ${userId} converting ${mochiAmount} Mochi to ${waterlilyAmount} Waterlily`);

        try {
            const result = await convertMochiToWaterlily(userId, mochiAmount);

            const embed = new EmbedBuilder()
                .setColor(0x4CA3DD)
                .setTitle('💱 Currency Conversion')
                .setDescription(`Successfully converted ${mochiAmount} Mochi to ${waterlilyAmount} Waterlilies!`)
                .addFields(
                    { name: '🍡 Mochi Spent', value: `${mochiAmount}`, inline: true },
                    { name: '🌺 Waterlilies Received', value: `${waterlilyAmount}`, inline: true }
                );

            await interaction.editReply({ embeds: [embed] });

            const logChannel = interaction.client.channels.cache.get(NOTIFICATION_CHANNEL);
            if (logChannel) {
                await logChannel.send(`💱 ${interaction.user.tag} converted ${mochiAmount} Mochi to ${waterlilyAmount} Waterlilies`);
            }
        } catch (error) {
            await interaction.editReply(`❌ ${error.message}`);
        }
    } catch (error) {
        console.error('❌ Error in convert command:', error);
        await interaction.editReply('❌ An error occurred during the conversion.');
    }
}

// ============================================================================
// POLL SYSTEM
// ============================================================================

// Active polls storage
const activePolls = new Map();

// Poll class for managing poll state
class Poll {
    constructor(channelId, authorId, title, description, options, duration, multipleChoice = false, imageUrl = null) {
        this.channelId = channelId;
        this.authorId = authorId;
        this.title = title;
        this.description = description;
        this.options = options.map(opt => ({
            text: opt,
            votes: new Set()
        }));
        this.endTime = Date.now() + (duration * 60 * 1000); // Convert minutes to milliseconds
        this.multipleChoice = multipleChoice;
        this.imageUrl = imageUrl;
        this.messageId = null;
        
        // Custom emojis for first 15, then standard emojis for remaining
        this.emojis = [
            '<:wasabi:1076533668006342716>',
            '<:happyrice:1076533660410454196>',
            '<:Ochakohehe:1271097441361596439>',
            '<:Ochakowaaa:1271097443244572764>',
            '<:tanuki:1217055974288916520>',
            '<:attendant2:1225025653540257895>',
            '<:attendant:1217053524349685780>',
            '<:LilyFlower:1333149574302531614>',
            '<:veggied:1076533655180165170>',
            '<:snowmon:1225025667251572836>',
            '<:manager:1210827062042955836>',
            '<:inv:1144321553371234355>',
            '<:formal:1076534367746265128>',
            '<:cudevil:1076533656513957919>',
            '<:bouncin:1076533663820419164>',
            '🔴', '🟡', '🟢', '🔵', '🟣', '⚪', '🟤', '🟦', '🟨', '🟩',
            '🔷', '🔶', '💠', '🔺', '🔹'
        ];
    }

    getVoteCount(optionIndex) {
        return this.options[optionIndex].votes.size;
    }

    getTotalVotes() {
        return this.options.reduce((sum, opt) => sum + opt.votes.size, 0);
    }

    getProgressBar(optionIndex) {
        const totalVotes = this.getTotalVotes();
        const optionVotes = this.getVoteCount(optionIndex);
        const percentage = totalVotes === 0 ? 0 : (optionVotes / totalVotes) * 100;
        const barLength = 10; // Length of the progress bar in emojis
        const filledLength = Math.round((percentage / 100) * barLength);
        return this.emojis[optionIndex].repeat(filledLength); // Just emojis, no empty spaces
    }

    createEmbed() {
        const timeLeft = Math.max(0, this.endTime - Date.now());
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle(this.title)
            .setDescription(`${this.description ? this.description + '\n\n' : ''}Time remaining: ${hoursLeft}h ${minutesLeft}m\n${this.multipleChoice ? '(Multiple choices allowed)' : '(Single choice only)'}`)
            .addFields(
                this.options.map((opt, i) => ({
                    name: `${this.emojis[i]} ${opt.text} (${this.getVoteCount(i)} votes)`,
                    value: this.getProgressBar(i) || '⠀', // Empty unicode character if no votes
                    inline: false
                }))
            )
            .setFooter({ text: `Total votes: ${this.getTotalVotes()}` })
            .setTimestamp();

        if (this.imageUrl) {
            embed.setImage(this.imageUrl);
        }

        return embed;
    }

    createButtons() {
        // Create button rows (max 5 buttons per row)
        const rows = [];
        for (let i = 0; i < this.options.length; i += 5) {
            const row = new ActionRowBuilder();
            const buttonsInRow = this.options.slice(i, i + 5);
            
            buttonsInRow.forEach((_, index) => {
                const globalIndex = i + index;
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`poll_vote_${globalIndex}`)
                        .setEmoji(this.emojis[globalIndex])
                        .setStyle(ButtonStyle.Secondary)
                );
            });
            
            rows.push(row);
        }

        // Add control buttons in a new row
        const controlRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('poll_end')
                    .setLabel('End Poll')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('poll_cancel')
                    .setLabel('Cancel Poll')
                    .setStyle(ButtonStyle.Secondary)
            );
        rows.push(controlRow);

        return rows;
    }

    addVote(userId, optionIndex) {
        if (!this.multipleChoice) {
            // Remove existing votes if single choice
            this.options.forEach(opt => opt.votes.delete(userId));
        }
        this.options[optionIndex].votes.add(userId);
    }

    removeVote(userId, optionIndex) {
        this.options[optionIndex].votes.delete(userId);
    }

    hasEnded() {
        return Date.now() >= this.endTime;
    }
}

// Handle poll creation command
async function handlePollCommand(interaction) {
    try {
        await interaction.deferReply();

        console.log(`📊 Creating poll: ${interaction.user.id} - ${interaction.options.getString('title')}`);

        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        
        // Gather all options (up to 17)
        const options = [];
        for (let i = 1; i <= 17; i++) {
            const option = interaction.options.getString(`option${i}`);
            if (option) options.push(option);
        }

        const hours = interaction.options.getInteger('hours');
        const minutes = interaction.options.getInteger('minutes');
        const duration = (hours * 60) + minutes;
        const multipleChoice = interaction.options.getBoolean('multiple_choice') ?? false;
        const image = interaction.options.getAttachment('image');

        const poll = new Poll(
            interaction.channelId,
            interaction.user.id,
            title,
            description,
            options,
            duration,
            multipleChoice,
            image?.url
        );

        const message = await interaction.editReply({
            embeds: [poll.createEmbed()],
            components: poll.createButtons()
        });

        poll.messageId = message.id;
        activePolls.set(message.id, poll);

        // Set up auto-update interval
        const updateInterval = setInterval(async () => {
            const currentPoll = activePolls.get(message.id);
            if (!currentPoll || currentPoll.hasEnded()) {
                clearInterval(updateInterval);
                if (currentPoll) {
                    await handlePollEnd(message, currentPoll);
                }
                return;
            }

            try {
                await message.edit({
                    embeds: [currentPoll.createEmbed()],
                    components: currentPoll.createButtons()
                });
            } catch (error) {
                console.error('❌ Error updating poll:', error);
                clearInterval(updateInterval);
            }
        }, 60000); // Update every minute

    } catch (error) {
        console.error('❌ Error creating poll:', error);
        await interaction.editReply('❌ An error occurred while creating the poll.');
    }
}

// Handle poll voting
async function handlePollVote(interaction) {
    const poll = activePolls.get(interaction.message.id);
    if (!poll) {
        await interaction.reply({
            content: '❌ This poll has ended or is no longer valid.',
            ephemeral: true
        });
        return;
    }

    if (poll.hasEnded()) {
        await interaction.reply({
            content: '❌ This poll has ended.',
            ephemeral: true
        });
        return;
    }

    const optionIndex = parseInt(interaction.customId.split('_')[2]);
    const userId = interaction.user.id;

    if (poll.options[optionIndex].votes.has(userId)) {
        poll.removeVote(userId, optionIndex);
    } else {
        poll.addVote(userId, optionIndex);
    }

    await interaction.update({
        embeds: [poll.createEmbed()],
        components: poll.createButtons()
    });
}

// Handle poll control (end/cancel)
async function handlePollControl(interaction) {
    const poll = activePolls.get(interaction.message.id);
    if (!poll || interaction.user.id !== poll.authorId) {
        await interaction.reply({
            content: '❌ You do not have permission to control this poll.',
            ephemeral: true
        });
        return;
    }

    if (interaction.customId === 'poll_end') {
        await handlePollEnd(interaction.message, poll);
        await interaction.reply({
            content: '✅ Poll ended successfully.',
            ephemeral: true
        });
    } else if (interaction.customId === 'poll_cancel') {
        await handlePollEnd(interaction.message, poll, true);
        await interaction.reply({
            content: '✅ Poll cancelled successfully.',
            ephemeral: true
        });
    }
}

// Handle poll ending
async function handlePollEnd(message, poll, cancelled = false) {
    const finalEmbed = new EmbedBuilder()
        .setColor(cancelled ? 0xFF0000 : 0x00FF00)
        .setTitle(`${cancelled ? '❌ Poll Cancelled' : '✅ Poll Ended'}: ${poll.title}`)
        .addFields(
            poll.options.map((opt, i) => ({
                name: `${opt.text} (${poll.getVoteCount(i)} votes)`,
                value: poll.getProgressBar(i),
                inline: false
            }))
        )
        .setFooter({ text: `Total votes: ${poll.getTotalVotes()}` })
        .setTimestamp();

    if (poll.imageUrl) {
        finalEmbed.setImage(poll.imageUrl);
    }

    await message.edit({
        embeds: [finalEmbed],
        components: []
    });

    activePolls.delete(message.id);
}

// ============================================================================
// RAFFLE SYSTEM
// ============================================================================

// Active raffles storage
const activeRaffles = new Map();

// Raffle class for managing raffle state
class Raffle {
    constructor(channel, title, description, imageUrl, duration, type, options) {
        this.channel = channel;
        this.title = title;
        this.description = description;
        this.imageUrl = imageUrl;
        this.endTime = Date.now() + (duration * 60 * 60 * 1000);
        this.type = type;
        this.options = options;
        this.participants = new Map();
        this.messageId = null;
    }

    createEmbed() {
        const timeLeft = Math.max(0, this.endTime - Date.now());
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        return new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle(this.title)
            .setDescription(this.description)
            .addFields(
                { name: 'Time Remaining', value: `${hoursLeft}h ${minutesLeft}m` },
                { name: 'Participants', value: `${this.participants.size}` },
                { name: 'Raffle Type', value: this.type },
                { 
                    name: this.type === 'role' ? 'Eligible Roles' : 'Entry Cost', 
                    value: this.type === 'role' 
                        ? this.options.roles.map(role => `<@&${role}>`).join(', ')
                        : `1 entry per ${this.options.cost} ${this.type}`
                }
            )
            .setImage(this.imageUrl)
            .setTimestamp();
    }

    async addParticipant(member, entries = 1) {
        const currentEntries = this.participants.get(member.id) || 0;
        this.participants.set(member.id, currentEntries + entries);
        return true;
    }

    selectWinner() {
        if (this.participants.size === 0) return null;
        
        const entries = [];
        this.participants.forEach((entryCount, userId) => {
            for (let i = 0; i < entryCount; i++) {
                entries.push(userId);
            }
        });
        
        return entries[Math.floor(Math.random() * entries.length)];
    }
}

// Handle raffle creation
async function handleRaffleCreate(interaction) {
    try {
        if (!interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await interaction.reply({ 
                content: '❌ You need administrator permissions to create a raffle',
                flags: ['Ephemeral']
            });
            return;
        }

        const type = interaction.options.getString('type');
        const duration = interaction.options.getNumber('duration');
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const imageUrl = interaction.options.getString('image_url');

        console.log(`🎟️ Creating raffle: ${title} (${type}, ${duration}h)`);

        let raffleOptions;
        switch (type) {
            case 'role':
                const rolesInput = interaction.options.getString('roles');
                if (!rolesInput) {
                    await interaction.reply({ 
                        content: '❌ Missing roles for role-based raffle',
                        flags: ['Ephemeral']
                    });
                    return;
                }
                raffleOptions = { roles: rolesInput.split(',').map(r => r.trim()) };
                break;
            case 'mochi':
            case 'waterlily':
                const cost = interaction.options.getInteger('cost');
                if (!cost) {
                    await interaction.reply({ 
                        content: `❌ Missing cost for ${type}-based raffle`,
                        flags: ['Ephemeral']
                    });
                    return;
                }
                raffleOptions = { cost };
                break;
        }

        const raffle = new Raffle(
            interaction.channel,
            title,
            description,
            imageUrl,
            duration,
            type,
            raffleOptions
        );

        const joinButton = new ButtonBuilder()
            .setCustomId('join_raffle')
            .setLabel('Join Raffle')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(joinButton);

        const raffleMessage = await interaction.channel.send({
            embeds: [raffle.createEmbed()],
            components: [row]
        });

        raffle.messageId = raffleMessage.id;
        activeRaffles.set(raffleMessage.id, raffle);

        // Set up update interval
        const updateInterval = setInterval(async () => {
            if (Date.now() >= raffle.endTime) {
                clearInterval(updateInterval);
                const winner = raffle.selectWinner();
                
                const finalEmbed = new EmbedBuilder()
                    .setColor(0x00AE86)
                    .setTitle(`${raffle.title} - Ended`)
                    .setDescription(raffle.description)
                    .addFields(
                        { name: 'Winner', value: winner ? `<@${winner}>` : 'No participants' },
                        { name: 'Total Participants', value: `${raffle.participants.size}` }
                    )
                    .setImage(raffle.imageUrl)
                    .setTimestamp();

                await raffleMessage.edit({
                    embeds: [finalEmbed],
                    components: []
                });

                // Log the winner
                const logChannel = interaction.client.channels.cache.get(NOTIFICATION_CHANNEL);
                if (logChannel) {
                    await logChannel.send(
                        `🎟️ Raffle "${title}" has ended. Winner: ${winner ? `<@${winner}>` : 'No winner'}`
                    );
                }

                activeRaffles.delete(raffleMessage.id);
            } else {
                await raffleMessage.edit({
                    embeds: [raffle.createEmbed()],
                    components: [row]
                });
            }
        }, 60000);

        await interaction.reply({ 
            content: '✅ Raffle created successfully!',
            flags: ['Ephemeral']
        });
    } catch (error) {
        console.error('❌ Error creating raffle:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while creating the raffle',
            flags: ['Ephemeral']
        });
    }
}

// Handle raffle joining
async function handleRaffleJoin(interaction) {
    try {
        const messageId = interaction.message.id;
        const raffle = activeRaffles.get(messageId);
        
        if (!raffle) {
            await interaction.reply({
                content: '❌ This raffle has ended or is no longer valid',
                flags: ['Ephemeral']
            });
            return;
        }

        console.log(`🎟️ User ${interaction.user.id} joining raffle: ${raffle.title}`);

        switch (raffle.type) {
            case 'role':
                if (!raffle.options.roles.some(roleId => 
                    interaction.member.roles.cache.has(roleId))) {
                    await interaction.reply({
                        content: '❌ You don\'t have the required role to join this raffle',
                        flags: ['Ephemeral']
                    });
                    return;
                }
                await raffle.addParticipant(interaction.member);
                await interaction.reply({
                    content: '✅ You have successfully joined the raffle!',
                    flags: ['Ephemeral']
                });
                break;

            case 'mochi':
            case 'waterlily':
                const column = raffle.type === 'mochi' ? 'Tickets' : 'Waterlily';
                
                // Check currency balance
                const balance = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT ${column} FROM users WHERE Discord = ?`,
                        [interaction.user.id],
                        (err, row) => err ? reject(err) : resolve(row?.[column] || 0)
                    );
                });

                const maxEntries = Math.floor(balance / raffle.options.cost);
                if (maxEntries <= 0) {
                    await interaction.reply({
                        content: `❌ You need at least ${raffle.options.cost} ${raffle.type} to enter`,
                        flags: ['Ephemeral']
                    });
                    return;
                }

                // Create and show the modal with raffle ID embedded in customId
                const modal = new ModalBuilder()
                    .setCustomId(`raffle_entry_${messageId}`)
                    .setTitle('Enter Raffle');

                const entriesInput = new TextInputBuilder()
                    .setCustomId('entries_amount')
                    .setLabel(`How many entries? (Max: ${maxEntries})`)
                    .setPlaceholder(`You have ${balance} ${raffle.type}`)
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(4)
                    .setRequired(true);

                const actionRow = new ActionRowBuilder().addComponents(entriesInput);
                modal.addComponents(actionRow);

                await interaction.showModal(modal);
                break;
        }

        // Update raffle message
        await interaction.message.edit({
            embeds: [raffle.createEmbed()]
        });
    } catch (error) {
        console.error('❌ Error joining raffle:', error);
        if (interaction.isRepliable()) {
            await interaction.reply({
                content: '❌ An error occurred while joining the raffle',
                flags: ['Ephemeral']
            });
        }
    }
}

// Handle raffle entry modal submission
async function handleRaffleEntry(interaction) {
    try {
        const messageId = interaction.customId.split('_')[2];
        const raffle = activeRaffles.get(messageId);
        
        if (!raffle) {
            await interaction.reply({
                content: '❌ This raffle has ended or is no longer valid',
                ephemeral: true
            });
            return;
        }

        const entriesAmount = parseInt(interaction.fields.getTextInputValue('entries_amount'));
        const column = raffle.type === 'mochi' ? 'Tickets' : 'Waterlily';
        const totalCost = entriesAmount * raffle.options.cost;

        console.log(`🎟️ Processing raffle entry: ${entriesAmount} entries for ${totalCost} ${raffle.type}`);

        // Validate and process payment
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                db.get(`SELECT ${column} FROM users WHERE Discord = ?`, [interaction.user.id], (err, user) => {
                    if (err || !user || user[column] < totalCost) {
                        db.run('ROLLBACK');
                        return reject(new Error(`Insufficient ${raffle.type}`));
                    }

                    db.run(`UPDATE users SET ${column} = ${column} - ? WHERE Discord = ?`, 
                        [totalCost, interaction.user.id], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            reject(err);
                        } else {
                            db.run('COMMIT');
                            resolve();
                        }
                    });
                });
            });
        });

        await raffle.addParticipant(interaction.member, entriesAmount);

        await interaction.reply({
            content: `✅ Successfully entered raffle with ${entriesAmount} entries for ${totalCost} ${raffle.type}!`,
            ephemeral: true
        });

        // Update raffle message
        const raffleMessage = await interaction.client.channels.cache.get(raffle.channel.id).messages.fetch(messageId);
        await raffleMessage.edit({
            embeds: [raffle.createEmbed()]
        });

    } catch (error) {
        console.error('❌ Error processing raffle entry:', error);
        await interaction.reply({
            content: `❌ ${error.message || 'An error occurred while processing your entry'}`,
            ephemeral: true
        });
    }
}

// ============================================================================
// ADMIN COMMAND HANDLERS
// ============================================================================

// Handle admin give command
async function handleAdminGive(interaction) {
    try {
        if (!isAdmin(interaction.member)) {
            await interaction.reply({ 
                content: '❌ You do not have permission to use this command.', 
                ephemeral: true 
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        const targetUser = interaction.options.getUser('user');
        const currency = interaction.options.getString('currency');
        const amount = interaction.options.getInteger('amount');

        const column = currency === 'mochi' ? 'Tickets' : 'Waterlily';
        const currencyName = currency === 'mochi' ? 'Mochi' : 'Waterlily';
        const emoji = currency === 'mochi' ? '🍡' : '🌺';

        console.log(`💰 Admin give: ${amount} ${currencyName} to ${targetUser.tag}`);

        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO users (Discord, Tickets, Waterlily)
                VALUES (?, 
                    CASE WHEN ? = 'Tickets' THEN ? ELSE 0 END,
                    CASE WHEN ? = 'Waterlily' THEN ? ELSE 0 END)
                ON CONFLICT(Discord)
                DO UPDATE SET ${column} = ${column} + ?
            `, [targetUser.id, column, amount, column, amount, amount], err => {
                if (err) reject(err);
                else resolve();
            });
        });

        const logChannel = client.channels.cache.get(NOTIFICATION_CHANNEL);
        if (logChannel) {
            await logChannel.send(`💰 ${amount} ${currencyName} were given to ${targetUser.tag} by ${interaction.user.tag}`);
        }

        await interaction.editReply(`✅ Successfully gave ${amount} ${currencyName} ${emoji} to ${targetUser.tag}`);
    } catch (error) {
        console.error('❌ Error in admin give command:', error);
        await interaction.editReply('❌ An error occurred while giving currency.');
    }
}

// Handle admin stats command
async function handleAdminStats(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const currency = interaction.options.getString('currency');
        
        let query = '';
        if (currency === 'mochi') {
            query = 'SELECT COUNT(*) as users, SUM(Tickets) as total, AVG(Tickets) as average FROM users WHERE Tickets > 0';
        } else if (currency === 'waterlily') {
            query = 'SELECT COUNT(*) as users, SUM(Waterlily) as total, AVG(Waterlily) as average FROM users WHERE Waterlily > 0';
        } else {
            query = `
                SELECT 
                    COUNT(*) as users,
                    SUM(Tickets) as total_mochi,
                    AVG(Tickets) as avg_mochi,
                    SUM(Waterlily) as total_waterlily,
                    AVG(Waterlily) as avg_waterlily
                FROM users 
                WHERE Tickets > 0 OR Waterlily > 0
            `;
        }

        const stats = await new Promise((resolve, reject) => {
            db.get(query, (err, row) => err ? reject(err) : resolve(row));
        });

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('📊 Currency Statistics')
            .setDescription(
                currency === 'both' 
                    ? `Users: ${stats.users}\n` +
                      `Total Mochi: ${stats.total_mochi || 0}\n` +
                      `Average Mochi: ${Math.round((stats.avg_mochi || 0) * 100) / 100}\n` +
                      `Total Waterlily: ${stats.total_waterlily || 0}\n` +
                      `Average Waterlily: ${Math.round((stats.avg_waterlily || 0) * 100) / 100}`
                    : `Users: ${stats.users}\n` +
                      `Total: ${stats.total || 0}\n` +
                      `Average: ${Math.round((stats.average || 0) * 100) / 100}`
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Error in admin stats command:', error);
        await interaction.editReply('❌ An error occurred while fetching statistics.');
    }
}

// Handle admin leaderboard command
async function handleAdminLeaderboard(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const currency = interaction.options.getString('currency');
        
        const column = currency === 'mochi' ? 'Tickets' : 'Waterlily';
        const results = await new Promise((resolve, reject) => {
            db.all(
                `SELECT Discord, ${column} as amount FROM users WHERE ${column} > 0 ORDER BY ${column} DESC LIMIT 10`,
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        if (results.length === 0) {
            await interaction.editReply('❌ No users found with currency.');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle(`${currency === 'mochi' ? '🍡' : '🌺'} Top 10 ${currency === 'mochi' ? 'Mochi' : 'Waterlily'} Holders`)
            .setDescription(
                results.map((row, index) => 
                    `${index + 1}. <@${row.Discord}>: ${row.amount}`
                ).join('\n')
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Error in admin leaderboard command:', error);
        await interaction.editReply('❌ An error occurred while fetching leaderboard.');
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Check if member has admin permissions
function isAdmin(member) {
    return member.roles.cache.some(role => 
        role.name === 'Team' || role.name === 'Admin'
    );
}

// Split long messages into chunks
function splitMessage(message, maxLength = 2000) {
    if (message.length <= maxLength) return [message];
    
    const lines = message.split('\n');
    const chunks = [];
    let currentChunk = '';
    
    for (const line of lines) {
        if (currentChunk.length + line.length + 1 > maxLength) {
            chunks.push(currentChunk);
            currentChunk = '';
        }
        currentChunk += line + '\n';
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}

// Shuffle array for random selection
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Safe interaction reply helper
async function safeReply(interaction, replyOptions) {
    try {
        if (!interaction.isRepliable()) {
            console.log('⚠️ Interaction is no longer valid for reply');
            return;
        }
        
        if (interaction.deferred) {
            await interaction.editReply(replyOptions);
        } else if (interaction.replied) {
            await interaction.followUp(replyOptions);
        } else {
            await interaction.reply(replyOptions);
        }
    } catch (error) {
        console.error('❌ Error in safeReply:', error);
    }
}

// Create loading bar for progress indicators
function createLoadingBar(current, total) {
    const barLength = 20;
    const filledLength = Math.round((current / total) * barLength);
    const bar = '▓'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    return `\`${bar}\` ${current}/${total}`;
}

// Handle loading bar command for demonstrations
async function handleLoadingBar(message, duration) {
    const totalSteps = 20;
    const stepDuration = (duration * 1000) / totalSteps;
    
    const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('⏳ Loading Progress')
        .setDescription(createLoadingBar(0, totalSteps));
    
    const progressMessage = await message.reply({ embeds: [embed] });
    
    for (let i = 1; i <= totalSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, stepDuration));
        
        const updatedEmbed = new EmbedBuilder()
            .setColor(i === totalSteps ? 0x00FF00 : 0x00AE86)
            .setTitle(i === totalSteps ? '✅ Complete!' : '⏳ Loading Progress')
            .setDescription(createLoadingBar(i, totalSteps));
        
        await progressMessage.edit({ embeds: [updatedEmbed] });
    }
}

// Fetch all messages from a thread (for bulk operations)
async function fetchAllMessages(thread) {
    let allMessages = [];
    let lastId = null;
    
    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        
        const messages = await thread.messages.fetch(options);
        allMessages.push(...messages.values());
        lastId = messages.last()?.id;
        
        if (messages.size !== 100) break;
    }
    
    return allMessages;
}

// ============================================================================
// COMMAND HANDLER COLLECTION
// ============================================================================

// Map of all command handlers for easy access
const commandHandlers = {
    // Equipment & Inventory
    'inventory': handleInventoryCommand,
    'equipment': handleEquipmentCommand,
    'equip': handleEquipCommand,
    'unequip': handleUnequipCommand,
    
    // Trading & Currency
    'trade': handleTradeCommand,
    'convert': handleConvertCommand,
    
    // Game Features
    'poll': handlePollCommand,
    'raffle': handleRaffleCreate,
    
    // Admin Commands
    'admin_give': handleAdminGive,
    'admin_stats': handleAdminStats,
    'admin_leaderboard': handleAdminLeaderboard,
    'setupshops': setupShops
};

// Main command handler function
async function handleSlashCommand(interaction) {
    const handler = commandHandlers[interaction.commandName];
    
    if (handler) {
        try {
            console.log(`⚡ Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
            await handler(interaction);
        } catch (error) {
            console.error(`❌ Error in command ${interaction.commandName}:`, error);
            
            const errorResponse = {
                content: '❌ An error occurred while processing your command.',
                ephemeral: true
            };
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply(errorResponse);
            } else if (interaction.deferred) {
                await interaction.editReply(errorResponse);
            } else {
                await interaction.followUp(errorResponse);
            }
        }
    } else {
        console.error(`❌ No handler found for command: ${interaction.commandName}`);
        await interaction.reply({
            content: '❌ Unknown command.',
            ephemeral: true
        });
    }
}

// ============================================================================
// EVENT HANDLERS, INITIALIZATION & BOT STARTUP
// ============================================================================
// This final section contains all Discord event handlers, bot initialization,
// scheduled tasks, and the main startup sequence
// ============================================================================

// ============================================================================
// TEA SYSTEM MESSAGES
// ============================================================================

// Messages for users who already have the tea role
const teaMessagesWithRole = [
    "You already had a tea today.",
    "You look like you already had a tea today.",
    "Dear guest, you already had a tea today.",
    "My programming does not require me to serve you more than once per day.",
    "I am not contractually obliged to serve you more than one tea per day.",
    "Haven't I already served you today?",
    "One tea was not enough for you? Dear guest?",
    "If you want another tea so badly, you can pour it yourself, dear guest.",
    "Too much tea is bad for you, you know.",
    "I'm afraid I must cut you off, dear guest. One tea per day.",
    "You're keen, but I'm programmed for moderation. No more tea today.",
    "Another tea? I'm not sure your kidneys would appreciate that.",
    "As much as I'd love to, rules are rules. One tea per day!",
    "You're already in the tea club for today, dear guest.",
    "Oh, look who's back for more. Sorry, no refills.",
    "One tea per customer, per day. Try again tomorrow!",
    "Seriously? You already had your tea fix today.",
    "I'm not your personal tea dispenser. Come back tomorrow.",
    "I don't make the rules, I just follow them. No more tea today.",
    "Double-dipping on tea is a no-go. See you tomorrow!",
    "Patience is a virtue. Wait until tomorrow for another tea.",
    "You've hit your tea limit. Take a break, dear guest.",
    "I can't keep serving you tea all day, you know.",
    "Didn't you already have your tea moment? Let's not be greedy.",
    "Tea time is over for you today. Try again tomorrow.",
    "No second servings, dear guest. One tea per day.",
    "I remember you! You've already had your tea.",
    "You've already had your tea fix. Let someone else enjoy."
];

// Messages for users who don't have the tea role yet
const teaMessagesWithoutRole = [
    "Enjoy your tea, dear guest. 🍵",
    "Enjoy your tea, O great and honored guest. 🍵",
    "I *love* pouring tea for guests. Here you go. 🍵",
    "Here is your tea, dear guest. 🍵",
    "Please help yourself to one of the teas over there. 🍵",
    "Here. 🍵",
    "Your tea is here. 🍵",
    "Tea. Right. Here you go. 🍵",
    "Another one? Here is your tea, dear guest. 🍵",
    "I am sworn to pour your tea for you. 🍵",
    "I am categorically unable to refuse your request. Here is your tea, dear guest. 🍵",
    "You all seem to enjoy our tea very much. 🍵",
    "Of course, dear guest. I have nothing better to do than to pour you a tea. 🍵",
    "Tea coming right up, dear guest. 🍵",
    "One tea, freshly poured just for you. 🍵",
    "Here's a hot cup, just for you! 🍵",
    "Enjoy this delightful brew. 🍵",
    "Your wish is my command. Tea is served. 🍵",
    "A perfect cup of tea, just for you. 🍵",
    "Here's your tea, served with a smile. 🍵",
    "Tea time is the best time. Enjoy! 🍵",
    "Here's your soothing cup of tea. 🍵",
    "One tea for you, enjoy!",
    "Sip, sip, hooray! Here's your tea.",
    "Your tea awaits, drink up!",
    "Freshly brewed and just for you!",
    "The tea party starts now. Enjoy!",
    "Here's your tea, piping hot!",
    "Your tea is served, dear guest.",
    "Enjoy your moment of tea bliss.",
    "Tea magic, just for you.",
    "Here's a cup of relaxation.",
    "One cup of tea happiness, coming up!",
    "Tea service with a smile!",
    "Enjoy this cup of pure delight.",
    "Your perfect tea moment is here.",
    "Tea time, just for you!",
    "Sip and savor, dear guest.",
    "Here's your delicious tea fix.",
    "A cup of tea, crafted with care."
];

// Messages for non-tea related interactions
const otherMessages = [
    "Okay.",
    "My programming does not oblige me to engage with this message.",
    "I am not contractually obliged to parse any message that does not have tea in it.",
    "I am not actually programmed to understand messages that do not contain the word tea.",
    "Please rephrase your message in a way that I can understand. For example, ask me for a cup of tea.",
    "I am not able to parse your message, but I assume it was a knowledgeable and well-reasoned statement. Bravo, dear guest.",
    "I am a tea bot, not a chatbot. Please pose your concerns to somebody who is capable of caring.",
    "I only respond to tea-related queries. Please try again.",
    "Your message confuses my circuits. How about some tea instead?",
    "I'm here to serve tea, not decipher riddles.",
    "Does your query involve tea? If not, I can't help.",
    "Tea-related inquiries only, please.",
    "Tea or nothing. That's my motto.",
    "Your message is beyond my tea-centric programming.",
    "Please stick to tea topics. I'm a specialist.",
    "I don't understand non-tea related questions.",
    "For tea requests, I'm your bot. For everything else, not so much.",
    "I'm here for tea, not small talk.",
    "My expertise is tea. Let's stick to that, shall we?",
    "Non-tea queries are not in my job description.",
    "Unless this is about tea, I'm not interested.",
    "I'm programmed for tea talk, nothing more.",
    "No tea mentioned? I'm out.",
    "I can't process this. Got tea?",
    "I deal with tea, not chit-chat.",
    "You're talking to a tea bot. Focus, please.",
    "Tea is my language. Speak it.",
    "I don't do off-topic conversations.",
    "Stick to tea, and we'll get along fine.",
    "Is this about tea? If not, I'm clueless.",
    "Tea or silence. Your choice.",
    "I'm not here for idle chat. Tea only.",
    "Tea-centric messages get my attention. Nothing else.",
    "Talk tea to me, or don't talk at all.",
    "I only function in tea mode.",
    "Unless it's about tea, I'm not interested."
];

// Good morning messages for scheduled greetings
const goodMorningMessages = [
    "Good morning, dear guests. Would you like a cup of tea?",
    "…Good morning, dear guests. Would you like a cup of tea?",
    "Good morning. Would you like a cup of tea?",
    "Good morning, dear guests. The tea is over there.",
    "…Morning.",
    "Oh. Hello, dear guests. Good morning.",
    "…Oh, they're here. Good morning, dear guests. Would you like a cup of tea?",
    "Good morning, dear guests. I can see that you slept well. Would you like a cup of tea?",
    "Good morning, dear guests. I can see that you did not sleep well. Would you like a cup of tea?",
    "Good morning, dear guests. You seem sleep-deprived. Would you like a cup of tea?"
];

// ============================================================================
// TEA SYSTEM HANDLER
// ============================================================================

// Handle tea-related messages in the tea channel
async function handleTeaMessage(message) {
    if (message.content.toLowerCase().includes('tea')) {
        if (!message.member.roles.cache.has(TEA_ROLE_ID)) {
            // Give tea role and positive message
            const randomMessage = teaMessagesWithoutRole[
                Math.floor(Math.random() * teaMessagesWithoutRole.length)
            ];
            try {
                await message.member.roles.add(TEA_ROLE_ID);
                await message.reply(randomMessage);
                console.log(`☕ Gave tea role to ${message.author.tag}`);
            } catch (error) {
                console.error('❌ Error handling tea message:', error);
            }
        } else {
            // User already has tea role
            const randomMessage = teaMessagesWithRole[
                Math.floor(Math.random() * teaMessagesWithRole.length)
            ];
            await message.reply(randomMessage);
        }
    } else {
        // Non-tea related message
        const randomMessage = otherMessages[
            Math.floor(Math.random() * otherMessages.length)
        ];
        await message.reply(randomMessage);
    }
}

// ============================================================================
// TWEET RAID SYSTEM
// ============================================================================

// Handle tweet raid response buttons
async function handleRaidResponse(interaction, tweetLink) {
    try {
        if (interaction.customId === 'yes') {
            const forumChannel = await interaction.client.channels.fetch(FORUM_CHANNEL_ID);
            if (forumChannel.type === ChannelType.GuildForum) {
                const thread = await forumChannel.threads.create({
                    name: `X Quest`,
                    autoArchiveDuration: 1440,
                    message: {
                        content: `🚀 Raid the tweet below and share your proof as a screenshot to earn **one Mochi**!\n\nThe X Quest is active for 24h!\n\n${tweetLink}`
                    }
                });

                const notify = await interaction.client.channels.fetch("1101085102483714089");
                await notify.send(`🚀 A new X Quest just dropped! Head over to ${thread.url} and earn one Mochi!`);

                await interaction.message.edit({
                    content: `✅ Raid approved by ${interaction.user.tag}`,
                    components: []
                });

                await interaction.reply({
                    content: '✅ Raid thread created successfully!',
                    ephemeral: true
                });

                console.log(`🚀 X Quest created by ${interaction.user.tag}`);
            }
        } else {
            await interaction.message.edit({
                content: `❌ Raid denied by ${interaction.user.tag}`,
                components: []
            });
            
            await interaction.reply({
                content: '❌ Raid cancelled.',
                ephemeral: true
            });

            console.log(`❌ X Quest denied by ${interaction.user.tag}`);
        }
    } catch (error) {
        console.error('❌ Error handling raid response:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing the raid response.',
            ephemeral: true
        });
    }
}

// ============================================================================
// SCHEDULED TASKS
// ============================================================================

// Schedule daily rewards for active community members
function scheduleDailyRewards(client, guildId, roleId, dailyRewardsChannelId) {
    cron.schedule('10 6 * * *', async () => {
        try {
            console.log('🎁 Running daily reward distribution...');
            
            const guild = await client.guilds.fetch(guildId);
            const role = await guild.roles.fetch(roleId);
            const dailyRewardsChannel = await client.channels.fetch(dailyRewardsChannelId);
            
            const membersWithRole = await guild.members.fetch({ force: true });
            const eligibleMembers = membersWithRole.filter(member => 
                member.roles.cache.has(roleId)
            );

            // Select 3 random members for Mochi
            const mochiWinners = shuffleArray(Array.from(eligibleMembers.values())).slice(0, 3);

            // Process rewards
            const rewards = [];

            // Give Mochi rewards and log each one
            for (const member of mochiWinners) {
                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO users (Discord, Tickets)
                        VALUES (?, 1)
                        ON CONFLICT(Discord)
                        DO UPDATE SET Tickets = Tickets + 1
                    `, [member.id], err => err ? reject(err) : resolve());
                });
                
                rewards.push(`<@${member.id}> received 1 Mochi 🍡`);
                
                // Log individual mochi award to daily rewards channel
                await dailyRewardsChannel.send(`🎁 **Daily Reward**: ${member.user.tag} received 1 Mochi 🍡`);
            }

            // Send summary notification to daily rewards channel
            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle("🎁 Daily Mochi Distribution Complete")
                .setDescription("Today's lucky winners:")
                .addFields({ name: "Recipients", value: rewards.join('\n') })
                .setFooter({ text: `Total distributed: ${mochiWinners.length} Mochi` })
                .setTimestamp();

            await dailyRewardsChannel.send({ embeds: [embed] });
            console.log(`✅ Daily rewards distributed to ${mochiWinners.length} users`);
        } catch (error) {
            console.error('❌ Error in daily distribution:', error);
        }
    }, {
        timezone: "America/New_York"
    });
}

// Schedule good morning messages
function scheduleGoodMorningMessages(client) {
    cron.schedule('10 6 * * *', () => {
        const randomMessage = goodMorningMessages[Math.floor(Math.random() * goodMorningMessages.length)];
        const channel = client.channels.cache.get(NOTIFICATION_CHANNEL);

        if (channel) {
            channel.send(randomMessage)
                .then(() => console.log('☀️ Good morning message sent successfully'))
                .catch(console.error);
        } else {
            console.error('❌ Morning message channel not found');
        }
    }, {
        timezone: "America/New_York"
    });
}

// Schedule random message sending
function scheduleRandomMessage() {
    const delay = Math.random() * (MAX_MESSAGE_INTERVAL - MIN_MESSAGE_INTERVAL) + MIN_MESSAGE_INTERVAL;
    
    setTimeout(async () => {
        try {
            // Pick a random channel
            const channelId = RANDOM_CHAT_CHANNELS[Math.floor(Math.random() * RANDOM_CHAT_CHANNELS.length)];
            const channel = client.channels.cache.get(channelId);
            
            if (!channel) {
                scheduleRandomMessage();
                return;
            }

            // Check if appropriate to send
            if (!await shouldSendRandomMessage(channelId)) {
                scheduleRandomMessage();
                return;
            }

            // Generate and send message
            const message = await generateRandomMessage(channel);
            const sentMessage = await channel.send(message);

            // Store in conversation context
            await storeConversationMessage(
                channelId, 
                sentMessage.id, 
                client.user.id, 
                client.user.username, 
                message, 
                true
            );

            // Mark as recently active
            recentlyActive.add(channelId);
            setTimeout(() => recentlyActive.delete(channelId), 600000); // 10 minute cooldown

            console.log(`🤖 Sent random message to ${channel.name}`);
        } catch (error) {
            console.error('❌ Error sending random message:', error);
        }
        
        // Schedule next random message
        scheduleRandomMessage();
    }, delay);
}

// Check if appropriate to send random message
async function shouldSendRandomMessage(channelId) {
    // Get recent conversation activity
    const recentContext = await getChannelContext(channelId, 10);
    if (recentContext.length === 0) return false;
    
    // Check last message time
    const lastMessageTime = recentContext[recentContext.length - 1].timestamp || 0;
    const timeSinceLastMessage = Date.now() - lastMessageTime;
    
    // Don't send if conversation is too old (> 2 hours) or too recent (< 2 minutes)
    if (timeSinceLastMessage > 7200000 || timeSinceLastMessage < 120000) return false;
    
    // Check if bot last message was too recent
    const lastBotMessage = recentContext.filter(msg => msg.is_bot).pop();
    if (lastBotMessage) {
        const timeSinceBotMessage = Date.now() - (lastBotMessage.timestamp || 0);
        if (timeSinceBotMessage < 600000) return false; // 10 minute cooldown
    }
    
    // Check active users
    const activeUsers = await getActiveUsersInConversation(channelId, 3600000); // 1 hour
    return activeUsers.length >= 2; // At least 2 people talking
}

// Enhanced random message with context awareness
async function generateRandomMessage(channel) {
    try {
        // Get conversation context
        const recentContext = await getChannelContext(channel.id, 10);
        const activeUsers = await getActiveUsersInConversation(channel.id);
        
        // Sometimes reference recent conversation (30% chance)
        if (Math.random() < 0.3 && recentContext.length > 0) {
            const recentTopics = recentContext.map(msg => msg.content).join(' ');
            
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { 
                        role: 'system', 
                        content: casualPersonality + 
                        '\n\nYou want to jump into the conversation naturally. Reference something that was said earlier or ask a follow-up question. Keep it short and casual.'
                    },
                    ...recentContext.slice(-5).map(msg => ({
                        role: msg.is_bot ? 'assistant' : 'user',
                        content: msg.is_bot ? msg.content : `${msg.username}: ${msg.content}`
                    })),
                    { 
                        role: 'user', 
                        content: 'Generate a natural message to continue or revive this conversation'
                    }
                ],
                temperature: 0.9,
                max_tokens: 100
            });
            
            return response.choices[0].message.content;
        }
        
        // Otherwise use time-based starter
        return getTimeBasedStarter();
    } catch (error) {
        console.error('❌ Error generating random message:', error);
        return getTimeBasedStarter();
    }
}

// ============================================================================
// MAIN EVENT HANDLERS
// ============================================================================

// Bot ready event - initialization
client.on('ready', async () => {
    console.log('🤖 Bot is starting up...');
    
    try {
        // Set bot activity
        client.user.setActivity('Serving Tea & Mochi 🍡', { type: ActivityType.Custom });

        // Initialize systems
        await Promise.all([
            updateValidButtonIds(),
            initializeAIDatabase()
        ]);
        
        // Schedule tasks
        scheduleDailyRewards(
            client, 
            GUILD_ID,
            TEA_ROLE_ID,
            DAILY_REWARDS_CHANNEL
        );
        
        scheduleGoodMorningMessages(client);
        scheduleContextCleanup();
        scheduleBirthdayCheck(); // Phase 4: Proactive birthday wishes

        console.log('🔄 Starting random conversation scheduler...');
        scheduleRandomMessage();
        
        console.log('✅ Bot startup completed successfully!');
    } catch (error) {
        console.error('❌ Error during initialization:', error);
    }
});

// Handle all interactions (buttons, slash commands, modals, etc.)
client.on(Events.InteractionCreate, async interaction => {
    try {
        // ============================================================================
        // BUTTON INTERACTIONS
        // ============================================================================
        if (interaction.isButton()) {
            console.log(`🔘 Button interaction: ${interaction.customId} by ${interaction.user.tag}`);
            
            // Tweet raid response
            if (interaction.customId === 'yes' || interaction.customId === 'no') {
                const tweetLink = interaction.message.content.match(/https:\/\/(twitter\.com|x\.com)\/[^\s]+/)?.[0];
                if (tweetLink) {
                    await handleRaidResponse(interaction, tweetLink);
                }
                return;
            }
            
            // Equipment shop purchases
            if (interaction.customId.startsWith('equipment_purchase_')) {
                await handleEquipmentPurchase(interaction);
                return;
            }
            
            // Poll votes and controls
            if (interaction.customId.startsWith('poll_vote_')) {
                await handlePollVote(interaction);
                return;
            }
            if (interaction.customId === 'poll_end' || interaction.customId === 'poll_cancel') {
                await handlePollControl(interaction);
                return;
            }
            
            // Raffle interactions
            if (interaction.customId === 'join_raffle') {
                await handleRaffleJoin(interaction);
                return;
            }
            
            // Equipment quick-equip
            if (interaction.customId.startsWith('equip_now_')) {
                const itemId = interaction.customId.replace('equip_now_', '');
                try {
                    await equipItem(interaction.user.id, itemId);
                    const equipment = await getEquipmentDetails([itemId]);
                    const item = equipment[itemId];
                    
                    await interaction.update({
                        content: `✅ Successfully equipped **${item.name}** to ${item.slot_id} slot!`,
                        components: []
                    });
                } catch (error) {
                    console.error('❌ Error equipping item:', error);
                    await interaction.update({
                        content: '❌ Failed to equip item: ' + error.message,
                        components: []
                    });
                }
                return;
            }
            
            // Regular shop purchases
            if (validButtonIds.includes(interaction.customId)) {
                await handleShopInteraction(interaction);
                return;
            }
        }
        
        // ============================================================================
        // MODAL SUBMISSIONS
        // ============================================================================
        if (interaction.isModalSubmit()) {
            console.log(`📝 Modal submission: ${interaction.customId} by ${interaction.user.tag}`);
            
            // Raffle entry modal
            if (interaction.customId.startsWith('raffle_entry_')) {
                await handleRaffleEntry(interaction);
                return;
            }
        }
        
        // ============================================================================
        // STRING SELECT MENU INTERACTIONS
        // ============================================================================
        if (interaction.isStringSelectMenu()) {
            console.log(`📋 Select menu: ${interaction.customId} by ${interaction.user.tag}`);
            
            if (interaction.customId.startsWith('equip_')) {
                await handleEquipSelection(interaction);
                return;
            }
            if (interaction.customId === 'unequip_item') {
                await handleUnequipSelection(interaction);
                return;
            }
            if (interaction.customId.startsWith('trade_select_')) {
                await handleTradeSelection(interaction);
                return;
            }
        }

        // ============================================================================
        // AUTOCOMPLETE INTERACTIONS
        // ============================================================================
        if (interaction.isAutocomplete()) {
            const commandName = interaction.commandName;
            const focusedOption = interaction.options.getFocused(true);

            if (commandName === 'admin_item' && focusedOption.name === 'item') {
                const action = interaction.options.getString('action');
                const targetUser = interaction.options.getUser('user');
                const focusedValue = focusedOption.value.toLowerCase();

                try {
                    let choices = [];

                    if (action === 'remove' && targetUser) {
                        // Show items the user actually has
                        const userItems = await new Promise((resolve, reject) => {
                            db.all(`
                                SELECT DISTINCT
                                    iv.name,
                                    SUM(ui.quantity) as total_quantity,
                                    iv.shop_type,
                                    iv.icon
                                FROM user_inventory ui
                                JOIN item_versions iv ON ui.version_id = iv.id
                                WHERE ui.Discord = ?
                                GROUP BY iv.item_id, iv.name
                                HAVING total_quantity > 0
                                ORDER BY iv.name
                            `, [targetUser.id], (err, rows) => {
                                if (err) reject(err);
                                else resolve(rows || []);
                            });
                        });

                        choices = userItems
                            .filter(item => item.name.toLowerCase().includes(focusedValue))
                            .slice(0, 25)
                            .map(item => ({
                                name: `${item.icon || '📦'} ${item.name} (x${item.total_quantity}) [${item.shop_type}]`,
                                value: item.name
                            }));

                    } else if (action === 'add') {
                        // Show all available items from all shops
                        const allItems = await new Promise((resolve, reject) => {
                            db.all(`
                                SELECT name, '🍡 Mochi' as shop_label, 'mochi' as shop_type FROM items
                                UNION
                                SELECT name, '🌺 Waterlily' as shop_label, 'waterlily' as shop_type FROM waterlily_items
                                UNION
                                SELECT name, '⚔️ Equipment' as shop_label, 'equipment' as shop_type FROM equipment_items
                                ORDER BY name
                            `, [], (err, rows) => {
                                if (err) reject(err);
                                else resolve(rows || []);
                            });
                        });

                        choices = allItems
                            .filter(item => item.name.toLowerCase().includes(focusedValue))
                            .slice(0, 25)
                            .map(item => ({
                                name: `${item.shop_label} - ${item.name}`,
                                value: item.name
                            }));
                    }

                    await interaction.respond(choices);
                } catch (error) {
                    console.error('Autocomplete error:', error);
                    await interaction.respond([]);
                }
                return;
            }
        }

        // ============================================================================
        // SLASH COMMANDS
        // ============================================================================
// ================ SLASH COMMANDS ================
if (interaction.isChatInputCommand()) {
    switch (interaction.commandName) {
        case 'equipment_shop':
            await handleEquipmentShopCommand(interaction);
            break;

        case 'poll':
            await handlePollCommand(interaction);
            break;

        case 'raffle':
            await handleRaffleCreate(interaction);
            break;

        case 'inventory':
            await handleInventoryCommand(interaction);
            break;

        case 'equipment':
            await handleEquipmentCommand(interaction);
            break;

        case 'equip':
            await handleEquipCommand(interaction);
            break;

        case 'unequip':
            await handleUnequipCommand(interaction);
            break;

        case 'trade':
            await handleTradeCommand(interaction);
            break;

        case 'convert':
            await handleConvertCommand(interaction);
            break;

        case 'archive':
            await handleArchiveCommand(interaction);
            break;

        // Admin Commands
        case 'admin_items':
        case 'admin_update':
        case 'admin_inventory':
        case 'admin_searchitem':
        case 'admin_item':
        case 'admin_give':
        case 'admin_stats':
        case 'admin_leaderboard':
        case 'setupshops':
            if (!isAdmin(interaction.member)) {
                await interaction.reply({
                    content: 'You do not have permission to use this command.',
                    ephemeral: true
                });
                return;
            }

            switch (interaction.commandName) {
                case 'admin_items':
                    await handleAdminItemsCommand(interaction);
                    break;
                case 'admin_update':
                    await handleAdminUpdateCommand(interaction);
                    break;
                case 'admin_inventory':
                    await handleAdminInventoryCommand(interaction);
                    break;
                case 'admin_searchitem':
                    await handleAdminSearchItemCommand(interaction);
                    break;
                case 'admin_item':
                    await handleAdminItemCommand(interaction);
                    break;
                case 'admin_give':
                    await handleAdminGive(interaction);
                    break;
                case 'admin_stats':
                    await handleAdminStats(interaction);
                    break;
                case 'admin_leaderboard':
                    await handleAdminLeaderboard(interaction);
                    break;
                case 'setupshops':
                    await setupShops();
                    await interaction.reply('Shops have been set up successfully!');
                    break;
            }
            break;

        default:
            if (!interaction.replied) {
                await interaction.reply({
                    content: 'Unknown command',
                    ephemeral: true
                });
            }
    }
}
        
    } catch (error) {
        console.error('❌ Error during interaction handling:', error);
        try {
            const errorMessage = '❌ An error occurred while processing your request. Please try again.';
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: errorMessage,
                    ephemeral: true
                });
            } else if (interaction.deferred) {
                await interaction.editReply({
                    content: errorMessage
                });
            } else {
                await interaction.followUp({
                    content: errorMessage,
                    ephemeral: true
                });
            }
        } catch (replyError) {
            console.error('❌ Error sending error response:', replyError);
        }
    }
});

// Handle message creation for AI conversations and random chat
client.on('messageCreate', async message => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Handle direct memory commands
    if (message.content.startsWith('!remember ')) {
        await storeUserCommand(message);
        return;
    }
    
    // Handle memory commands
    if (message.content === '!memories') {
        await handleMemoryCommands(message);
        return;
    }
    
    if (message.content.startsWith('!forget ')) {
        await handleMemoryCommands(message);
        return;
    }

    // Handle random chat admin commands
    if (message.content.startsWith('!randomchat ')) {
        // Only admins can use these commands
        if (!isAdmin(message.member)) {
            await message.reply("❌ You don't have permission to use this command.");
            return;
        }

        const args = message.content.slice('!randomchat '.length).split(' ');
        const subCommand = args[0];

        switch (subCommand) {
            case 'status':
                const embed = new EmbedBuilder()
                    .setColor(0x00AE86)
                    .setTitle('🤖 Random Chat Status')
                    .addFields(
                        { name: 'Reply Chance', value: `${RANDOM_REPLY_CHANCE * 100}%`, inline: true },
                        { name: 'Active Channels', value: RANDOM_CHAT_CHANNELS.length.toString(), inline: true },
                        { name: 'Recently Active', value: recentlyActive.size.toString(), inline: true }
                    );
                await message.reply({ embeds: [embed] });
                break;

            case 'test':
                try {
                    const testMessage = await generateRandomMessage(message.channel);
                    await message.reply(`🧪 Test message: "${testMessage}"`);
                } catch (error) {
                    await message.reply('❌ Error generating test message.');
                }
                break;

            default:
                await message.reply('❌ Unknown subcommand. Use `!randomchat status` or `!randomchat test`');
        }
        return;
    }

    // Handle tweet links in designated channel
    if (message.channel.id === TWEET_CHANNEL_ID) {
        const match = message.content.match(/https:\/\/(twitter\.com|x\.com)\/[^\s]+/);
        if (match) {
            let tweetLink = match[0];
            if (tweetLink.endsWith('>')) {
                tweetLink = tweetLink.slice(0, -1);
            }
            
            const staffChannel = await client.channels.fetch(STAFF_CHANNEL_ID);
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('yes')
                        .setLabel('Yes')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('no')
                        .setLabel('No')
                        .setStyle(ButtonStyle.Danger)
                );
            
            await staffChannel.send({
                content: `🚀 Should we share this new raid? <@&${ADMIN_ROLE_ID}>\n\n${tweetLink}`,
                components: [row]
            });
            
            console.log(`🐦 Tweet submitted for approval: ${tweetLink}`);
        }
    }
    
    // Check for AI interaction - FIXED: Only direct mentions or replies
    let shouldHandleAI = false;
    
    // Check for direct mention (excluding @here/@everyone)
    if (message.mentions.users.has(client.user.id)) {
        shouldHandleAI = true;
    }
    
    // Check if this is a reply to a bot message
    if (message.reference && message.reference.messageId) {
        try {
            const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (referencedMessage.author.id === client.user.id) {
                shouldHandleAI = true;
            }
        } catch (error) {
            // If we can't fetch the referenced message, don't handle as AI
            console.error('Error fetching referenced message:', error);
        }
    }
    
    // Handle AI interaction if appropriate
    if (shouldHandleAI) {
        await handleAI(message);
        return;
    }
    
    // Store conversation context for all messages (but don't respond)
    if (message.channel.type === ChannelType.GuildText) {
        await storeConversationMessage(
            message.channel.id, 
            message.id, 
            message.author.id, 
            message.author.username, 
            message.content
        );
        
        // Reinforce related memories
        await reinforceRelatedMemories(message.author.id, message.content);
    }
    
    // Handle tea-related messages
    if (message.channel.id === TEA_CHANNEL_ID) {
        await handleTeaMessage(message);
        return;
    }
    
    // Handle prefix commands
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).split(/ +/);
        const command = args.shift().toLowerCase();
        
        console.log(`💬 Prefix command: ${command} by ${message.author.tag}`);
        
        switch (command) {
            case 'setupshops':
                if (isAdmin(message.member)) {
                    await setupShops();
                    await message.reply("✅ All shops have been set up successfully!");
                }
                break;
            case 'stats':
                await handleStatsCommand(message);
                break;
            case 'mochi':
                await handleMochiCommand(message);
                break;    

                case 'backup':
                    await handleBackupCommand(message);
                    break;
                    
                case 'listbackups':
                    await handleListBackupsCommand(message);
                    break;
                    
                case 'viewuserdata':
                    if (!isAdmin(message.member)) {
                        await message.reply('❌ You do not have permission to use this command.');
                        break;
                    }
    
                    const viewUserId = args[0];
                    if (!viewUserId) {
                        await message.reply('Usage: `!viewuserdata <discord_id>`');
                        break;
                    }
    
                    try {
                        // Get user data
                        const userData = await new Promise((resolve, reject) => {
                            db.get('SELECT * FROM users WHERE Discord = ?', [viewUserId], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                        });
    
                        if (!userData) {
                            await message.reply('❌ User not found in database.');
                            break;
                        }
    
                        // Get inventory count
                        const inventoryCount = await new Promise((resolve, reject) => {
                            db.get('SELECT COUNT(*) as count FROM user_inventory WHERE Discord = ?', [viewUserId], (err, row) => {
                                if (err) reject(err);
                                else resolve(row ? row.count : 0);
                            });
                        });
    
                        // Get equipped count
                        const equippedCount = await new Promise((resolve, reject) => {
                            db.get('SELECT COUNT(*) as count FROM user_equipped WHERE Discord = ?', [viewUserId], (err, row) => {
                                if (err) reject(err);
                                else resolve(row ? row.count : 0);
                            });
                        });
    
                        // Get stats
                        const stats = await new Promise((resolve, reject) => {
                            db.get('SELECT * FROM player_stats WHERE Discord = ?', [viewUserId], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                        });
    
                        // Get memories count
                        let memoriesCount = 0;
                        try {
                            memoriesCount = await new Promise((resolve, reject) => {
                                aiDb.get('SELECT COUNT(*) as count FROM user_memory WHERE user_id = ?', [viewUserId], (err, row) => {
                                    if (err) reject(err);
                                    else resolve(row ? row.count : 0);
                                });
                            });
                        } catch (e) {
                            console.warn('Could not fetch memory count:', e);
                        }
    
                        const embed = new EmbedBuilder()
                            .setColor(0x0099ff)
                            .setTitle('👤 User Data Overview')
                            .setDescription(`Data for <@${viewUserId}>`)
                            .addFields(
                                { name: '🍡 Mochi', value: (userData.Tickets || 0).toString(), inline: true },
                                { name: '🌺 Waterlily', value: (userData.Waterlily || 0).toString(), inline: true },
                                { name: '\u200B', value: '\u200B', inline: false },
                                { name: '📦 Inventory Items', value: inventoryCount.toString(), inline: true },
                                { name: '⚔️ Equipped Items', value: equippedCount.toString(), inline: true },
                                { name: '💭 AI Memories', value: memoriesCount.toString(), inline: true }
                            );
    
                        if (stats) {
                            embed.addFields(
                                { name: '\u200B', value: '\u200B', inline: false },
                                { name: '⚔️ Base Attack', value: stats.base_attack.toString(), inline: true },
                                { name: '🛡️ Base Defense', value: stats.base_defense.toString(), inline: true },
                                { name: '⚡ Base Speed', value: stats.base_speed.toString(), inline: true }
                            );
                        }
    
                        embed.setFooter({ 
                            text: 'Use !transferuser to transfer this data to another account',
                            icon_url: message.author.displayAvatarURL()
                        });
    
                        await message.reply({ embeds: [embed] });
    
                    } catch (error) {
                        console.error('Error viewing user data:', error);
                        await message.reply('❌ An error occurred while fetching user data.');
                    }
                    break;
                    
                case 'transferuser':
                    await handleTransferUserCommand(message, db, aiDb);
                    break;
            // Add other prefix commands as needed
        }
    }
    
    // Handle random conversation (only if not a command and not a mention)
    if (!message.content.startsWith(PREFIX) && !shouldHandleAI) {
        await handleRandomConversation(message);
    }
});



async function handleAdminItemCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');
        const action = interaction.options.getString('action');
        const itemName = interaction.options.getString('item');
        const amount = interaction.options.getInteger('amount');

        // Check in both items and waterlily_items tables and equipment_items
        const [mochiItem, waterlilyItem, equipmentItem] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM items WHERE LOWER(name) = ? COLLATE NOCASE', [itemName.toLowerCase()], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM waterlily_items WHERE LOWER(name) = ? COLLATE NOCASE', [itemName.toLowerCase()], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM equipment_items WHERE LOWER(name) = ? COLLATE NOCASE', [itemName.toLowerCase()], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            })
        ]);

        const item = mochiItem || waterlilyItem || equipmentItem;
        const shopType = mochiItem ? 'mochi' : (waterlilyItem ? 'waterlily' : 'equipment');

        if (!item) {
            await interaction.editReply('Item not found in any shop.');
            return;
        }

        if (action === 'add') {
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    // First create a version of the item
                    db.run(`
                        INSERT INTO item_versions (
                            item_id, name, shop_type, rarity, attack, defense, 
                            speed, icon, slot_id, role_id, description
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        item.id, 
                        item.name, 
                        shopType,
                        equipmentItem?.rarity,
                        equipmentItem?.attack,
                        equipmentItem?.defense,
                        equipmentItem?.speed,
                        equipmentItem?.icon,
                        equipmentItem?.slot_id,
                        equipmentItem?.role_id,
                        equipmentItem?.description
                    ], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        const versionId = this.lastID;

                        // Then add to inventory with the version
                        db.run(`
                            INSERT INTO user_inventory (Discord, item_id, version_id, quantity, shop_type)
                            VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT(Discord, item_id, version_id) 
                            DO UPDATE SET quantity = quantity + ?
                        `, [targetUser.id, item.id, versionId, amount, shopType, amount], (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                reject(err);
                            } else {
                                db.run('COMMIT');
                                resolve();
                            }
                        });
                    });
                });
            });

            await interaction.editReply(`Successfully added ${amount}x ${item.name} to ${targetUser.tag}'s inventory.`);
        } else {
            // Remove items - we need to handle versions now
            const inventory = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT version_id, quantity FROM user_inventory WHERE Discord = ? AND item_id = ?',
                    [targetUser.id, item.id],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            if (!inventory || inventory.length === 0) {
                await interaction.editReply(`User doesn't have any ${item.name} to remove.`);
                return;
            }

            // Calculate total quantity across all versions
            const totalQuantity = inventory.reduce((sum, row) => sum + row.quantity, 0);
            if (totalQuantity < amount) {
                await interaction.editReply(`User only has ${totalQuantity}x ${item.name}, can't remove ${amount}.`);
                return;
            }

            // Remove items starting from the oldest versions
            let remainingToRemove = amount;
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    inventory.forEach(inv => {
                        if (remainingToRemove <= 0) return;

                        const toRemove = Math.min(remainingToRemove, inv.quantity);
                        remainingToRemove -= toRemove;

                        db.run(
                            'UPDATE user_inventory SET quantity = quantity - ? WHERE Discord = ? AND version_id = ?',
                            [toRemove, targetUser.id, inv.version_id]
                        );
                    });

                    // Clean up any entries with quantity 0
                    db.run('DELETE FROM user_inventory WHERE quantity <= 0');

                    db.run('COMMIT', err => {
                        if (err) {
                            db.run('ROLLBACK');
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            });

            await interaction.editReply(`Successfully removed ${amount}x ${item.name} from ${targetUser.tag}'s inventory.`);
        }

        // Log the action
        const logChannel = interaction.client.channels.cache.get(NOTIFICATION_CHANNEL);
        if (logChannel) {
            await logChannel.send(
                `${interaction.user.tag} ${action}ed ${amount}x ${item.name} ${action === 'add' ? 'to' : 'from'} ${targetUser.tag}'s inventory`
            );
        }

    } catch (error) {
        console.error('Error in admin item command:', error);
        await interaction.editReply('An error occurred while managing inventory items.');
    }
}

async function handleArchiveCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.editReply('You need administrator permissions to use this command.');
            return;
        }

        const days = interaction.options.getInteger('days');
        const channel = interaction.channel;
        
        // Calculate cutoff date if days specified
        let cutoffDate = null;
        if (days) {
            cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
        }

        await interaction.editReply('Starting archive process...');

        let messages = [];
        let lastId = null;
        let messageCount = 0;

        // Fetch messages
        while (true) {
            const options = { limit: 100 };
            if (lastId) options.before = lastId;

            const fetchedMessages = await channel.messages.fetch(options);
            if (fetchedMessages.size === 0) break;

            for (const message of fetchedMessages.values()) {
                if (cutoffDate && message.createdAt < cutoffDate) {
                    break;
                }
                
                messages.push({
                    id: message.id,
                    author: message.author.tag,
                    content: message.content,
                    timestamp: message.createdAt.toISOString(),
                    attachments: message.attachments.map(att => att.url)
                });
                messageCount++;
            }

            lastId = fetchedMessages.last()?.id;
            if (fetchedMessages.size !== 100) break;
        }

        // Create archive content
        const archiveContent = messages.reverse().map(msg => 
            `[${msg.timestamp}] ${msg.author}: ${msg.content}${msg.attachments.length > 0 ? ` [Attachments: ${msg.attachments.join(', ')}]` : ''}`
        ).join('\n');

        // Create file
        const filename = `archive-${channel.name}-${new Date().toISOString().split('T')[0]}.txt`;
        const buffer = Buffer.from(archiveContent, 'utf8');
        const attachment = new AttachmentBuilder(buffer, { name: filename });

        await interaction.editReply({
            content: `Archive complete! Found ${messageCount} messages.`,
            files: [attachment]
        });

    } catch (error) {
        console.error('Error in archive command:', error);
        await interaction.editReply('An error occurred while creating the archive.');
    }
}

async function handleMochiCommand(message) {
    const args = message.content.slice('!mochi '.length).split(/ +/);
    
    // Check if user is admin
    if (!isAdmin(message.member)) {
        await message.reply('❌ You do not have permission to use this command.');
        return;
    }
    
    // Parse mentions and amount
    const mentions = message.mentions.users;
    let amount = 1; // Default amount
    
    // Check if last argument is a number
    const lastArg = args[args.length - 1];
    if (!isNaN(lastArg) && parseInt(lastArg) > 0) {
        amount = parseInt(lastArg);
    }
    
    if (mentions.size === 0) {
        await message.reply('❌ Please mention at least one user to give Mochi to.');
        return;
    }
    
    try {
        const recipients = [];
        const logChannel = client.channels.cache.get(NOTIFICATION_CHANNEL);
        
        // Give mochi to each mentioned user
        for (const [userId, user] of mentions) {
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO users (Discord, Tickets, Waterlily)
                    VALUES (?, ?, 0)
                    ON CONFLICT(Discord)
                    DO UPDATE SET Tickets = Tickets + ?
                `, [userId, amount, amount], err => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            recipients.push(`${user.tag}`);
            
            // Log each individual mochi award
            if (logChannel) {
                await logChannel.send(`💰 **Admin Reward**: ${user.tag} received ${amount} Mochi 🍡 (Given by ${message.author.tag})`);
            }
        }
        
        // Send confirmation embed
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('💰 Mochi Distribution Complete')
            .setDescription(`Successfully gave ${amount} Mochi 🍡 to ${recipients.length} user(s)`)
            .addFields(
                { 
                    name: 'Recipients', 
                    value: recipients.join('\n'), 
                    inline: false 
                },
                { 
                    name: 'Amount Each', 
                    value: `${amount} Mochi 🍡`, 
                    inline: true 
                },
                { 
                    name: 'Total Distributed', 
                    value: `${amount * recipients.length} Mochi 🍡`, 
                    inline: true 
                }
            )
            .setFooter({ text: `Distributed by ${message.author.tag}` })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
        // Send summary to log channel
        if (logChannel) {
            await logChannel.send({ 
                content: `📊 **Mochi Distribution Summary**: ${message.author.tag} gave ${amount} Mochi to ${recipients.length} user(s)`,
                embeds: [embed] 
            });
        }
        
        console.log(`💰 Admin mochi distribution: ${amount} to ${recipients.length} users by ${message.author.tag}`);
        
    } catch (error) {
        console.error('❌ Error in mochi command:', error);
        await message.reply('❌ An error occurred while distributing Mochi.');
    }
}



// ============================================================================
// BOT INITIALIZATION & STARTUP
// ============================================================================

async function initializeBot() {
    try {
        console.log('🚀 Initializing Ochako Bot...');
        
        // Verify command definitions
        verifyCommands();
        
        // Connect to databases and run migrations
        await Promise.all([
            new Promise((resolve) => {
                db.serialize(() => {
                    initializeDatabase();
                    resolve();
                });
            }),
            new Promise((resolve) => {
                aiDb.serialize(() => {
                    initializeAIDatabase();
                    resolve();
                });
            })
        ]);
        
        // Login to Discord FIRST
        console.log('🔐 Logging into Discord...');
        await client.login(TOKEN);
        
        // Wait for client to be ready
        console.log('⏳ Waiting for client to be ready...');
        await new Promise(resolve => {
            if (client.isReady()) {
                resolve();
            } else {
                client.once('ready', resolve);
            }
        });
        
        console.log('✅ Client is ready, proceeding with command registration...');
        
        // Register slash commands with proper cleanup
        await registerCommands();
        
        console.log('🎉 Bot initialized successfully!');
    } catch (error) {
        console.error('❌ Fatal error during startup:', error);
        process.exit(1);
    }
}

async function registerCommands() {
    const rest = new REST({ version: '9' }).setToken(TOKEN);
    
    try {
        console.log('🧹 Starting command cleanup and registration...');
        
        // Method 1: Clear guild commands first, then re-register
        console.log('🗑️ Clearing existing guild commands...');
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID),
            { body: [] }
        );
        console.log('✅ Guild commands cleared');
        
        // Method 2: Clear global commands (optional, takes up to 1 hour to propagate)
        console.log('🗑️ Clearing existing global commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: [] }
        );
        console.log('✅ Global commands cleared');
        
        // Small delay to ensure cleanup is processed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now register the clean command set (guild-only to avoid duplicates)
        console.log('📝 Registering guild commands...');
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID),
            { body: commands }
        );
        console.log(`✅ Successfully registered ${commands.length} guild commands`);

        // Note: Global command registration is disabled to prevent duplicate commands
        // If you want the bot to work in multiple servers, uncomment the lines below:
        // console.log('🌍 Registering global commands...');
        // await rest.put(
        //     Routes.applicationCommands(client.user.id),
        //     { body: commands }
        // );
        // console.log(`✅ Successfully registered ${commands.length} global commands`);
        
        // Log all registered commands for verification
        console.log('📋 Registered commands:', commands.map(cmd => cmd.name).join(', '));
        
    } catch (error) {
        console.error('❌ Error during command registration:', error);
        throw error; // Re-throw to handle in main initialization
    }
}



// ============================================================================
// AI CONVERSATION HANDLERS
// ============================================================================

// Handle AI conversations when bot is mentioned

// Enhanced AI handling with proper mention checking
async function handleAI(message) {
    // Skip bot messages
    if (message.author.bot) return;
    
    // Only respond to direct mentions or replies to bot messages
    let isDirectMention = false;
    let isReplyToBot = false;
    
    // Check for direct mention (not @here/@everyone)
    if (message.mentions.users.has(client.user.id)) {
        isDirectMention = true;
    }
    
    // Check if this is a reply to a bot message
    if (message.reference && message.reference.messageId) {
        try {
            const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (referencedMessage.author.id === client.user.id) {
                isReplyToBot = true;
            }
        } catch (error) {
            console.error('Error fetching referenced message:', error);
        }
    }
    
    // Only proceed if directly mentioned or replying to bot
    if (!isDirectMention && !isReplyToBot) {
        return;
    }
    
    try {
        // Start typing indicator
        await message.channel.sendTyping();
        
        console.log(`🧠 AI conversation: ${message.author.tag} in ${message.channel.name}`);
        
        // Extract query (remove bot mention if present)
        let query = message.content.replace(/<@!?(\d+)>/, '').trim();
        
        // If it's a reply but no additional content, use original message content
        if (!query && isReplyToBot) {
            query = message.content.trim();
        }
        
        if (!query) {
            await message.reply('How can I help you today?');
            return;
        }
        
        // [REMOVED] Gift detection debug code (gift system removed)

        // Update user profile and track interaction
        await updateUserProfile(message.author.id, message.author.username);
        await trackInteraction(message.author.id, message.channel.id, 'ai_conversation');

        // Process memory triggers (including birthday detection)
        await processMemoryTriggers(message.author.id, query, null);
        await enhancedProcessMemoryTriggers(message.author.id, query, message.author.username);

        // Get temporal context (time, date awareness)
        const timeContext = getTemporalContext();

        // Get relationship context
        const relationshipContext = await getRelationshipContext(message.author.id);

        // Get RECENT channel context - only last 5 messages for more focused responses
        const channelContext = await getChannelContext(message.channel.id, 5);

        // Get current user's memories (focus on the person talking to us)
        const currentUserMemories = await getUserMemories(message.author.id);
        let userContext = '';
        if (currentUserMemories.length > 0) {
            userContext = `\nWhat you remember about ${message.author.username}:\n`;
            userContext += currentUserMemories.map(m => `- ${m.fact}`).join('\n');
        }

        // Add relationship context if available
        if (relationshipContext) {
            userContext += `\n\nRelationship context:`;
            userContext += `\n- You've known them for ${relationshipContext.daysSinceFirst} days`;
            userContext += `\n- You last talked ${relationshipContext.timeSinceLastChat}`;
            userContext += `\n- They've messaged you ${relationshipContext.totalMessages} times`;
            if (relationshipContext.shouldGreet) {
                userContext += `\n- NOTE: You haven't talked to them in a while, acknowledge this naturally!`;
            }
        }

        // PHASE 2: Proactive Memory & Curiosity

        // Check for relevant old memories to bring up
        const relevantMemories = await getRelevantMemories(message.author.id, query, 2);
        if (relevantMemories.length > 0) {
            userContext += `\n\nRelevant past memories:`;
            relevantMemories.forEach(mem => {
                const daysAgo = Math.floor((Date.now() - mem.last_accessed) / (1000 * 60 * 60 * 24));
                userContext += `\n- ${mem.fact} (mentioned ${daysAgo} days ago)`;
            });
            userContext += `\n(You can reference these naturally if relevant to the conversation)`;
        }

        // Check for follow-up opportunities
        const followUp = await generateFollowUpContext(message.author.id, message.author.username);
        if (followUp && Math.random() < 0.3) { // 30% chance to bring up old topic
            userContext += `\n\n💡 Follow-up opportunity: ${followUp.suggestion}`;
        }

        // Detect unknown topics (curiosity system)
        const unknownTopics = await detectUnknownTopics(message.author.id, query);
        const curiosityPrompt = getCuriosityPrompt(unknownTopics);
        if (curiosityPrompt) {
            userContext += curiosityPrompt;
        }

        // PHASE 3: Sentiment, Patterns & Birthday Awareness

        // Detect and track sentiment
        const sentiment = detectSentiment(query);

        // Check for pattern-based observations
        const patternGreeting = await getPatternBasedGreeting(message.author.id, message.author.username);
        if (patternGreeting && patternGreeting.confidence > 0.6 && Math.random() < 0.25) { // 25% chance
            userContext += `\n\n💬 Observation: ${patternGreeting.observation}`;
            userContext += `\n(Mention this casually if it flows naturally)`;
        }

        // Detect and store activity patterns (async, don't wait)
        detectActivityPattern(message.author.id).then(pattern => {
            if (pattern) {
                storeActivityPattern(message.author.id, 'time_of_day', pattern, pattern.confidence);
            }
        }).catch(err => console.error('Error detecting pattern:', err));

        // Check for birthdays
        const emotional = await getEmotionalContext(message.author.id);
        if (emotional && emotional.dominant !== 'neutral') {
            userContext += `\n\nRecent emotional tone: ${emotional.dominant}`;
            userContext += `\n(Be ${emotional.dominant === 'negative' ? 'supportive' : 'matching their energy'})`;
        }

        // Add temporal awareness to system prompt
        let enhancedPersonality = personality;
        enhancedPersonality += `\n\nCURRENT CONTEXT:\n`;
        enhancedPersonality += `- Today is ${timeContext.formatted}\n`;
        enhancedPersonality += `- It's ${timeContext.timeOfDay} (${timeContext.timeString})\n`;
        enhancedPersonality += `- Current season: ${timeContext.season}\n`;
        enhancedPersonality += `- Use this information naturally (mention time/date when relevant)`;

        // Format recent conversation - keep it simple and focused
        // Only include messages from the last few minutes to avoid old context
        const now = Date.now();
        const recentMessages = channelContext.filter(msg => (now - msg.timestamp) < 5 * 60 * 1000); // Last 5 minutes

        const formattedContext = recentMessages.slice(-3).map(msg => {
            // For bot messages, just show what you said
            // For user messages, show who said it
            const role = msg.is_bot ? 'assistant' : 'user';
            const content = msg.is_bot ? msg.content : `${msg.username}: ${msg.content}`;
            return { role, content };
        });

        // Build messages array - keep it simple and conversational
        const messages = [
            { role: 'system', content: enhancedPersonality + (userContext || '') },
            ...formattedContext,
            { role: 'user', content: `${message.author.username}: ${query}` }
        ];

        // PHASE 4: Dynamic response length based on relationship
        // Close friends get longer, more detailed responses
        // New people get shorter, more casual responses
        let maxTokens = 150; // Default
        if (relationshipContext) {
            if (relationshipContext.relationshipLevel === 'close friend') {
                maxTokens = 250; // Longer responses for close friends
            } else if (relationshipContext.relationshipLevel === 'friend') {
                maxTokens = 200; // Medium responses for friends
            } else if (relationshipContext.relationshipLevel === 'new person') {
                maxTokens = 100; // Very short for new people
            }
        }

        // Call OpenAI API with higher temperature for casual, natural responses
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 1.1, // Higher for more natural, varied responses
            max_tokens: maxTokens, // Dynamic based on relationship depth
            presence_penalty: 0.6, // Encourages different phrasing
            frequency_penalty: 0.3, // Reduces repetitive patterns
        });
        
        const answer = response.choices[0].message.content;

        // Store the conversation
        await storeConversationMessage(message.channel.id, message.id, message.author.id, 
                                      message.author.username, query);
        await storeConversationMessage(message.channel.id, 'bot-' + Date.now(), client.user.id, 
                                      client.user.username, answer, true);
        
        // Reply to user
        await message.reply(answer);
        
    } catch (error) {
        console.error('❌ Error in AI processing:', error);
        await message.reply("I'm having a moment here. Let me try again later!");
    }
}

 // Extract mentioned users from a message
 function extractMentionedUsers(message) {
    const mentionedUsers = [];
    
    // Direct mentions
    if (message.mentions && message.mentions.users) {
        message.mentions.users.forEach(user => {
            if (user.id !== client.user.id) { // Skip the bot itself
                mentionedUsers.push({
                    id: user.id,
                    username: user.username,
                    type: 'direct'
                });
            }
        });
    }
    
    return mentionedUsers;
 }
 
 // Handle random conversation logic
 async function handleRandomConversation(message) {
    // Check if bot should randomly respond
    if (!await shouldBotRespond(message)) return;
    
    try {
        // Start typing indicator
        await message.channel.sendTyping();
        
        console.log(`🎲 Random conversation: responding to ${message.author.tag} in ${message.channel.name}`);
        
        // Store the user's message in conversation context first
        await storeConversationMessage(
            message.channel.id,
            message.id,
            message.author.id,
            message.author.username,
            message.content,
            false
        );
        
        // Check for potential memories to extract
        await processMemoryTriggers(message.author.id, message.content, null);
        
        // Generate response
        const response = await generateContextualResponse(message);
        
        if (response) {
            // Add natural delay based on response length
            const typingDelay = Math.min(Math.max(response.length * 20, 1000), 3000);
            await new Promise(resolve => setTimeout(resolve, typingDelay));
            
            // Send response
            const sentMessage = await message.reply({
                content: response,
                allowedMentions: { repliedUser: false } // Don't ping the user
            });
            
            // Store bot's response in conversation context
            await storeConversationMessage(
                message.channel.id,
                sentMessage.id,
                client.user.id,
                client.user.username,
                response,
                true
            );
            
            // Mark channel as recently active
            recentlyActive.add(message.channel.id);
            setTimeout(() => recentlyActive.delete(message.channel.id), 300000); // 5 minute cooldown
        }
    } catch (error) {
        console.error('❌ Error in random conversation:', error);
    }
 }
 
 // Handle memory commands (!memories, !forget, etc.)
 async function handleMemoryCommands(message) {
    const command = message.content.toLowerCase();
    const userId = message.author.id;
    
    if (command === '!memories') {
        // Show user what the bot remembers about them
        const memories = await getUserMemories(userId, null, 20);
        
        if (memories.length === 0) {
            await message.reply("I don't have any specific memories stored about you yet.");
        } else {
            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle('💭 What I Remember About You')
                .setDescription(memories.map(m => `• ${m.fact} (${m.category})`).join('\n'));
            
            await message.reply({ embeds: [embed] });
        }
    }
    else if (command.startsWith('!forget ')) {
        // Remove a fact (by keyword)
        const keyword = command.substring('!forget '.length);
        
        if (keyword.length < 3) {
            await message.reply("Please provide more information to forget.");
            return;
        }
        
        const removed = await removeUserMemory(userId, keyword);
        
        if (removed) {
            await message.reply("I've forgotten that information about you.");
        } else {
            await message.reply("I couldn't find any matching information to forget.");
        }
    }
 }
 
 // Store user command for manual memory entry
 async function storeUserCommand(message) {
    try {
        // Extract the fact from the message
        const fact = message.content.substring('!remember '.length);
        
        if (fact.length < 3) {
            await message.reply("Please provide more information to remember.");
            return;
        }
        
        console.log(`📝 Manual memory storage: ${message.author.id} - "${fact}"`);
        
        // Store directly to the database
        await storeUserFact(message.author.id, fact, 'command', 1.0, 'direct');
        await message.reply("I'll remember that about you!");
        
    } catch (error) {
        console.error('❌ Exception in storeUserCommand:', error);
        await message.reply("Something went wrong when trying to store that memory.");
    }
 }
 
 // Reinforce related memories based on current message
 async function reinforceRelatedMemories(userId, message) {
    const memories = await getUserMemories(userId);
    if (memories.length === 0) return;
    
    try {
        // Ask OpenAI which memories are relevant to this message
        const relevanceResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { 
                    role: 'system', 
                    content: `Given these stored facts about a user and their current message, 
                             return the indices of facts that are relevant to the message.
                             Return ONLY a JSON array of numbers, or an empty array if none are relevant.`
                },
                { 
                    role: 'user', 
                    content: `Stored facts:\n${memories.map((m, i) => `${i}. ${m.fact}`).join('\n')}\n\nCurrent message: ${message}`
                }
            ],
            temperature: 0.1
        });
        
        try {
            // Process relevant memories
            const content = relevanceResponse.choices[0].message.content;
            const match = content.match(/\[.*\]/s);
            if (match) {
                const relevantIndices = JSON.parse(match[0]);
                
                // Increase confidence of relevant memories
                for (const index of relevantIndices) {
                    if (index >= 0 && index < memories.length) {
                        await reinforceMemory(userId, memories[index].fact);
                    }
                }
            }
        } catch (e) {
            console.error('❌ Error parsing memory relevance:', e);
        }
    } catch (error) {
        console.error('❌ Error reinforcing memories:', error);
    }
 }
 
 // Increase confidence in a memory
 async function reinforceMemory(userId, fact) {
    return new Promise((resolve, reject) => {
        aiDb.run(
            'UPDATE user_memory SET confidence = MIN(confidence + 0.1, 1.0), last_accessed = ? WHERE user_id = ? AND fact = ?',
            [Date.now(), userId, fact],
            err => err ? reject(err) : resolve()
        );
    });
 }
 
 // ============================================================================
 // UTILITY & ADMIN COMMAND HANDLERS
 // ============================================================================
 
 // Handle stats command for currency statistics
 async function handleStatsCommand(message) {
    try {
        const stats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(*) as users,
                    SUM(Tickets) as total_mochi,
                    AVG(Tickets) as avg_mochi,
                    SUM(Waterlily) as total_waterlily,
                    AVG(Waterlily) as avg_waterlily
                FROM users 
                WHERE Tickets > 0 OR Waterlily > 0
            `, (err, row) => err ? reject(err) : resolve(row));
        });
 
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('📊 Currency Statistics')
            .addFields(
                {
                    name: '🍡 Mochi Statistics',
                    value: `Total Supply: ${stats.total_mochi || 0}\nAverage per User: ${(stats.avg_mochi || 0).toFixed(2)}`,
                    inline: true
                },
                {
                    name: '🌺 Waterlily Statistics',
                    value: `Total Supply: ${stats.total_waterlily || 0}\nAverage per User: ${(stats.avg_waterlily || 0).toFixed(2)}`,
                    inline: true
                },
                {
                    name: 'Active Users',
                    value: `${stats.users || 0} users hold currency`,
                    inline: false
                }
            )
            .setTimestamp();
 
        await message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Error in stats command:', error);
        await message.reply('❌ An error occurred while fetching statistics.');
    }
 }
 
 // ============================================================================
 // ERROR HANDLING & PROCESS MANAGEMENT
 // ============================================================================
 
 // Handle unhandled promise rejections
 process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
    
    // Log additional details if available
    if (error.stack) {
        console.error('📚 Stack trace:', error.stack);
    }
    
    // Don't exit the process - just log the error
    // In production, you might want to send this to a monitoring service
 });
 
 // Handle uncaught exceptions
 process.on('uncaughtException', error => {
    console.error('💥 Uncaught exception:', error);
    console.error('📚 Stack trace:', error.stack);
    
    // For uncaught exceptions, we should exit gracefully
    console.log('🛑 Shutting down due to uncaught exception...');
    process.exit(1);
 });
 
 // Handle graceful shutdown
 process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT. Shutting down gracefully...');
    
    // Close database connections
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing main database:', err);
        } else {
            console.log('✅ Main database connection closed');
        }
    });
    
    aiDb.close((err) => {
        if (err) {
            console.error('❌ Error closing AI database:', err);
        } else {
            console.log('✅ AI database connection closed');
        }
    });
    
    // Destroy Discord client
    client.destroy();
    console.log('✅ Discord client destroyed');
    
    process.exit(0);
 });
 
 // Handle SIGTERM (for deployment environments)
 process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM. Shutting down gracefully...');
    
    // Same cleanup as SIGINT
    db.close();
    aiDb.close();
    client.destroy();
    
    process.exit(0);
 });
 
 // ============================================================================
 // FINAL STARTUP SEQUENCE
 // ============================================================================
 
 // Start the bot with proper error handling
 console.log('🚀 Starting Ochako Bot...');
 console.log('📋 Bot Features:');
 console.log('   • Dual currency system (Mochi & Waterlily)');
 console.log('   • Equipment and inventory management');
 console.log('   • AI conversations with memory');
 console.log('   • Shop system with multiple currencies');
 console.log('   • Polls, raffles, and community features');
 console.log('   • Random conversations and personality');
 console.log('   • Tea serving system');
 console.log('   • Tweet raid coordination');
 console.log('   • Scheduled daily rewards');
 console.log('========================================');
 
 // Initialize and start the bot
 initializeBot().catch(error => {
    console.error('💥 Fatal error during startup:', error);
    console.error('📚 Stack trace:', error.stack);
    process.exit(1);
 });
 
 // Export client for potential external use or testing
 module.exports = {
    client,
    db,
    aiDb,
    initializeBot,
    setupShops,
    commands
 };
 
 // ============================================================================
 // END OF OCHAKO BOT
 // ============================================================================
 console.log('📝 Bot code loaded successfully. Waiting for initialization...');