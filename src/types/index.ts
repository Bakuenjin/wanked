/**
 * Discord Wordle Ranked Bot - Type Definitions
 * 
 * Core interfaces and types for the ELO ranking system
 */

import { Snowflake } from 'discord.js';

/**
 * Player entity stored in the database
 */
export interface Player {
  id: number;
  discordId: Snowflake;
  username: string;
  discriminator: string;
  elo: number;
  totalGames: number;
  totalWins: number;  // Games with 6/6
  totalGuesses: number;  // Sum of all guess counts for averaging
  lastPlayed: string | null;  // ISO date string
  consecutiveInactiveDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Player creation data (without auto-generated fields)
 */
export interface CreatePlayerData {
  discordId: Snowflake;
  username: string;
  discriminator: string;
}

/**
 * Game result from a Wordle game
 */
export interface GameResult {
  playerId: number;
  discordId: Snowflake;
  guessCount: number;  // 1-6 for successful games
  gameDate: string;  // ISO date string (YYYY-MM-DD)
  wordleNumber?: number;  // Wordle puzzle number if available
}

/**
 * Stored game record in database
 */
export interface GameRecord {
  id: number;
  playerId: number;
  guessCount: number;
  gameDate: string;
  wordleNumber: number | null;
  eloChange: number;
  eloBefore: number;
  eloAfter: number;
  createdAt: string;
}

/**
 * Daily results parsed from Wordle bot message
 */
export interface DailyResults {
  gameDate: string;
  wordleNumber?: number;
  results: ParsedPlayerResult[];
}

/**
 * Individual player result from parsed message
 */
export interface ParsedPlayerResult {
  discordId: Snowflake;
  username: string;
  guessCount: number;
}

/**
 * ELO calculation result for a single player
 */
export interface EloCalculationResult {
  playerId: number;
  discordId: Snowflake;
  previousElo: number;
  newElo: number;
  eloChange: number;
  guessCount: number;
}

/**
 * Pairwise ELO matchup result
 */
export interface EloMatchup {
  player1Id: number;
  player2Id: number;
  player1Score: number;  // 1 for win, 0.5 for tie, 0 for loss
  player2Score: number;
}

/**
 * Player statistics for display
 */
export interface PlayerStats {
  discordId: Snowflake;
  username: string;
  elo: number;
  rank: number;
  totalGames: number;
  totalWins: number;
  averageGuesses: number;
  winRate: number;  // Percentage
  isActive: boolean;
  lastPlayed: string | null;
  recentGames?: RecentGame[];
}

/**
 * Recent game info for stats display
 */
export interface RecentGame {
  gameDate: string;
  guessCount: number;
  eloChange: number;
}

/**
 * Role assignment data
 */
export interface RoleAssignment {
  highestEloPlayer: {
    discordId: Snowflake;
    username: string;
    elo: number;
  } | null;
  lowestEloPlayer: {
    discordId: Snowflake;
    username: string;
    elo: number;
  } | null;
}

/**
 * Bot configuration interface
 */
export interface BotConfig {
  discord: {
    token: string;
    clientId: Snowflake;
    guildId?: Snowflake;
    wordleBotId: Snowflake;
    highestEloRoleId: Snowflake;
    lowestEloRoleId: Snowflake;
  };
  database: {
    path: string;
  };
  elo: {
    kFactor: number;
    defaultRating: number;
  };
  inactivityThreshold: number;
  logLevel: string;
}

/**
 * Leaderboard entry for future leaderboard command
 */
export interface LeaderboardEntry {
  rank: number;
  discordId: Snowflake;
  username: string;
  elo: number;
  totalGames: number;
  winRate: number;
  isActive: boolean;
}

/**
 * Activity update result
 */
export interface ActivityUpdateResult {
  playersMarkedInactive: number;
  playersStillActive: number;
}

/**
 * Database query result wrapper
 */
export interface QueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * ELO history entry for tracking over time
 */
export interface EloHistoryEntry {
  id: number;
  playerId: number;
  elo: number;
  gameDate: string;
  createdAt: string;
}
