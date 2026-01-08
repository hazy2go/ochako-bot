// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================
// Sets up all database tables, indices, and default data

const { getMainDb, getAiDb } = require('../utils/database');

/**
 * Initialize main database with all required tables
 */
function initializeMainDatabase() {
    const db = getMainDb();

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            console.log('🔧 Setting up main database tables...');

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
            db.run('CREATE INDEX IF NOT EXISTS idx_equipped_items_discord ON equipped_items(Discord)', (err) => {
                if (err) {
                    console.error('❌ Error creating indices:', err);
                    reject(err);
                } else {
                    console.log('✅ Main database tables initialized successfully');
                    resolve();
                }
            });
        });
    });
}

/**
 * Initialize AI database for conversation memory
 */
function initializeAIDatabase() {
    const aiDb = getAiDb();

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

            // Performance indices for AI queries
            aiDb.run('CREATE INDEX IF NOT EXISTS idx_user_memory_user ON user_memory(user_id)');
            aiDb.run('CREATE INDEX IF NOT EXISTS idx_context_channel ON conversation_context(channel_id)', (err) => {
                if (err) {
                    console.error('❌ Error creating context index:', err);
                    reject(err);
                } else {
                    console.log('✅ AI database tables initialized successfully');
                    resolve();
                }
            });
        });
    });
}

/**
 * Initialize all databases
 */
async function initializeAllDatabases() {
    try {
        await initializeMainDatabase();
        await initializeAIDatabase();
        console.log('✅ All databases initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing databases:', error);
        throw error;
    }
}

module.exports = {
    initializeMainDatabase,
    initializeAIDatabase,
    initializeAllDatabases
};
