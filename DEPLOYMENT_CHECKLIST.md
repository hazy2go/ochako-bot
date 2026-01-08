# Ochako Bot - Deployment Checklist

Use this checklist before deploying the cleaned bot to ensure everything is configured correctly.

## Pre-Deployment Setup

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env`
  ```bash
  cp .env.example .env
  ```

- [ ] Fill in all required values in `.env`:
  - [ ] `OPENAI_API_KEY` - Your OpenAI API key
  - [ ] `DISCORD_TOKEN` - Your Discord bot token
  - [ ] `TWEET_CHANNEL_ID` - Channel for tweet links
  - [ ] `FORUM_CHANNEL_ID` - Forum channel for raid threads
  - [ ] `STAFF_CHANNEL_ID` - Staff notifications channel
  - [ ] `MOCHI_SHOP_CHANNEL` - Main shop channel
  - [ ] `EQUIPMENT_SHOP_CHANNEL` - Equipment shop channel
  - [ ] `WATERLILY_SHOP_CHANNEL` - Premium shop channel
  - [ ] `NOTIFICATION_CHANNEL` - General notifications
  - [ ] `DAILY_REWARDS_CHANNEL` - Daily rewards announcements
  - [ ] `TEA_CHANNEL_ID` - Tea serving channel
  - [ ] `DM_FORWARD_CHANNEL_ID` - DM forwarding destination
  - [ ] `RANDOM_CHAT_CHANNELS` - Comma-separated list of chat channels
  - [ ] `TEA_ROLE_ID` - Tea role ID
  - [ ] `ADMIN_ROLE_ID` - Admin role ID
  - [ ] `GUILD_ID` - Your server/guild ID
  - [ ] `AUTHORIZED_DM_USER_ID` - Authorized DM sender ID

### 2. Dependencies
- [ ] Install Node.js dependencies
  ```bash
  npm install
  ```

### 3. Required Files
- [ ] Verify `./transfer-user-command.js` exists
- [ ] Verify `./database-backup.js` exists
- [ ] (Optional) Add custom font at `./fonts/HandWritten.otf`

### 4. File Permissions
- [ ] Ensure `.env` is NOT in version control
  ```bash
  git check-ignore .env
  # Should output: .env
  ```

- [ ] Verify `.gitignore` includes `.env`
  ```bash
  grep "^\.env$" .gitignore
  ```

## Security Verification

### 5. Security Checks
- [ ] No hardcoded secrets in `bot.js`
  ```bash
  grep -E "sk-proj-|MTIx" bot.js
  # Should return nothing
  ```

- [ ] All sensitive IDs use environment variables
  ```bash
  grep "process.env" bot.js | wc -l
  # Should show 17+ references
  ```

- [ ] `.env` file has proper permissions (not world-readable)
  ```bash
  chmod 600 .env
  ```

### 6. Discord Bot Configuration
- [ ] Bot has required permissions in Discord Developer Portal:
  - [ ] Send Messages
  - [ ] Read Messages/View Channels
  - [ ] Manage Roles (for tea role)
  - [ ] Embed Links
  - [ ] Attach Files
  - [ ] Read Message History
  - [ ] Add Reactions
  - [ ] Use Slash Commands

- [ ] Bot is invited to your server with correct permissions
- [ ] Developer Mode is enabled in Discord (for copying IDs)

### 7. OpenAI Configuration
- [ ] OpenAI API key is valid
- [ ] Account has available credits
- [ ] Rate limits are acceptable for your usage

## Testing

### 8. Syntax Check
- [ ] Run syntax check
  ```bash
  node -c bot.js
  # Should output nothing (success)
  ```

### 9. Dry Run
- [ ] Start bot in test mode
  ```bash
  node bot.js
  ```

- [ ] Verify startup messages:
  - [ ] "✅ Custom font registered successfully" OR "⚠️ Custom font not found"
  - [ ] "✅ Main database connected successfully"
  - [ ] "✅ AI Database connected successfully"
  - [ ] "✅ Database tables initialized successfully"
  - [ ] Bot login success message

### 10. Feature Testing
Test each major feature:
- [ ] Slash commands work
- [ ] Shop embeds display correctly
- [ ] Currency commands functional
- [ ] Equipment system works
- [ ] AI chat responds to mentions
- [ ] Polls can be created
- [ ] Raffles function
- [ ] Tea serving works
- [ ] Admin commands accessible

## Deployment

### 11. Production Deployment
- [ ] Review all environment variables one final time
- [ ] Ensure databases are backed up
- [ ] Set up process manager (PM2, systemd, etc.)
  ```bash
  # Example with PM2:
  pm2 start bot.js --name ochako-bot
  pm2 save
  pm2 startup
  ```

- [ ] Configure auto-restart on failure
- [ ] Set up logging
  ```bash
  pm2 logs ochako-bot
  ```

### 12. Monitoring
- [ ] Set up error monitoring
- [ ] Configure log rotation
- [ ] Monitor API usage (OpenAI credits)
- [ ] Watch for Discord rate limits
- [ ] Monitor database size

### 13. Backup Strategy
- [ ] Automated database backups configured
- [ ] Backup retention policy set
- [ ] Test backup restoration process

## Post-Deployment

### 14. Verification
- [ ] Bot appears online in Discord
- [ ] Slash commands are registered
- [ ] Shop channels show embeds
- [ ] All configured channels are accessible
- [ ] No error messages in logs

### 15. Documentation
- [ ] Team knows how to access logs
- [ ] Emergency contacts established
- [ ] Rollback procedure documented
- [ ] Backup restoration tested

## Maintenance

### 16. Regular Checks
- [ ] Weekly: Review error logs
- [ ] Monthly: Check OpenAI API usage
- [ ] Monthly: Review database size
- [ ] Quarterly: Update dependencies
- [ ] As needed: Rotate tokens/keys

## Emergency Procedures

### If Bot Goes Down:
1. Check logs: `pm2 logs ochako-bot`
2. Verify environment variables are loaded
3. Check database accessibility
4. Verify Discord token is valid
5. Restart: `pm2 restart ochako-bot`

### If Token Leaked:
1. Immediately regenerate Discord bot token
2. Update `.env` file
3. Regenerate OpenAI API key
4. Restart bot
5. Review code for any other exposed secrets

### If Database Corrupted:
1. Stop bot
2. Restore from latest backup
3. Verify data integrity
4. Restart bot
5. Test functionality

---

## Completion

When all items are checked:
- [ ] Bot is running in production
- [ ] All features tested and working
- [ ] Monitoring is active
- [ ] Team is notified
- [ ] Documentation is updated

**Deployment Date:** _____________

**Deployed By:** _____________

**Notes:** 
_______________________________________________
_______________________________________________
_______________________________________________
