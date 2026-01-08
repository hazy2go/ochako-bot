# Ochako Discord Bot 🍡

A comprehensive Discord bot featuring a dual currency economy system, RPG mechanics, AI-powered conversations, and community engagement features.

## ✨ Features

### 💰 Economy System
- **Dual Currency**: Mochi (🍡) and Waterlily (🌺) with 3:1 conversion rate
- **Trading System**: Trade currencies and items between users
- **Transaction Tracking**: Complete history of all trades and purchases

### 🛍️ Shop Systems
Three distinct shops with unique items:
- **Mochi Shop** - Regular items purchasable with Mochi
- **Waterlily Shop** - Premium items and special content
- **Equipment Shop** - RPG gear with stats and rarity levels

### ⚔️ RPG Equipment System
- 6 equipment slots: Head, Neck, Chest, Hands, Ring, Weapon
- Stat bonuses: Attack, Defense, Speed
- Rarity tiers: Common, Uncommon, Rare, Epic, Legendary
- Role rewards for equipping certain items
- Full inventory management with version tracking

### 🤖 AI-Powered Features
- **Conversations**: OpenAI GPT-4 integration for natural interactions
- **Memory System**: Bot remembers facts and preferences about users
- **Random Chat**: Automated conversation participation in designated channels
- **Context Awareness**: Maintains conversation flow across channels

### 🎉 Community Engagement
- **Polls**: Create polls with up to 17 options, timed voting, and progress tracking
- **Raffles**: Three types (role-based, Mochi-based, Waterlily-based) with automatic winner selection
- **Tweet Raids**: Coordinate Twitter/X engagement campaigns with admin approval workflow
- **Tea Ceremony**: Daily tea role distribution with personality-based responses

### ⏰ Automated Features
- **Daily Rewards**: Scheduled rewards distribution
- **Good Morning Messages**: Automated daily greetings
- **Context Cleanup**: Automatic maintenance of conversation history
- **Random Conversations**: Scheduled random bot participation

## 📋 Commands

### User Commands
- `/inventory` - View your items and currencies
- `/equipment` - View equipped items and total stats
- `/equip` - Equip items from your inventory
- `/unequip <slot>` - Remove equipped item from a slot
- `/trade <user> <type> <amount>` - Trade with other users
- `/convert <mochi>` - Convert Mochi to Waterlily (3:1 ratio)
- `/poll` - Create a community poll
- `/raffle` - Create a raffle event

### Memory Commands (Prefix: `!`)
- `!remember <fact>` - Store information about yourself
- `!memories` - View what the bot remembers about you
- `!forget <keyword>` - Remove stored memories

### Admin Commands
- `/admin_items` - View all items in database
- `/admin_inventory <user>` - Check any user's inventory
- `/admin_update` - Update item properties (name, cost, stats, etc.)
- `/admin_searchitem <query>` - Search items by name
- `/admin_item <user> <add|remove> <item> <amount>` - Modify user inventory
- `/admin_give <user> <currency> <amount>` - Give Mochi or Waterlily
- `/admin_stats <currency>` - View currency statistics
- `/admin_leaderboard <currency>` - View top 10 holders
- `/setupshops` - Refresh all shop embeds
- `/archive [days]` - Archive channel messages
- `!randomchat status` - View random chat settings
- `!randomchat test` - Test random message generation

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- Discord Bot Token from [Discord Developer Portal](https://discord.com/developers/applications)
- OpenAI API Key (optional, for AI features) from [OpenAI Platform](https://platform.openai.com/api-keys)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/hazy2go/ochako-bot.git
cd ochako-bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
DISCORD_TOKEN=your_discord_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
GUILD_ID=your_server_id_here

# ... add all channel and role IDs
```

4. **Enable Developer Mode in Discord**
   - Settings → Advanced → Developer Mode
   - Right-click channels/roles/users to copy IDs

5. **Run the bot**
```bash
node bot.js
```

## 🔧 Configuration

All configuration is done via the `.env` file. Required variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Your Discord bot token | ✅ Yes |
| `GUILD_ID` | Your Discord server ID | ✅ Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | ⚠️ Optional |
| `*_CHANNEL_ID` | Various channel IDs | ⚠️ Feature-specific |
| `*_ROLE_ID` | Various role IDs | ⚠️ Feature-specific |

See `.env.example` for the complete list of configuration options.

## 🗄️ Database

The bot uses SQLite with two databases:
- **mochi.db** - Main data (users, items, equipment, shops)
- **ai_agent.db** - AI conversation memory and context

Databases are automatically created on first run.

## 🛡️ Required Permissions

The bot needs these Discord permissions:
- Read Messages/View Channels
- Send Messages
- Embed Links
- Attach Files
- Add Reactions
- Use External Emojis
- Manage Roles (for tea role and equipment roles)
- Read Message History
- Manage Messages (for polls/raffles)

## 📦 Dependencies

- `discord.js` - Discord API wrapper
- `openai` - AI conversations
- `sqlite3` - Database
- `@napi-rs/canvas` - Image generation
- `node-cron` - Task scheduling
- `dotenv` - Environment variables

See `package.json` for complete list.

## 🐛 Troubleshooting

### Bot won't start
- Verify `DISCORD_TOKEN` and `GUILD_ID` in `.env`
- Check Node.js version (18.0.0+)
- Ensure bot token is valid

### Commands not appearing
- Reinvite bot with `applications.commands` scope
- Check bot has necessary permissions
- Wait a few minutes for Discord to register commands

### AI features not working
- Verify `OPENAI_API_KEY` is set in `.env`
- Check OpenAI account has available credits
- Review console for API error messages

### Shops not updating
- Run `/setupshops` to refresh shop embeds
- Verify channel IDs are correct in `.env`
- Check bot has Send Messages permission

## 📄 License

MIT License - Feel free to modify and use for your own server!

## 🤝 Contributing

Contributions are welcome! Feel free to:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 💬 Support

For issues or questions:
- Open an issue on GitHub
- Check existing documentation
- Review console logs for error messages

---

Made with ❤️ for the Discord community
