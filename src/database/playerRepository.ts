/**
 * Player Repository
 * 
 * Database operations for player management
 */

import { Snowflake } from 'discord.js';
import { getDatabase } from './connection';
import { Player, CreatePlayerData } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Convert database row to Player object
 */
function rowToPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as number,
    discordId: row.discord_id as Snowflake,
    username: row.username as string,
    discriminator: row.discriminator as string,
    elo: row.elo as number,
    totalGames: row.total_games as number,
    totalWins: row.total_wins as number,
    totalCrowns: (row.total_crowns as number) ?? 0,
    totalGuesses: row.total_guesses as number,
    lastPlayed: row.last_played as string | null,
    consecutiveInactiveDays: row.consecutive_inactive_days as number,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Get player by Discord ID
 */
export function getPlayerByDiscordId(discordId: Snowflake): Player | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM players WHERE discord_id = ?').get(discordId) as Record<string, unknown> | undefined;
  return row ? rowToPlayer(row) : null;
}

/**
 * Get player by internal ID
 */
export function getPlayerById(id: number): Player | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToPlayer(row) : null;
}

/**
 * Create a new player
 */
export function createPlayer(data: CreatePlayerData, defaultElo: number = 1000): Player {
  const logger = getLogger();
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO players (discord_id, username, discriminator, elo)
    VALUES (?, ?, ?, ?)
  `);
  
  const result = stmt.run(data.discordId, data.username, data.discriminator, defaultElo);
  logger.info(`Created new player: ${data.username} (${data.discordId})`);
  
  return getPlayerById(result.lastInsertRowid as number)!;
}

/**
 * Get or create player
 */
export function getOrCreatePlayer(data: CreatePlayerData, defaultElo: number = 1000): Player {
  const existing = getPlayerByDiscordId(data.discordId);
  if (existing) {
    // Update username if changed
    if (existing.username !== data.username) {
      updatePlayerUsername(existing.id, data.username);
      existing.username = data.username;
    }
    return existing;
  }
  return createPlayer(data, defaultElo);
}

/**
 * Update player username
 */
export function updatePlayerUsername(playerId: number, username: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE players 
    SET username = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(username, playerId);
}

/**
 * Update player ELO
 */
export function updatePlayerElo(playerId: number, newElo: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE players 
    SET elo = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newElo, playerId);
}

/**
 * Update player after a game
 */
export function updatePlayerAfterGame(
  playerId: number,
  guessCount: number,
  newElo: number,
  gameDate: string,
  hasCrown: boolean = false
): void {
  const db = getDatabase();
  const isWin = guessCount <= 6;
  
  db.prepare(`
    UPDATE players 
    SET 
      elo = ?,
      total_games = total_games + 1,
      total_wins = total_wins + ?,
      total_crowns = total_crowns + ?,
      total_guesses = total_guesses + ?,
      last_played = ?,
      consecutive_inactive_days = 0,
      is_active = 1,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(newElo, isWin ? 1 : 0, hasCrown ? 1 : 0, guessCount, gameDate, playerId);
}

/**
 * Get all players ordered by ELO
 */
export function getAllPlayersByElo(): Player[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM players ORDER BY elo DESC').all() as Record<string, unknown>[];
  return rows.map(rowToPlayer);
}

/**
 * Get active players ordered by ELO
 */
export function getActivePlayersByElo(): Player[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM players WHERE is_active = 1 ORDER BY elo DESC').all() as Record<string, unknown>[];
  return rows.map(rowToPlayer);
}

/**
 * Get player with highest ELO
 */
export function getHighestEloPlayer(): Player | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM players WHERE is_active = 1 ORDER BY elo DESC LIMIT 1').get() as Record<string, unknown> | undefined;
  return row ? rowToPlayer(row) : null;
}

/**
 * Get all players with the highest ELO (handles ties)
 */
export function getHighestEloPlayers(): Player[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM players 
    WHERE is_active = 1 AND elo = (
      SELECT MAX(elo) FROM players WHERE is_active = 1
    )
  `).all() as Record<string, unknown>[];
  return rows.map(rowToPlayer);
}

/**
 * Get player with lowest ELO (among active players with at least 1 game)
 */
export function getLowestEloPlayer(): Player | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM players 
    WHERE is_active = 1 AND total_games > 0 
    ORDER BY elo ASC 
    LIMIT 1
  `).get() as Record<string, unknown> | undefined;
  return row ? rowToPlayer(row) : null;
}

/**
 * Get all players with the lowest ELO (handles ties, among active players with at least 1 game)
 */
export function getLowestEloPlayers(): Player[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM players 
    WHERE is_active = 1 AND total_games > 0 AND elo = (
      SELECT MIN(elo) FROM players WHERE is_active = 1 AND total_games > 0
    )
  `).all() as Record<string, unknown>[];
  return rows.map(rowToPlayer);
}

/**
 * Get player rank (players with same ELO share the same rank)
 */
export function getPlayerRank(playerId: number): number {
  const db = getDatabase();
  const player = getPlayerById(playerId);
  if (!player) return 0;
  
  // Count players with strictly higher ELO to determine rank
  // Players with same ELO will have the same rank
  const result = db.prepare(`
    SELECT COUNT(*) as rank FROM players 
    WHERE elo > ?
  `).get(player.elo) as { rank: number };
  
  return result.rank + 1;
}

/**
 * Get total player count
 */
export function getTotalPlayerCount(): number {
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as count FROM players').get() as { count: number };
  return result.count;
}

/**
 * Update player inactivity
 */
export function incrementInactiveDays(playerId: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE players 
    SET 
      consecutive_inactive_days = consecutive_inactive_days + 1,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(playerId);
}

/**
 * Mark player as inactive
 */
export function markPlayerInactive(playerId: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE players 
    SET is_active = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(playerId);
}

/**
 * Mark player as active
 */
export function markPlayerActive(playerId: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE players 
    SET is_active = 1, consecutive_inactive_days = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(playerId);
}

/**
 * Get players who didn't play on a specific date
 */
export function getPlayersWhoDidntPlay(gameDate: string): Player[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT p.* FROM players p
    WHERE p.id NOT IN (
      SELECT g.player_id FROM games g WHERE g.game_date = ?
    )
  `).all(gameDate) as Record<string, unknown>[];
  return rows.map(rowToPlayer);
}

/**
 * Check if player played on a specific date
 */
export function hasPlayerPlayedOnDate(playerId: number, gameDate: string): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM games 
    WHERE player_id = ? AND game_date = ?
  `).get(playerId, gameDate) as { count: number };
  return result.count > 0;
}

/**
 * Get leaderboard
 */
export function getLeaderboard(limit: number = 10, activeOnly: boolean = true): Player[] {
  const db = getDatabase();
  const query = activeOnly
    ? 'SELECT * FROM players WHERE is_active = 1 ORDER BY elo DESC LIMIT ?'
    : 'SELECT * FROM players ORDER BY elo DESC LIMIT ?';
  const rows = db.prepare(query).all(limit) as Record<string, unknown>[];
  return rows.map(rowToPlayer);
}
