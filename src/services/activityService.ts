/**
 * Activity Service
 * 
 * Tracks and updates player activity status
 */

import { getLogger } from '../utils/logger';
import { ActivityUpdateResult } from '../types';
import {
  getAllPlayersByElo,
  incrementInactiveDays,
  markPlayerInactive,
  getPlayersWhoDidntPlay,
} from '../database/playerRepository';
import { getTodayDate } from '../utils/date';

/**
 * Update activity status for all players after daily results
 */
export function updatePlayerActivity(
  gameDate: string,
  inactivityThreshold: number
): ActivityUpdateResult {
  const logger = getLogger();
  let playersMarkedInactive = 0;
  let playersStillActive = 0;

  // Get players who didn't play today
  const playersWhoDidntPlay = getPlayersWhoDidntPlay(gameDate);

  for (const player of playersWhoDidntPlay) {
    // Increment inactive days
    incrementInactiveDays(player.id);

    // Check if should mark as inactive
    const newInactiveDays = player.consecutiveInactiveDays + 1;

    if (newInactiveDays >= inactivityThreshold && player.isActive) {
      markPlayerInactive(player.id);
      playersMarkedInactive++;
      logger.info(
        `Marked player ${player.username} (${player.discordId}) as inactive after ${newInactiveDays} days`
      );
    } else {
      playersStillActive++;
    }
  }

  logger.info(
    `Activity update complete: ${playersMarkedInactive} marked inactive, ${playersStillActive} still active`
  );

  return {
    playersMarkedInactive,
    playersStillActive,
  };
}

/**
 * Get list of inactive players
 */
export function getInactivePlayers(): {
  id: number;
  discordId: string;
  username: string;
  inactiveDays: number;
}[] {
  const allPlayers = getAllPlayersByElo();

  return allPlayers
    .filter((p) => !p.isActive)
    .map((p) => ({
      id: p.id,
      discordId: p.discordId,
      username: p.username,
      inactiveDays: p.consecutiveInactiveDays,
    }));
}

/**
 * Check if a daily activity update is needed
 */
export function needsActivityUpdate(lastUpdateDate: string | null): boolean {
  if (!lastUpdateDate) {
    return true;
  }
  return lastUpdateDate < getTodayDate();
}

export default {
  updatePlayerActivity,
  getInactivePlayers,
  needsActivityUpdate,
};
