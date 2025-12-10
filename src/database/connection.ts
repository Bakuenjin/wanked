/**
 * Database Connection and Schema
 *
 * SQLite database setup with better-sqlite3
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { getLogger } from '../utils/logger'

let db: Database.Database | null = null

/**
 * Initialize database connection and create tables
 */
export function initDatabase(dbPath: string): Database.Database {
  const logger = getLogger()

  // Ensure directory exists
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    logger.info(`Created database directory: ${dir}`)
  }

  // Create database connection
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  logger.info(`Database connected: ${dbPath}`)

  // Create tables
  createTables(db)

  return db
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.')
  }
  return db
}

/**
 * Create database tables
 */
function createTables(database: Database.Database): void {
  const logger = getLogger()

  // Players table
  database.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      discriminator TEXT DEFAULT '0',
      elo INTEGER DEFAULT 1000,
      total_games INTEGER DEFAULT 0,
      total_wins INTEGER DEFAULT 0,
      total_crowns INTEGER DEFAULT 0,
      total_guesses INTEGER DEFAULT 0,
      last_played TEXT,
      consecutive_inactive_days INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Games table - stores individual game results
  database.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      guess_count INTEGER NOT NULL,
      game_date TEXT NOT NULL,
      wordle_number INTEGER,
      elo_change INTEGER DEFAULT 0,
      elo_before INTEGER NOT NULL,
      elo_after INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (player_id) REFERENCES players(id),
      UNIQUE(player_id, game_date)
    )
  `)

  // ELO history table - for tracking ELO over time
  database.exec(`
    CREATE TABLE IF NOT EXISTS elo_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      elo INTEGER NOT NULL,
      game_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `)

  // Daily summary table - for quick lookups
  database.exec(`
    CREATE TABLE IF NOT EXISTS daily_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_date TEXT UNIQUE NOT NULL,
      wordle_number INTEGER,
      participants_count INTEGER NOT NULL,
      highest_elo_player_id INTEGER,
      lowest_elo_player_id INTEGER,
      processed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (highest_elo_player_id) REFERENCES players(id),
      FOREIGN KEY (lowest_elo_player_id) REFERENCES players(id)
    )
  `)

  // Create indexes for performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_players_discord_id ON players(discord_id);
    CREATE INDEX IF NOT EXISTS idx_players_elo ON players(elo DESC);
    CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active);
    CREATE INDEX IF NOT EXISTS idx_games_player_id ON games(player_id);
    CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date);
    CREATE INDEX IF NOT EXISTS idx_elo_history_player ON elo_history(player_id);
    CREATE INDEX IF NOT EXISTS idx_elo_history_date ON elo_history(game_date);
  `)

  // Run migrations for existing databases
  runMigrations(database)

  logger.info('Database tables created/verified')
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    getLogger().info('Database connection closed')
  }
}

/**
 * Run database migrations for existing databases
 */
function runMigrations(database: Database.Database): void {
  const logger = getLogger()

  // Check if total_crowns column exists in players table
  const tableInfo = database
    .prepare('PRAGMA table_info(players)')
    .all() as Array<{ name: string }>
  const hasColumnTotalCrowns = tableInfo.some(
    (col) => col.name === 'total_crowns'
  )

  if (!hasColumnTotalCrowns) {
    logger.info(
      'Running migration: Adding total_crowns column to players table'
    )
    database.exec(
      `ALTER TABLE players ADD COLUMN total_crowns INTEGER DEFAULT 0`
    )
    logger.info('Migration complete: total_crowns column added')
  }
}

export default getDatabase
