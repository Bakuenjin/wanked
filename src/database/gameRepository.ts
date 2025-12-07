/**
 * Game Repository
 * 
 * Database operations for game records
 */

import { getDatabase } from './connection';
import { GameRecord, RecentGame } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Convert database row to GameRecord object
 */
function rowToGameRecord(row: Record<string, unknown>): GameRecord {
  return {
    id: row.id as number,
    playerId: row.player_id as number,
    guessCount: row.guess_count as number,
    gameDate: row.game_date as string,
    wordleNumber: row.wordle_number as number | null,
    eloChange: row.elo_change as number,
    eloBefore: row.elo_before as number,
    eloAfter: row.elo_after as number,
    createdAt: row.created_at as string,
  };
}

/**
 * Record a game result
 */
export function recordGame(
  playerId: number,
  guessCount: number,
  gameDate: string,
  eloBefore: number,
  eloAfter: number,
  wordleNumber?: number
): GameRecord {
  const logger = getLogger();
  const db = getDatabase();
  const eloChange = eloAfter - eloBefore;

  const stmt = db.prepare(`
    INSERT INTO games (player_id, guess_count, game_date, wordle_number, elo_change, elo_before, elo_after)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(playerId, guessCount, gameDate, wordleNumber ?? null, eloChange, eloBefore, eloAfter);
  logger.debug(`Recorded game for player ${playerId}: ${guessCount}/6, ELO ${eloBefore} -> ${eloAfter}`);

  return getGameById(result.lastInsertRowid as number)!;
}

/**
 * Get game by ID
 */
export function getGameById(id: number): GameRecord | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToGameRecord(row) : null;
}

/**
 * Get games for a player
 */
export function getGamesForPlayer(playerId: number, limit: number = 10): GameRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM games 
    WHERE player_id = ? 
    ORDER BY game_date DESC 
    LIMIT ?
  `).all(playerId, limit) as Record<string, unknown>[];
  return rows.map(rowToGameRecord);
}

/**
 * Get recent games for stats display
 */
export function getRecentGamesForPlayer(playerId: number, limit: number = 5): RecentGame[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT game_date, guess_count, elo_change 
    FROM games 
    WHERE player_id = ? 
    ORDER BY game_date DESC 
    LIMIT ?
  `).all(playerId, limit) as Record<string, unknown>[];

  return rows.map(row => ({
    gameDate: row.game_date as string,
    guessCount: row.guess_count as number,
    eloChange: row.elo_change as number,
  }));
}

/**
 * Get games for a specific date
 */
export function getGamesForDate(gameDate: string): GameRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM games 
    WHERE game_date = ? 
    ORDER BY guess_count ASC
  `).all(gameDate) as Record<string, unknown>[];
  return rows.map(rowToGameRecord);
}

/**
 * Check if game already recorded for player on date
 */
export function hasGameRecord(playerId: number, gameDate: string): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM games 
    WHERE player_id = ? AND game_date = ?
  `).get(playerId, gameDate) as { count: number };
  return result.count > 0;
}

/**
 * Get player's game count
 */
export function getPlayerGameCount(playerId: number): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM games 
    WHERE player_id = ?
  `).get(playerId) as { count: number };
  return result.count;
}

/**
 * Get player's average guess count
 */
export function getPlayerAverageGuesses(playerId: number): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT AVG(guess_count) as avg FROM games 
    WHERE player_id = ?
  `).get(playerId) as { avg: number | null };
  return result.avg ?? 0;
}

/**
 * Get total participants for a date
 */
export function getParticipantCountForDate(gameDate: string): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM games 
    WHERE game_date = ?
  `).get(gameDate) as { count: number };
  return result.count;
}

/**
 * Record ELO history entry
 */
export function recordEloHistory(playerId: number, elo: number, gameDate: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO elo_history (player_id, elo, game_date)
    VALUES (?, ?, ?)
  `).run(playerId, elo, gameDate);
}

/**
 * Get ELO history for player
 */
export function getEloHistory(playerId: number, limit: number = 30): { elo: number; gameDate: string }[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT elo, game_date 
    FROM elo_history 
    WHERE player_id = ? 
    ORDER BY game_date DESC 
    LIMIT ?
  `).all(playerId, limit) as Record<string, unknown>[];

  return rows.map(row => ({
    elo: row.elo as number,
    gameDate: row.game_date as string,
  }));
}

/**
 * Save daily summary
 */
export function saveDailySummary(
  gameDate: string,
  participantsCount: number,
  highestEloPlayerId: number | null,
  lowestEloPlayerId: number | null,
  wordleNumber?: number
): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO daily_summaries 
    (game_date, wordle_number, participants_count, highest_elo_player_id, lowest_elo_player_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(gameDate, wordleNumber ?? null, participantsCount, highestEloPlayerId, lowestEloPlayerId);
}

/**
 * Check if daily results already processed
 */
export function isDailyResultsProcessed(gameDate: string): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM daily_summaries 
    WHERE game_date = ?
  `).get(gameDate) as { count: number };
  return result.count > 0;
}
