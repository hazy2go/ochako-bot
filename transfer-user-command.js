// ============================================================================
// ADMIN COMMAND: USER ACCOUNT TRANSFER (IMPROVED WITH BUTTONS)
// ============================================================================
// Safely transfers all user data from one Discord ID to another
// Usage: !transferuser <old_id> <new_id>
// Uses buttons instead of reactions for better reliability
// ============================================================================

/**
 * Handle user transfer command
 * Transfers all data from old Discord ID to new Discord ID
 * @param {Message} message - Discord message object
 * @param {Database} db - Main database instance
 * @param {Database} aiDb - AI database instance
 */
async function handleTransferUserCommand(message, db, aiDb) {
    // Import required Discord components
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    
    // Check admin permissions
    const ADMIN_ROLE_ID = "1076482729635487835";
    if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return message.reply('❌ You do not have permission to use this command.');
    }

    // Parse command arguments
    const args = message.content.split(' ').slice(1);
    if (args.length !== 2) {
        return message.reply('❌ Usage: `!transferuser <old_discord_id> <new_discord_id>`\nExample: `!transferuser 123456789 987654321`');
    }

    const oldDiscordId = args[0];
    const newDiscordId = args[1];

    // Validation
    if (oldDiscordId === newDiscordId) {
        return message.reply('❌ Old and new Discord IDs cannot be the same.');
    }

    if (!/^\d+$/.test(oldDiscordId) || !/^\d+$/.test(newDiscordId)) {
        return message.reply('❌ Discord IDs must be numeric values.');
    }

    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
        .setCustomId('transfer_confirm')
        .setLabel('✅ Confirm Transfer')
        .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
        .setCustomId('transfer_cancel')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder()
        .addComponents(confirmButton, cancelButton);

    // Confirmation embed
    const confirmEmbed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('⚠️ ACCOUNT TRANSFER CONFIRMATION')
        .setDescription(
            `**From:** <@${oldDiscordId}> (\`${oldDiscordId}\`)\n` +
            `**To:** <@${newDiscordId}> (\`${newDiscordId}\`)\n\n` +
            `This will transfer:\n` +
            `• All currencies (Mochi & Waterlily)\n` +
            `• All inventory items\n` +
            `• All equipped items\n` +
            `• Player stats\n` +
            `• AI conversation memories\n` +
            `• Transaction history\n` +
            `• Raffle entries\n` +
            `• Poll responses\n\n` +
            `Click **Confirm Transfer** to proceed or **Cancel** to abort.\n` +
            `*This action will be logged.*`
        )
        .setFooter({ text: 'You have 30 seconds to respond' })
        .setTimestamp();

    const confirmMsg = await message.reply({ 
        embeds: [confirmEmbed], 
        components: [row] 
    });

    // Wait for button interaction
    const filter = (interaction) => {
        return ['transfer_confirm', 'transfer_cancel'].includes(interaction.customId) && 
               interaction.user.id === message.author.id;
    };

    try {
        const interaction = await confirmMsg.awaitMessageComponent({ 
            filter, 
            time: 30000 
        });

        if (interaction.customId === 'transfer_cancel') {
            await interaction.update({ 
                embeds: [new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('❌ Transfer Cancelled')
                    .setDescription('Account transfer has been cancelled.')
                ], 
                components: [] 
            });
            return;
        }

        // User confirmed - proceed with transfer
        await interaction.update({ 
            embeds: [new EmbedBuilder()
                .setColor(0x00aaff)
                .setTitle('⏳ Transfer in Progress')
                .setDescription('Processing account transfer... Please wait.')
            ], 
            components: [] 
        });
        
        const transferResult = await performUserTransfer(db, aiDb, oldDiscordId, newDiscordId);
        
        if (transferResult.success) {
            const successEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Account Transfer Complete')
                .addFields(
                    { name: 'From', value: `<@${oldDiscordId}>`, inline: true },
                    { name: 'To', value: `<@${newDiscordId}>`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: '🍡 Mochi Transferred', value: transferResult.details.mochi.toString(), inline: true },
                    { name: '🌺 Waterlily Transferred', value: transferResult.details.waterlily.toString(), inline: true },
                    { name: '📦 Items Transferred', value: transferResult.details.items.toString(), inline: true },
                    { name: '⚔️ Equipment Transferred', value: transferResult.details.equipment.toString(), inline: true },
                    { name: '💭 Memories Transferred', value: transferResult.details.memories.toString(), inline: true },
                    { name: '📝 Other Records', value: transferResult.details.other.toString(), inline: true }
                )
                .setFooter({ 
                    text: `Transferred by ${message.author.tag} | Old account data deleted`,
                    icon_url: message.author.displayAvatarURL()
                })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [successEmbed] });
            
            // Log to channel
            logTransferAction(message, oldDiscordId, newDiscordId, transferResult.details);
            
        } else {
            await interaction.editReply({ 
                embeds: [new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('❌ Transfer Failed')
                    .setDescription(`Error: ${transferResult.error}`)
                ] 
            });
        }

    } catch (error) {
        if (error.message && error.message.includes('time')) {
            await confirmMsg.edit({ 
                embeds: [new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('❌ Transfer Cancelled')
                    .setDescription('Transfer cancelled: Confirmation timeout (30 seconds expired).')
                ], 
                components: [] 
            });
        } else {
            console.error('❌ Error in transfer command:', error);
            await confirmMsg.edit({ 
                embeds: [new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('❌ Error')
                    .setDescription('An error occurred during the transfer process.')
                ], 
                components: [] 
            });
        }
    }
}

/**
 * Perform the actual transfer of all user data
 * @param {Database} db - Main database
 * @param {Database} aiDb - AI database
 * @param {string} oldId - Old Discord ID
 * @param {string} newId - New Discord ID
 * @returns {Promise<Object>} Transfer result with success status and details
 */
async function performUserTransfer(db, aiDb, oldId, newId) {
    const transferDetails = {
        mochi: 0,
        waterlily: 0,
        items: 0,
        equipment: 0,
        memories: 0,
        other: 0
    };

    return new Promise(async (resolve) => {
        try {
            // Start transaction
            db.serialize(async () => {
                db.run('BEGIN TRANSACTION');

                try {
                    // ============================================================
                    // STEP 1: CHECK IF OLD USER EXISTS
                    // ============================================================
                    const oldUserData = await new Promise((res, rej) => {
                        db.get('SELECT * FROM users WHERE Discord = ?', [oldId], (err, row) => {
                            if (err) rej(err);
                            else res(row);
                        });
                    });

                    if (!oldUserData) {
                        db.run('ROLLBACK');
                        return resolve({ 
                            success: false, 
                            error: `Old user account (${oldId}) not found in database.` 
                        });
                    }

                    transferDetails.mochi = oldUserData.Tickets || 0;
                    transferDetails.waterlily = oldUserData.Waterlily || 0;

                    // ============================================================
                    // STEP 2: CHECK IF NEW USER ALREADY EXISTS
                    // ============================================================
                    const newUserExists = await new Promise((res, rej) => {
                        db.get('SELECT Discord FROM users WHERE Discord = ?', [newId], (err, row) => {
                            if (err) rej(err);
                            else res(!!row);
                        });
                    });

                    if (newUserExists) {
                        // Merge data: add old user's currencies to new user
                        await new Promise((res, rej) => {
                            db.run(
                                'UPDATE users SET Tickets = Tickets + ?, Waterlily = Waterlily + ? WHERE Discord = ?',
                                [transferDetails.mochi, transferDetails.waterlily, newId],
                                (err) => err ? rej(err) : res()
                            );
                        });
                    } else {
                        // Create new user with old user's data
                        await new Promise((res, rej) => {
                            db.run(
                                'INSERT INTO users (Discord, Tickets, Waterlily) VALUES (?, ?, ?)',
                                [newId, transferDetails.mochi, transferDetails.waterlily],
                                (err) => err ? rej(err) : res()
                            );
                        });
                    }

                    // ============================================================
                    // STEP 3: TRANSFER INVENTORY
                    // ============================================================
                    const inventoryItems = await new Promise((res, rej) => {
                        db.all('SELECT * FROM user_inventory WHERE Discord = ?', [oldId], (err, rows) => {
                            if (err) rej(err);
                            else res(rows || []);
                        });
                    });

                    transferDetails.items = inventoryItems.length;

                    for (const item of inventoryItems) {
                        // Check if new user already has this item version
                        const existingItem = await new Promise((res, rej) => {
                            db.get(
                                'SELECT quantity FROM user_inventory WHERE Discord = ? AND item_id = ? AND version_id = ?',
                                [newId, item.item_id, item.version_id],
                                (err, row) => err ? rej(err) : res(row)
                            );
                        });

                        if (existingItem) {
                            // Merge quantities
                            await new Promise((res, rej) => {
                                db.run(
                                    'UPDATE user_inventory SET quantity = quantity + ? WHERE Discord = ? AND item_id = ? AND version_id = ?',
                                    [item.quantity, newId, item.item_id, item.version_id],
                                    (err) => err ? rej(err) : res()
                                );
                            });
                        } else {
                            // Insert new item
                            await new Promise((res, rej) => {
                                db.run(
                                    'INSERT INTO user_inventory (Discord, item_id, version_id, quantity, shop_type) VALUES (?, ?, ?, ?, ?)',
                                    [newId, item.item_id, item.version_id, item.quantity, item.shop_type],
                                    (err) => err ? rej(err) : res()
                                );
                            });
                        }
                    }

                    // ============================================================
                    // STEP 4: TRANSFER EQUIPPED ITEMS
                    // ============================================================
                    const equippedItems = await new Promise((res, rej) => {
                        db.all('SELECT * FROM equipped_items WHERE Discord = ?', [oldId], (err, rows) => {
                            if (err) rej(err);
                            else res(rows || []);
                        });
                    });

                    transferDetails.equipment = equippedItems.length;

                    // Delete new user's equipped items to avoid conflicts
                    await new Promise((res, rej) => {
                        db.run('DELETE FROM equipped_items WHERE Discord = ?', [newId], (err) => err ? rej(err) : res());
                    });

                    // Insert old user's equipped items
                    for (const item of equippedItems) {
                        await new Promise((res, rej) => {
                            db.run(
                                'INSERT INTO equipped_items (Discord, slot_id, item_id, version_id) VALUES (?, ?, ?, ?)',
                                [newId, item.slot_id, item.item_id, item.version_id],
                                (err) => err ? rej(err) : res()
                            );
                        });
                    }

                    // ============================================================
                    // STEP 5: TRANSFER PLAYER STATS
                    // ============================================================
                    const playerStats = await new Promise((res, rej) => {
                        db.get('SELECT * FROM player_stats WHERE Discord = ?', [oldId], (err, row) => {
                            if (err) rej(err);
                            else res(row);
                        });
                    });

                    if (playerStats) {
                        const newStatsExist = await new Promise((res, rej) => {
                            db.get('SELECT Discord FROM player_stats WHERE Discord = ?', [newId], (err, row) => {
                                if (err) rej(err);
                                else res(!!row);
                            });
                        });

                        if (newStatsExist) {
                            await new Promise((res, rej) => {
                                db.run(
                                    'UPDATE player_stats SET base_attack = ?, base_defense = ?, base_speed = ? WHERE Discord = ?',
                                    [playerStats.base_attack, playerStats.base_defense, playerStats.base_speed, newId],
                                    (err) => err ? rej(err) : res()
                                );
                            });
                        } else {
                            await new Promise((res, rej) => {
                                db.run(
                                    'INSERT INTO player_stats (Discord, base_attack, base_defense, base_speed) VALUES (?, ?, ?, ?)',
                                    [newId, playerStats.base_attack, playerStats.base_defense, playerStats.base_speed],
                                    (err) => err ? rej(err) : res()
                                );
                            });
                        }
                        transferDetails.other++;
                    }

                    // ============================================================
                    // STEP 6: TRANSFER RAFFLE ENTRIES
                    // ============================================================
                    await new Promise((res, rej) => {
                        db.run('UPDATE raffle_entries SET discord = ? WHERE discord = ?', [newId, oldId], (err) => {
                            if (err && !err.message.includes('no such table')) rej(err);
                            else res();
                        });
                    });

                    // ============================================================
                    // STEP 7: TRANSFER POLL RESPONSES
                    // ============================================================
                    await new Promise((res, rej) => {
                        db.run('UPDATE poll_responses SET user_id = ? WHERE user_id = ?', [newId, oldId], (err) => {
                            if (err && !err.message.includes('no such table')) rej(err);
                            else res();
                        });
                    });

                    // ============================================================
                    // STEP 8: TRANSFER TRANSACTION HISTORY
                    // ============================================================
                    await new Promise((res, rej) => {
                        db.run('UPDATE transactions SET discord_id = ? WHERE discord_id = ?', [newId, oldId], (err) => {
                            if (err && !err.message.includes('no such table')) rej(err);
                            else res();
                        });
                    });

                    // ============================================================
                    // STEP 9: DELETE OLD USER DATA
                    // ============================================================
                    await new Promise((res, rej) => {
                        db.run('DELETE FROM user_inventory WHERE Discord = ?', [oldId], (err) => err ? rej(err) : res());
                    });
                    await new Promise((res, rej) => {
                        db.run('DELETE FROM equipped_items WHERE Discord = ?', [oldId], (err) => err ? rej(err) : res());
                    });
                    await new Promise((res, rej) => {
                        db.run('DELETE FROM player_stats WHERE Discord = ?', [oldId], (err) => err ? rej(err) : res());
                    });
                    await new Promise((res, rej) => {
                        db.run('DELETE FROM users WHERE Discord = ?', [oldId], (err) => err ? rej(err) : res());
                    });

                    // ============================================================
                    // STEP 10: TRANSFER AI MEMORIES (separate database)
                    // ============================================================
                    try {
                        const memories = await new Promise((res, rej) => {
                            aiDb.all('SELECT * FROM user_memory WHERE user_id = ?', [oldId], (err, rows) => {
                                if (err) rej(err);
                                else res(rows || []);
                            });
                        });

                        transferDetails.memories = memories.length;

                        for (const memory of memories) {
                            await new Promise((res, rej) => {
                                aiDb.run(
                                    'INSERT OR REPLACE INTO user_memory (user_id, fact, source, confidence, last_accessed) VALUES (?, ?, ?, ?, ?)',
                                    [newId, memory.fact, memory.source, memory.confidence, memory.last_accessed],
                                    (err) => err ? rej(err) : res()
                                );
                            });
                        }

                        // Delete old user's memories
                        await new Promise((res, rej) => {
                            aiDb.run('DELETE FROM user_memory WHERE user_id = ?', [oldId], (err) => err ? rej(err) : res());
                        });

                        // Transfer conversation history
                        await new Promise((res, rej) => {
                            aiDb.run('UPDATE conversation_history SET user_id = ? WHERE user_id = ?', [newId, oldId], (err) => {
                                if (err && !err.message.includes('no such table')) rej(err);
                                else res();
                            });
                        });
                    } catch (aiError) {
                        console.warn('⚠️ AI database transfer warning:', aiError.message);
                        // Continue even if AI transfer fails
                    }

                    // ============================================================
                    // COMMIT TRANSACTION
                    // ============================================================
                    db.run('COMMIT', (err) => {
                        if (err) {
                            console.error('❌ Commit error:', err);
                            db.run('ROLLBACK');
                            resolve({ success: false, error: `Transaction commit failed: ${err.message}` });
                        } else {
                            console.log('✅ Transfer completed successfully');
                            resolve({ success: true, details: transferDetails });
                        }
                    });

                } catch (error) {
                    console.error('❌ Transfer error:', error);
                    db.run('ROLLBACK');
                    resolve({ success: false, error: error.message });
                }
            });

        } catch (error) {
            console.error('❌ Critical transfer error:', error);
            resolve({ success: false, error: error.message });
        }
    });
}

/**
 * Log transfer action to a designated channel
 * @param {Message} message - Original message
 * @param {string} oldId - Old Discord ID
 * @param {string} newId - New Discord ID
 * @param {Object} details - Transfer details
 */
function logTransferAction(message, oldId, newId, details) {
    const { EmbedBuilder } = require('discord.js');
    
    try {
        const STAFF_CHANNEL_ID = '1184286235074760846';
        const logChannel = message.guild.channels.cache.get(STAFF_CHANNEL_ID);
        
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(0xff9900)
                .setTitle('📋 Account Transfer Log')
                .addFields(
                    { name: 'Admin', value: `${message.author.tag} (${message.author.id})`, inline: false },
                    { name: 'From Account', value: `<@${oldId}> (\`${oldId}\`)`, inline: true },
                    { name: 'To Account', value: `<@${newId}> (\`${newId}\`)`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: 'Transferred Data', value: 
                        `🍡 Mochi: ${details.mochi}\n` +
                        `🌺 Waterlily: ${details.waterlily}\n` +
                        `📦 Items: ${details.items}\n` +
                        `⚔️ Equipment: ${details.equipment}\n` +
                        `💭 Memories: ${details.memories}\n` +
                        `📝 Other: ${details.other}`,
                        inline: false
                    }
                )
                .setTimestamp();
            
            logChannel.send({ embeds: [logEmbed] });
        }
    } catch (error) {
        console.error('❌ Error logging transfer:', error);
    }
}

module.exports = { handleTransferUserCommand };