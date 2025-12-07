/**
 * Commands Index
 * 
 * Exports all slash commands for registration
 */

import * as stats from './stats';
import * as leaderboard from './leaderboard';

export const commands = [
  stats,
  leaderboard,
];

export { stats, leaderboard };
