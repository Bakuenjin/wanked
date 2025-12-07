# Discord Wordle Ranked Bot

An ELO-based ranking system for Discord's Wordle bot. Track player performance, calculate rankings, and assign roles to top and bottom players.

## Features

- 📊 **ELO-Based Ranking**: Pairwise ELO calculations between daily participants
- 🎯 **Message Parsing**: Automatic detection and parsing of Wordle bot results
- 👑 **Role Assignment**: Automatic role updates for highest and lowest ELO players
- 📈 **Stats Command**: `/stats` to view player statistics
- 🏆 **Leaderboard**: `/leaderboard` to view top players
- 🔄 **Activity Tracking**: Automatic inactive status after 3+ days without playing
- 💾 **Persistent Storage**: SQLite database for all player data

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- A Discord bot application

### Installation

1. Clone or download this project

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your values:

   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file:

   ```env
   DISCORD_BOT_TOKEN=your_bot_token
   DISCORD_CLIENT_ID=your_client_id
   DISCORD_GUILD_ID=your_guild_id  # Optional, for faster command registration
   HIGHEST_ELO_ROLE_ID=your_role_id
   LOWEST_ELO_ROLE_ID=your_role_id
   ```

5. Deploy slash commands:

   ```bash
   npm run deploy-commands
   ```

6. Start the bot:

   ```bash
   npm run build
   npm start
   ```

   Or for development:

   ```bash
   npm run dev
   ```

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Enable these Privileged Gateway Intents:
   - **Server Members Intent**
   - **Message Content Intent**
5. Copy the bot token to your `.env` file
6. Go to OAuth2 → URL Generator:
   - Select scopes: `bot`, `applications.commands`
   - Select permissions: `Manage Roles`, `Send Messages`, `Read Message History`, `Use Slash Commands`
7. Use the generated URL to invite the bot to your server

## Creating Roles

Create two roles in your Discord server:

1. A role for the player with the **highest ELO** (e.g., "Wordle Champion 👑")
2. A role for the player with the **lowest ELO** (e.g., "Wordle Beginner 🌱")

Copy their role IDs to your `.env` file. Make sure the bot's role is **higher** than these roles in the server settings.

## Commands

| Command                      | Description                                                |
| ---------------------------- | ---------------------------------------------------------- |
| `/stats [user]`              | View Wordle ranked statistics for yourself or another user |
| `/leaderboard [limit] [all]` | View the top players by ELO                                |

## How ELO Works

The bot uses a **pairwise ELO system**:

1. When daily Wordle results are posted, each player is matched against every other player
2. Lower guess count = win (score 1.0)
3. Same guess count = tie (score 0.5)
4. Higher guess count = loss (score 0.0)
5. ELO is adjusted based on expected vs actual performance
6. K-factor is scaled by the number of opponents

### Example

If 4 players participate:

- Player A: 2/6 (beats B, C, D)
- Player B: 3/6 (beats C, D, loses to A)
- Player C: 4/6 (beats D, loses to A, B)
- Player D: 5/6 (loses to A, B, C)

Player A gains the most ELO, Player D loses the most.

## Configuration

| Variable               | Description                         | Default             |
| ---------------------- | ----------------------------------- | ------------------- |
| `ELO_K_FACTOR`         | ELO K-factor for rating changes     | 32                  |
| `ELO_DEFAULT_RATING`   | Starting ELO for new players        | 1000                |
| `INACTIVITY_THRESHOLD` | Days before marking player inactive | 3                   |
| `WORDLE_BOT_ID`        | Discord Wordle bot user ID          | 1211781489931452447 |
| `LOG_LEVEL`            | Logging verbosity                   | info                |

## Project Structure

```
src/
├── commands/           # Slash command handlers
│   ├── stats.ts
│   ├── leaderboard.ts
│   └── index.ts
├── config/             # Configuration loader
│   └── index.ts
├── database/           # Database layer
│   ├── connection.ts
│   ├── playerRepository.ts
│   ├── gameRepository.ts
│   └── index.ts
├── events/             # Discord event handlers
│   ├── messageCreate.ts
│   ├── interactionCreate.ts
│   ├── ready.ts
│   └── index.ts
├── services/           # Business logic
│   ├── eloService.ts
│   ├── messageParser.ts
│   ├── statsService.ts
│   ├── roleService.ts
│   ├── activityService.ts
│   └── index.ts
├── types/              # TypeScript interfaces
│   └── index.ts
├── utils/              # Utility functions
│   ├── logger.ts
│   ├── date.ts
│   └── index.ts
├── index.ts            # Main entry point
└── deploy-commands.ts  # Command deployment script
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with auto-reload)
npm run dev:watch

# Build for production
npm run build

# Deploy commands to Discord
npm run deploy-commands

# Start production build
npm start
```

## Database

The bot uses SQLite by default. The database file is created at `./data/wordle_ranked.db`.

### Tables

- **players**: Player information and current stats
- **games**: Individual game records with ELO changes
- **elo_history**: Historical ELO ratings over time
- **daily_summaries**: Daily processing records

## Future Enhancements

- [ ] Seasonal resets
- [ ] Historical stats (month/year views)
- [ ] Player profile customization
- [ ] Statistics export API
- [ ] Head-to-head comparison command
- [ ] Streak tracking
- [ ] Achievement system

## Troubleshooting

### Bot not responding to Wordle messages

1. Check that the Wordle bot ID is correct in `.env`
2. Ensure "Message Content Intent" is enabled
3. Verify the bot has permission to read messages in the channel

### Commands not appearing

1. Run `npm run deploy-commands`
2. Wait up to 1 hour for global commands to propagate
3. Use `DISCORD_GUILD_ID` for instant updates during development

### Role assignment not working

1. Ensure the bot's role is higher than the target roles
2. Check that the role IDs are correct in `.env`
3. Verify the bot has "Manage Roles" permission

## License

MIT
