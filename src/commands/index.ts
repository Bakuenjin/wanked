/**
 * Commands Index
 *
 * Exports all slash commands for registration
 */

import * as stats from './stats'
import * as leaderboard from './leaderboard'
import * as reset from './reset'

export const commands = [stats, leaderboard, reset]

export { stats, leaderboard, reset }
