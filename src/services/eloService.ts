/**
 * ELO Calculation Service
 * 
 * Implements pairwise ELO calculations between Wordle players
 * Players with lower guess counts beat players with higher guess counts
 */

import { getLogger } from '../utils/logger';
import { EloCalculationResult, ParsedPlayerResult } from '../types';
import {
  getOrCreatePlayer,
  updatePlayerAfterGame,
} from '../database/playerRepository';
import {
  recordGame,
  recordEloHistory,
  hasGameRecord,
} from '../database/gameRepository';

interface EloConfig {
  kFactor: number;
  defaultRating: number;
}

/**
 * Calculate expected score for player A against player B
 */
function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new ELO rating after a single matchup
 * Exported for potential use in detailed matchup analysis
 */
export function calculateNewRating(
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number
): number {
  return Math.round(currentRating + kFactor * (actualScore - expectedScore));
}

/**
 * Determine match result between two players based on guess counts
 * Lower guess count = winner (score 1)
 * Same guess count = tie (score 0.5)
 * Higher guess count = loser (score 0)
 */
function determineMatchResult(
  guessCount1: number,
  guessCount2: number
): { score1: number; score2: number } {
  if (guessCount1 < guessCount2) {
    return { score1: 1, score2: 0 };
  } else if (guessCount1 > guessCount2) {
    return { score1: 0, score2: 1 };
  } else {
    return { score1: 0.5, score2: 0.5 };
  }
}

/**
 * Calculate pairwise ELO adjustments for all participating players
 */
export function calculatePairwiseElo(
  participants: { playerId: number; currentElo: number; guessCount: number }[],
  config: EloConfig
): Map<number, number> {
  const logger = getLogger();
  const eloChanges = new Map<number, number>();

  // Initialize all changes to 0
  for (const participant of participants) {
    eloChanges.set(participant.playerId, 0);
  }

  // If only 1 or 0 participants, no ELO changes
  if (participants.length < 2) {
    logger.debug('Not enough participants for ELO calculation');
    return eloChanges;
  }

  // Scaled K-factor based on number of matchups
  // Each player faces (n-1) opponents, so we scale K accordingly
  const scaledK = config.kFactor / (participants.length - 1);

  // Calculate pairwise matchups
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const player1 = participants[i];
      const player2 = participants[j];

      // Determine who won based on guess counts
      const { score1, score2 } = determineMatchResult(
        player1.guessCount,
        player2.guessCount
      );

      // Calculate expected scores
      const expected1 = calculateExpectedScore(player1.currentElo, player2.currentElo);
      const expected2 = calculateExpectedScore(player2.currentElo, player1.currentElo);

      // Calculate ELO change for this matchup
      const change1 = scaledK * (score1 - expected1);
      const change2 = scaledK * (score2 - expected2);

      // Accumulate changes
      eloChanges.set(player1.playerId, (eloChanges.get(player1.playerId) || 0) + change1);
      eloChanges.set(player2.playerId, (eloChanges.get(player2.playerId) || 0) + change2);
    }
  }

  // Round final changes
  for (const [playerId, change] of eloChanges) {
    eloChanges.set(playerId, Math.round(change));
  }

  return eloChanges;
}

/**
 * Process daily results and calculate ELO for all participants
 */
export function processDailyResults(
  results: ParsedPlayerResult[],
  gameDate: string,
  config: EloConfig,
  wordleNumber?: number
): EloCalculationResult[] {
  const logger = getLogger();
  const calculationResults: EloCalculationResult[] = [];

  logger.info(`Processing ${results.length} results for ${gameDate}`);

  // Get or create players and collect their data
  const participants: { playerId: number; currentElo: number; guessCount: number }[] = [];
  const playerMap = new Map<number, { discordId: string; guessCount: number; previousElo: number; hasCrown: boolean }>();

  for (const result of results) {
    // Get or create player
    const player = getOrCreatePlayer(
      {
        discordId: result.discordId,
        username: result.username,
        discriminator: '0',
      },
      config.defaultRating
    );

    // Check if already recorded for this date
    if (hasGameRecord(player.id, gameDate)) {
      logger.warn(`Player ${result.username} already has a record for ${gameDate}, skipping`);
      continue;
    }

    participants.push({
      playerId: player.id,
      currentElo: player.elo,
      guessCount: result.guessCount,
    });

    playerMap.set(player.id, {
      discordId: result.discordId,
      guessCount: result.guessCount,
      previousElo: player.elo,
      hasCrown: result.hasCrown,
    });
  }

  if (participants.length === 0) {
    logger.warn('No new participants to process');
    return calculationResults;
  }

  // Calculate pairwise ELO changes
  const eloChanges = calculatePairwiseElo(participants, config);

  // Apply changes and record games
  for (const participant of participants) {
    const playerData = playerMap.get(participant.playerId)!;
    const eloChange = eloChanges.get(participant.playerId) || 0;
    const newElo = participant.currentElo + eloChange;

    // Update player
    updatePlayerAfterGame(
      participant.playerId,
      playerData.guessCount,
      newElo,
      gameDate,
      playerData.hasCrown
    );

    // Record game
    recordGame(
      participant.playerId,
      playerData.guessCount,
      gameDate,
      participant.currentElo,
      newElo,
      wordleNumber
    );

    // Record ELO history
    recordEloHistory(participant.playerId, newElo, gameDate);

    // Add to results
    calculationResults.push({
      playerId: participant.playerId,
      discordId: playerData.discordId as `${bigint}`,
      previousElo: participant.currentElo,
      newElo,
      eloChange,
      guessCount: playerData.guessCount,
    });

    logger.debug(
      `Player ${participant.playerId}: ${playerData.guessCount}/6, ELO ${participant.currentElo} -> ${newElo} (${eloChange >= 0 ? '+' : ''}${eloChange})`
    );
  }

  logger.info(`Processed ${calculationResults.length} ELO calculations for ${gameDate}`);
  return calculationResults;
}

/**
 * Simulate ELO calculation without persisting (for preview/testing)
 */
export function simulateEloCalculation(
  participants: { playerId: number; currentElo: number; guessCount: number }[],
  config: EloConfig
): { playerId: number; currentElo: number; newElo: number; change: number }[] {
  const eloChanges = calculatePairwiseElo(participants, config);

  return participants.map((p) => ({
    playerId: p.playerId,
    currentElo: p.currentElo,
    newElo: p.currentElo + (eloChanges.get(p.playerId) || 0),
    change: eloChanges.get(p.playerId) || 0,
  }));
}

export default {
  calculatePairwiseElo,
  processDailyResults,
  simulateEloCalculation,
};
