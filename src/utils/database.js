/**
 * Database Connection Manager
 *
 * Manages SQLite database connections for the Discord bot.
 * Handles initialization, connection pooling, and error handling.
 *
 * @module database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const config = require('../config/config');

// Connection cache to reuse database connections
let mainDb = null;
let aiDb = null;

/**
 * Ensures the database directory exists
 */
function ensureDatabaseDirectory() {
    const dbDir = path.join(__dirname, '../../databases');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.info('Created databases directory');
    }
}

/**
 * Get or create the main database connection
 * @returns {sqlite3.Database}
 */
function getMainDb() {
    if (mainDb) {
        return mainDb;
    }

    ensureDatabaseDirectory();
    const dbPath = config.paths.mainDb;

    mainDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            logger.error('Error opening main database:', err);
            throw err;
        } else {
            logger.success('Main database connected successfully');
        }
    });

    // Enable foreign keys
    mainDb.run('PRAGMA foreign_keys = ON');

    // Enable WAL mode for better concurrency
    mainDb.run('PRAGMA journal_mode = WAL');

    return mainDb;
}

/**
 * Get or create the AI database connection
 * @returns {sqlite3.Database}
 */
function getAiDb() {
    if (aiDb) {
        return aiDb;
    }

    ensureDatabaseDirectory();
    const dbPath = config.paths.aiDb;

    aiDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            logger.error('Error opening AI database:', err);
            throw err;
        } else {
            logger.success('AI database connected successfully');
        }
    });

    // Enable foreign keys
    aiDb.run('PRAGMA foreign_keys = ON');

    // Enable WAL mode for better concurrency
    aiDb.run('PRAGMA journal_mode = WAL');

    return aiDb;
}

/**
 * Close all database connections gracefully
 */
function closeAllDatabases() {
    return new Promise((resolve, reject) => {
        const promises = [];

        if (mainDb) {
            promises.push(
                new Promise((res, rej) => {
                    mainDb.close((err) => {
                        if (err) {
                            logger.error('Error closing main database:', err);
                            rej(err);
                        } else {
                            logger.info('Main database closed');
                            res();
                        }
                    });
                })
            );
        }

        if (aiDb) {
            promises.push(
                new Promise((res, rej) => {
                    aiDb.close((err) => {
                        if (err) {
                            logger.error('Error closing AI database:', err);
                            rej(err);
                        } else {
                            logger.info('AI database closed');
                            res();
                        }
                    });
                })
            );
        }

        Promise.all(promises)
            .then(() => {
                mainDb = null;
                aiDb = null;
                resolve();
            })
            .catch(reject);
    });
}

/**
 * Run a query with promise wrapper
 * @param {sqlite3.Database} db - Database instance
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result with lastID and changes
 */
function runQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

/**
 * Get a single row with promise wrapper
 * @param {sqlite3.Database} db - Database instance
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<object|undefined>} Single row or undefined
 */
function getRow(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

/**
 * Get all rows with promise wrapper
 * @param {sqlite3.Database} db - Database instance
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Array of rows
 */
function getAllRows(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Initializes the main database with required tables
 * @returns {Promise<void>}
 */
async function initializeMainDatabase() {
    logger.info('Initializing main database schema...');
    const db = getMainDb();

    try {
        // Create users table
        await runQuery(db, `
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                mochi INTEGER DEFAULT 0,
                waterlilies INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                experience INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_daily DATETIME,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create inventory table
        await runQuery(db, `
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                item_name TEXT NOT NULL,
                item_type TEXT NOT NULL,
                quantity INTEGER DEFAULT 1,
                equipped BOOLEAN DEFAULT 0,
                obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);

        // Create transactions table
        await runQuery(db, `
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                currency TEXT NOT NULL,
                description TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);

        // Create gifts table
        await runQuery(db, `
            CREATE TABLE IF NOT EXISTS gifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                giver_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                gift_name TEXT NOT NULL,
                gift_value INTEGER NOT NULL,
                message TEXT,
                given_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (giver_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);

        logger.success('Main database schema initialized');
    } catch (error) {
        logger.error('Failed to initialize main database:', error);
        throw error;
    }
}

/**
 * Initializes the AI conversations database with required tables
 * @returns {Promise<void>}
 */
async function initializeAiDatabase() {
    logger.info('Initializing AI conversations database schema...');
    const db = getAiDb();

    try {
        // Create conversations table
        await runQuery(db, `
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                channel_id TEXT,
                message_id TEXT,
                user_message TEXT NOT NULL,
                bot_response TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                tokens_used INTEGER DEFAULT 0
            )
        `);

        // Create conversation_context table for maintaining context
        await runQuery(db, `
            CREATE TABLE IF NOT EXISTS conversation_context (
                user_id TEXT PRIMARY KEY,
                context_messages TEXT,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        logger.success('AI conversations database schema initialized');
    } catch (error) {
        logger.error('Failed to initialize AI database:', error);
        throw error;
    }
}

/**
 * Initializes all databases
 * @returns {Promise<void>}
 */
async function initializeAllDatabases() {
    try {
        logger.section('Database Initialization');
        await initializeMainDatabase();
        await initializeAiDatabase();
        logger.success('All databases initialized successfully');
        logger.space();
    } catch (error) {
        logger.error('Failed to initialize databases:', error);
        throw error;
    }
}

module.exports = {
    // Connection management
    getMainDb,
    getAiDb,
    closeAllDatabases,

    // Query helpers
    runQuery,
    getRow,
    getAllRows,

    // Initialization
    initializeAllDatabases,
    initializeMainDatabase,
    initializeAiDatabase
};
