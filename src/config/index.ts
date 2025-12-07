/**
 * Bot Configuration Module
 * 
 * Loads and validates configuration from environment variables
 */

import { config as dotenvConfig } from 'dotenv';
import { BotConfig } from '../types';
import { Snowflake } from 'discord.js';

// Load environment variables
dotenvConfig();

/**
 * Get required environment variable or throw
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Get numeric environment variable
 */
function getNumericEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

/**
 * Load and validate bot configuration
 */
export function loadConfig(): BotConfig {
  return {
    discord: {
      token: getRequiredEnv('DISCORD_BOT_TOKEN'),
      clientId: getRequiredEnv('DISCORD_CLIENT_ID') as Snowflake,
      guildId: process.env.DISCORD_GUILD_ID as Snowflake | undefined,
      wordleBotId: getOptionalEnv('WORDLE_BOT_ID', '1211781489931452447') as Snowflake,
      highestEloRoleId: getRequiredEnv('HIGHEST_ELO_ROLE_ID') as Snowflake,
      lowestEloRoleId: getRequiredEnv('LOWEST_ELO_ROLE_ID') as Snowflake,
    },
    database: {
      path: getOptionalEnv('DATABASE_PATH', './data/wordle_ranked.db'),
    },
    elo: {
      kFactor: getNumericEnv('ELO_K_FACTOR', 32),
      defaultRating: getNumericEnv('ELO_DEFAULT_RATING', 1000),
    },
    inactivityThreshold: getNumericEnv('INACTIVITY_THRESHOLD', 3),
    logLevel: getOptionalEnv('LOG_LEVEL', 'info'),
  };
}

/**
 * Validate configuration values
 */
export function validateConfig(config: BotConfig): void {
  // Validate ELO settings
  if (config.elo.kFactor <= 0) {
    throw new Error('ELO K-Factor must be positive');
  }
  if (config.elo.defaultRating < 0) {
    throw new Error('ELO default rating cannot be negative');
  }
  if (config.inactivityThreshold < 1) {
    throw new Error('Inactivity threshold must be at least 1 day');
  }
}

// Export singleton config instance
let configInstance: BotConfig | null = null;

export function getConfig(): BotConfig {
  if (!configInstance) {
    configInstance = loadConfig();
    validateConfig(configInstance);
  }
  return configInstance;
}

export default getConfig;
