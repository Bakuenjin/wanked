/**
 * Stats Service
 * 
 * Aggregates and provides player statistics
 */

import { Snowflake } from 'discord.js';
import { PlayerStats, LeaderboardEntry } from '../types';
import { getLogger } from '../utils/logger';
import {
  getPlayerByDiscordId,
  getPlayerById,
  getPlayerRank,
  getAllPlayersByElo,
  getActivePlayersByElo,
} from '../database/playerRepository';
import {
  getRecentGamesForPlayer,
} from '../database/gameRepository';

/**
 * Get stats for a player by Discord ID
 */
export function getPlayerStatsByDiscordId(discordId: Snowflake): PlayerStats | null {
  const logger = getLogger();
  const player = getPlayerByDiscordId(discordId);

  if (!player) {
    logger.debug(`Player not found: ${discordId}`);
    return null;
  }

  return buildPlayerStats(player.id);
}

/**
 * Get stats for a player by internal ID
 */
export function getPlayerStatsById(playerId: number): PlayerStats | null {
  const player = getPlayerById(playerId);

  if (!player) {
    return null;
  }

  return buildPlayerStats(playerId);
}

/**
 * Build complete player stats object
 */
function buildPlayerStats(playerId: number): PlayerStats | null {
  const player = getPlayerById(playerId);

  if (!player) {
    return null;
  }

  const rank = getPlayerRank(playerId);
  const recentGames = getRecentGamesForPlayer(playerId, 5);
  const averageGuesses = player.totalGames > 0
    ? player.totalGuesses / player.totalGames
    : 0;

  // Calculate win rate (games solved / total games)
  const winRate = player.totalGames > 0
    ? (player.totalWins / player.totalGames) * 100
    : 0;

  return {
    discordId: player.discordId,
    username: player.username,
    elo: player.elo,
    rank,
    totalGames: player.totalGames,
    totalWins: player.totalWins,
    totalCrowns: player.totalCrowns,
    averageGuesses: Math.round(averageGuesses * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
    isActive: player.isActive,
    lastPlayed: player.lastPlayed,
    recentGames,
  };
}

/**
 * Get leaderboard data with proper ranking (ties get same rank, followed by correct next rank)
 */
export function getLeaderboard(
  limit: number = 10,
  activeOnly: boolean = true
): LeaderboardEntry[] {
  const players = activeOnly ? getActivePlayersByElo() : getAllPlayersByElo();
  const limited = players.slice(0, limit);

  const entries: LeaderboardEntry[] = [];
  let currentRank = 1;
  let previousElo: number | null = null;

  for (let i = 0; i < limited.length; i++) {
    const player = limited[i];
    const winRate = player.totalGames > 0
      ? (player.totalWins / player.totalGames) * 100
      : 0;

    // If this player has same ELO as previous, they share the same rank
    // Otherwise, their rank is their position + 1 (accounting for ties)
    if (previousElo !== null && player.elo === previousElo) {
      // Same rank as previous player
    } else {
      currentRank = i + 1;
    }

    entries.push({
      rank: currentRank,
      discordId: player.discordId,
      username: player.username,
      elo: player.elo,
      totalGames: player.totalGames,
      winRate: Math.round(winRate * 100) / 100,
      isActive: player.isActive,
    });

    previousElo = player.elo;
  }

  return entries;
}

/**
 * Get summary statistics for the server
 */
export function getServerStats(): {
  totalPlayers: number;
  activePlayers: number;
  totalGamesPlayed: number;
  averageElo: number;
} {
  const allPlayers = getAllPlayersByElo();
  const activePlayers = getActivePlayersByElo();

  const totalGames = allPlayers.reduce((sum, p) => sum + p.totalGames, 0);
  const averageElo = allPlayers.length > 0
    ? allPlayers.reduce((sum, p) => sum + p.elo, 0) / allPlayers.length
    : 1000;

  return {
    totalPlayers: allPlayers.length,
    activePlayers: activePlayers.length,
    totalGamesPlayed: totalGames,
    averageElo: Math.round(averageElo),
  };
}

/**
 * Format stats for Discord embed
 */
export function formatStatsForEmbed(stats: PlayerStats): {
  fields: { name: string; value: string; inline: boolean }[];
} {
  const fields = [
    {
      name: '🏆 ELO Rating',
      value: `**${stats.elo}**`,
      inline: true,
    },
    {
      name: '📊 Rank',
      value: `#${stats.rank}`,
      inline: true,
    },
    {
      name: '🎮 Games Played',
      value: `${stats.totalGames}`,
      inline: true,
    },
    {
      name: '✅ Games Solved',
      value: `${stats.totalWins}`,
      inline: true,
    },
    {
      name: '👑 Wins',
      value: `${stats.totalCrowns}`,
      inline: true,
    },
    {
      name: '📈 Solve Rate',
      value: `${stats.winRate}%`,
      inline: true,
    },
    {
      name: '🎯 Avg Guesses',
      value: `${stats.averageGuesses}`,
      inline: true,
    },
    {
      name: '📅 Status',
      value: stats.isActive ? '🟢 Active' : '🔴 Inactive',
      inline: true,
    },
    {
      name: '🕐 Last Played',
      value: stats.lastPlayed || 'Never',
      inline: true,
    },
  ];

  // Add recent games if available
  if (stats.recentGames && stats.recentGames.length > 0) {
    const recentText = stats.recentGames
      .slice(0, 3)
      .map((game) => {
        const changeText = game.eloChange >= 0 ? `+${game.eloChange}` : `${game.eloChange}`;
        return `${game.gameDate}: ${game.guessCount}/6 (${changeText} ELO)`;
      })
      .join('\n');

    fields.push({
      name: '📜 Recent Games',
      value: recentText || 'No recent games',
      inline: false,
    });
  }

  return { fields };
}

/**
 * Format leaderboard for Discord embed
 */
export function formatLeaderboardForEmbed(
  leaderboard: LeaderboardEntry[]
): string {
  if (leaderboard.length === 0) {
    return 'No players found.';
  }

  return leaderboard
    .map((entry) => {
      const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
      const status = entry.isActive ? '' : ' 💤';
      return `${medal} **${entry.username}**${status} - ${entry.elo} ELO (${entry.totalGames} games)`;
    })
    .join('\n');
}

export default {
  getPlayerStatsByDiscordId,
  getPlayerStatsById,
  getLeaderboard,
  getServerStats,
  formatStatsForEmbed,
  formatLeaderboardForEmbed,
};
