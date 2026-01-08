# Ochako Bot - Cleaned Version

This is a cleaned and improved version of the Ochako Discord bot for the Pathfinders NFT project.

## Changes Made in This Cleanup

### Security Fixes (CRITICAL)
- ✅ Replaced hardcoded OpenAI API key with environment variable
- ✅ Replaced hardcoded Discord token with environment variable
- ✅ Replaced all hardcoded channel IDs with environment variables
- ✅ Replaced all hardcoded role IDs with environment variables
- ✅ Replaced hardcoded guild ID with environment variable
- ✅ Replaced hardcoded user IDs with environment variables

### Code Cleanup
- ✅ Removed unused vendor.json loading (lines 343-345)
- ✅ Removed unused globalthread variable (line 112)
- ✅ Removed outdated gift preference system (lines 355-520)
- ✅ Removed unused GIFT_RESPONSE_EXAMPLES constant
- ✅ Removed unused generateGiftContext() function
- ✅ Removed unused enhancePersonalityWithGifts() function
- ✅ Fixed references to removed functions

### Improvements
- ✅ Improved font loading with graceful failure handling
- ✅ Added path checking before loading fonts
- ✅ Better error messages for missing font files
- ✅ Cleaned up malformed code sections
- ✅ Added comprehensive .env.example file

### Code Reduction
- Original: 7,921 lines
- Cleaned: ~7,650 lines
- Removed: ~270 lines of unused/outdated code

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual values in `.env`:
   - Get your OpenAI API key from https://platform.openai.com/api-keys
   - Get your Discord bot token from https://discord.com/developers/applications
   - Copy channel/role/guild IDs from Discord (enable Developer Mode first)

### 3. Create Required Files
The bot expects these external files:
- `./transfer-user-command.js` - User transfer command handler
- `./database-backup.js` - Database backup command handlers
- `./fonts/HandWritten.otf` - Custom font (optional, bot will work without it)

### 4. Run the Bot
```bash
node bot.js
```

## Features

### Currency Systems
- **Mochi** - Primary currency earned through activities
- **Waterlily** - Premium currency for special items

### Shop Systems
- **Mochi Shop** - Regular items purchasable with Mochi
- **Waterlily Shop** - Premium items purchasable with Waterlily
- **Equipment Shop** - Stat-based equipment system

### AI Features
- **Conversation Memory** - Remembers facts about users
- **Contextual Responses** - Maintains conversation context
- **Random Chat** - Can randomly initiate conversations

### Community Features
- **Polls** - Create and manage community polls
- **Raffles** - Run giveaways and raffles
- **Tweet Raids** - Coordinate Twitter engagement
- **Tea Serving** - Special role assignment system
- **Daily Rewards** - Scheduled reward distribution

### Equipment System
- 6 equipment slots: Head, Neck, Chest, Hands, Ring, Weapon
- Stat system: Attack, Defense, Speed
- Rarity tiers
- Version tracking for item changes

## Database Files
- `mochi.db` - Main database (user data, inventory, shops)
- `ai_agent.db` - AI conversation memory database

## Security Notes
- **NEVER** commit your `.env` file
- **NEVER** share your Discord token or OpenAI API key
- Keep your `.env` file in `.gitignore`
- Rotate tokens immediately if exposed

## Support
For issues or questions, contact the bot administrator.
