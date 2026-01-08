// ============================================================================
// DATABASE BACKUP UTILITY
// ============================================================================
// Creates safe backups of your database files before performing transfers
// Run this before doing any major operations
// ============================================================================

const fs = require('fs');
const path = require('path');

/**
 * Create timestamped backups of both database files
 * @returns {Promise<Object>} Backup result
 */
async function createDatabaseBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const backupDir = './backups';
    
    try {
        // Create backups directory if it doesn't exist
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
            console.log('✅ Created backups directory');
        }

        const backups = {
            mochi: null,
            ai: null,
            success: true,
            error: null
        };

        // Backup main database
        if (fs.existsSync('./mochi.db')) {
            const mochiBackupPath = path.join(backupDir, `mochi_${timestamp}.db`);
            fs.copyFileSync('./mochi.db', mochiBackupPath);
            backups.mochi = mochiBackupPath;
            console.log(`✅ Main database backed up: ${mochiBackupPath}`);
        } else {
            console.warn('⚠️ mochi.db not found - skipping backup');
        }

        // Backup AI database
        if (fs.existsSync('./ai_agent.db')) {
            const aiBackupPath = path.join(backupDir, `ai_agent_${timestamp}.db`);
            fs.copyFileSync('./ai_agent.db', aiBackupPath);
            backups.ai = aiBackupPath;
            console.log(`✅ AI database backed up: ${aiBackupPath}`);
        } else {
            console.warn('⚠️ ai_agent.db not found - skipping backup');
        }

        // Clean old backups (keep last 10)
        cleanOldBackups(backupDir, 10);

        return backups;

    } catch (error) {
        console.error('❌ Backup failed:', error);
        return {
            mochi: null,
            ai: null,
            success: false,
            error: error.message
        };
    }
}

/**
 * Clean old backup files, keeping only the most recent ones
 * @param {string} backupDir - Backup directory path
 * @param {number} keepCount - Number of backups to keep
 */
function cleanOldBackups(backupDir, keepCount = 10) {
    try {
        const files = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.db'))
            .map(file => ({
                name: file,
                path: path.join(backupDir, file),
                time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        // Delete old backups
        if (files.length > keepCount * 2) { // *2 because we have 2 db files
            const toDelete = files.slice(keepCount * 2);
            toDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`🗑️ Deleted old backup: ${file.name}`);
            });
        }
    } catch (error) {
        console.error('⚠️ Error cleaning old backups:', error);
    }
}

/**
 * Discord command handler for creating backups
 * @param {Message} message - Discord message object
 */
async function handleBackupCommand(message) {
    // Check admin permissions
    const ADMIN_ROLE_ID = "1076482729635487835";
    if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return message.reply('❌ You do not have permission to use this command.');
    }

    const statusMsg = await message.reply('⏳ Creating database backups...');

    const result = await createDatabaseBackup();

    if (result.success) {
        const embed = {
            color: 0x00ff00,
            title: '✅ Database Backup Complete',
            fields: [],
            footer: {
                text: `Backup created by ${message.author.tag}`,
                icon_url: message.author.displayAvatarURL()
            },
            timestamp: new Date().toISOString()
        };

        if (result.mochi) {
            embed.fields.push({
                name: '🍡 Main Database',
                value: `\`${path.basename(result.mochi)}\``,
                inline: false
            });
        }

        if (result.ai) {
            embed.fields.push({
                name: '🤖 AI Database',
                value: `\`${path.basename(result.ai)}\``,
                inline: false
            });
        }

        embed.fields.push({
            name: '📁 Location',
            value: '`./backups/`',
            inline: false
        });

        await statusMsg.edit({ content: null, embeds: [embed] });
    } else {
        await statusMsg.edit(`❌ Backup failed: ${result.error}`);
    }
}

/**
 * List available backups
 * @param {Message} message - Discord message object
 */
async function handleListBackupsCommand(message) {
    // Check admin permissions
    const ADMIN_ROLE_ID = "1076482729635487835";
    if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return message.reply('❌ You do not have permission to use this command.');
    }

    try {
        const backupDir = './backups';
        
        if (!fs.existsSync(backupDir)) {
            return message.reply('❌ No backups directory found. Create a backup first with `!backup`');
        }

        const files = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.db'))
            .map(file => ({
                name: file,
                size: fs.statSync(path.join(backupDir, file)).size,
                time: fs.statSync(path.join(backupDir, file)).mtime
            }))
            .sort((a, b) => b.time - a.time);

        if (files.length === 0) {
            return message.reply('❌ No backups found. Create one with `!backup`');
        }

        const mochiBackups = files.filter(f => f.name.startsWith('mochi_'));
        const aiBackups = files.filter(f => f.name.startsWith('ai_agent_'));

        const embed = {
            color: 0x0099ff,
            title: '📦 Available Database Backups',
            fields: [
                {
                    name: '🍡 Main Database Backups',
                    value: mochiBackups.length > 0 
                        ? mochiBackups.slice(0, 5).map(f => 
                            `\`${f.name}\` (${(f.size / 1024).toFixed(2)} KB) - ${f.time.toLocaleString()}`
                          ).join('\n')
                        : 'No backups',
                    inline: false
                },
                {
                    name: '🤖 AI Database Backups',
                    value: aiBackups.length > 0
                        ? aiBackups.slice(0, 5).map(f => 
                            `\`${f.name}\` (${(f.size / 1024).toFixed(2)} KB) - ${f.time.toLocaleString()}`
                          ).join('\n')
                        : 'No backups',
                    inline: false
                }
            ],
            footer: {
                text: `Showing latest 5 of each | Total: ${files.length} backups`
            },
            timestamp: new Date().toISOString()
        };

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error listing backups:', error);
        await message.reply('❌ An error occurred while listing backups.');
    }
}

module.exports = {
    createDatabaseBackup,
    handleBackupCommand,
    handleListBackupsCommand
};




