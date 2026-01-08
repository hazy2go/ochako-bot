# Ochako Bot - File Index

Quick reference guide for the cleaned bot project.

## Main Files

### `bot.js` (7,635 lines)
The main bot file containing all functionality.

**Key Sections:**
- Lines 1-76: Imports and font loading
- Lines 77-113: Configuration and environment setup
- Lines 114-320: Database initialization
- Lines 321-340: OpenAI and Discord client setup
- Lines 341-476: Bot personality configuration
- Lines 477-795: Conversation memory and AI system
- Lines 796-1047: Random conversation system
- Lines 1048-1700: Shop system (Mochi, Waterlily, Equipment)
- Lines 1701-2400: Purchase and trading functions
- Lines 2401-3700: Equipment system
- Lines 3701-4500: Admin commands
- Lines 4501-5500: Poll and raffle systems
- Lines 5501-6200: Tweet raids and community features
- Lines 6201-7635: Event handlers and command registration

## Documentation Files

### `README.md` (105 lines)
Main documentation covering:
- Setup instructions
- Feature overview
- Database information
- Security notes

### `CLEANUP_SUMMARY.md` (283 lines)
Detailed cleanup documentation:
- All changes made
- Before/after code comparisons
- Security improvements
- Metrics and statistics

### `DEPLOYMENT_CHECKLIST.md` (224 lines)
Step-by-step deployment guide:
- Pre-deployment setup
- Security verification
- Testing procedures
- Monitoring setup
- Emergency procedures

### `INDEX.md` (this file)
Quick reference for project navigation.

## Configuration Files

### `.env.example` (3.6 KB)
Template for environment variables:
- API keys and tokens
- Channel IDs (11 channels)
- Role IDs (2 roles)
- Guild and user IDs
- Optional settings

### `.gitignore` (405 bytes)
Git exclusion rules:
- Environment files
- Database files
- Node modules
- IDE and OS files

## Required External Files

These files must be present for the bot to run:

### `./transfer-user-command.js`
Handles user transfer commands.
Export: `handleTransferUserCommand()`

### `./database-backup.js`
Database backup functionality.
Exports:
- `handleBackupCommand()`
- `handleListBackupsCommand()`

### `./fonts/HandWritten.otf` (Optional)
Custom font for image generation.
Bot will run without it but won't have custom font styling.

## Database Files

### `mochi.db`
Main database containing:
- User data (Mochi & Waterlily balances)
- Shop items (regular, waterlily, equipment)
- User inventory
- Equipped items
- Player stats
- Equipment definitions

### `ai_agent.db`
AI conversation database:
- User memory/facts
- Conversation context
- Message history

## Dependencies

See `package.json` for full list. Key dependencies:
- `discord.js` - Discord API
- `openai` - OpenAI API
- `sqlite3` - Database
- `@napi-rs/canvas` - Image generation
- `node-cron` - Scheduled tasks
- `dotenv` - Environment variables

## Environment Variables Reference

All variables that must be configured in `.env`:

**Authentication:**
- `OPENAI_API_KEY`
- `DISCORD_TOKEN`

**Channels (11):**
- `TWEET_CHANNEL_ID`
- `FORUM_CHANNEL_ID`
- `STAFF_CHANNEL_ID`
- `MOCHI_SHOP_CHANNEL`
- `EQUIPMENT_SHOP_CHANNEL`
- `WATERLILY_SHOP_CHANNEL`
- `NOTIFICATION_CHANNEL`
- `DAILY_REWARDS_CHANNEL`
- `TEA_CHANNEL_ID`
- `DM_FORWARD_CHANNEL_ID`
- `RANDOM_CHAT_CHANNELS` (comma-separated)

**Roles (2):**
- `TEA_ROLE_ID`
- `ADMIN_ROLE_ID`

**Server:**
- `GUILD_ID`

**Users:**
- `AUTHORIZED_DM_USER_ID`

## Quick Start

1. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the bot:
   ```bash
   node bot.js
   ```

For detailed instructions, see `DEPLOYMENT_CHECKLIST.md`.

## Getting Help

1. Check `README.md` for general setup
2. Review `CLEANUP_SUMMARY.md` for what changed
3. Follow `DEPLOYMENT_CHECKLIST.md` for deployment
4. Contact bot administrator for server-specific help

## Change Log

### 2026-01-08 - Major Cleanup
- Removed 285 lines of unused code
- Replaced all hardcoded secrets with env vars
- Improved error handling
- Added comprehensive documentation

See `CLEANUP_SUMMARY.md` for complete details.
