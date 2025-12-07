/**
 * Message Parser Service
 * 
 * Parses Wordle bot messages to extract game results
 */

import { Message, Snowflake } from 'discord.js';
import { DailyResults, ParsedPlayerResult } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Regular expression patterns for parsing Wordle messages
 */
const PATTERNS = {
  // Matches user mention with guess count: <@123456789> 4/6
  // Also handles: <@!123456789> 4/6 (nickname mentions)
  userResult: /<@!?(\d+)>\s*(\d)\/6/g,
  
  // Matches Wordle puzzle number: Wordle 1,234 or Wordle #1234
  wordleNumber: /Wordle\s*#?\s*([\d,]+)/i,
  
  // Matches streak information
  streak: /🔥\s*(\d+)/,
  
  // Matches the ranked section header
  rankedHeader: /ranked/i,
};

/**
 * Check if a message is from the Wordle bot
 */
export function isWordleMessage(message: Message, wordleBotId: Snowflake): boolean {
  return message.author.id === wordleBotId;
}

/**
 * Check if the message contains ranked results
 */
export function containsRankedResults(content: string): boolean {
  return PATTERNS.rankedHeader.test(content) && PATTERNS.userResult.test(content);
}

/**
 * Extract Wordle puzzle number from message
 */
export function extractWordleNumber(content: string): number | undefined {
  const match = content.match(PATTERNS.wordleNumber);
  if (match) {
    // Remove commas and parse
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  return undefined;
}

/**
 * Parse user results from message content
 */
export function parseUserResults(content: string): ParsedPlayerResult[] {
  const logger = getLogger();
  const results: ParsedPlayerResult[] = [];
  
  // Reset regex lastIndex
  PATTERNS.userResult.lastIndex = 0;
  
  let match;
  while ((match = PATTERNS.userResult.exec(content)) !== null) {
    const discordId = match[1] as Snowflake;
    const guessCount = parseInt(match[2], 10);
    
    // Validate guess count (1-6 for successful games)
    if (guessCount >= 1 && guessCount <= 6) {
      results.push({
        discordId,
        username: '', // Will be resolved later
        guessCount,
      });
      logger.debug(`Parsed result: User ${discordId} with ${guessCount}/6`);
    } else {
      logger.warn(`Invalid guess count: ${guessCount} for user ${discordId}`);
    }
  }
  
  return results;
}

/**
 * Parse a complete Wordle bot message
 */
export function parseWordleMessage(message: Message): DailyResults | null {
  const logger = getLogger();
  const content = message.content;
  
  // Check if message contains ranked results
  if (!containsRankedResults(content)) {
    logger.debug('Message does not contain ranked results');
    return null;
  }
  
  // Extract results
  const results = parseUserResults(content);
  
  if (results.length === 0) {
    logger.warn('No valid results found in message');
    return null;
  }
  
  // Extract Wordle number
  const wordleNumber = extractWordleNumber(content);
  
  // Get game date (use message timestamp or today)
  const gameDate = message.createdAt.toISOString().split('T')[0];
  
  logger.info(`Parsed ${results.length} results for ${gameDate}${wordleNumber ? ` (Wordle #${wordleNumber})` : ''}`);
  
  return {
    gameDate,
    wordleNumber,
    results,
  };
}

/**
 * Resolve usernames for parsed results using the guild
 */
export async function resolveUsernames(
  results: ParsedPlayerResult[],
  message: Message
): Promise<ParsedPlayerResult[]> {
  const logger = getLogger();
  const guild = message.guild;
  
  if (!guild) {
    logger.warn('No guild available for resolving usernames');
    return results;
  }
  
  const resolvedResults: ParsedPlayerResult[] = [];
  
  for (const result of results) {
    try {
      const member = await guild.members.fetch(result.discordId);
      resolvedResults.push({
        ...result,
        username: member.user.username,
      });
    } catch (error) {
      logger.warn(`Could not resolve username for ${result.discordId}, using ID as fallback`);
      resolvedResults.push({
        ...result,
        username: `User-${result.discordId.slice(-4)}`,
      });
    }
  }
  
  return resolvedResults;
}

/**
 * Full parse pipeline: parse message and resolve usernames
 */
export async function parseAndResolveWordleMessage(
  message: Message
): Promise<DailyResults | null> {
  const parsed = parseWordleMessage(message);
  
  if (!parsed) {
    return null;
  }
  
  // Resolve usernames
  parsed.results = await resolveUsernames(parsed.results, message);
  
  return parsed;
}

/**
 * Validate that results haven't already been processed
 * (Prevents duplicate processing if bot restarts)
 */
export function validateFreshResults(
  gameDate: string,
  lastProcessedDate: string | null
): boolean {
  if (!lastProcessedDate) {
    return true;
  }
  return gameDate > lastProcessedDate;
}

export default {
  isWordleMessage,
  containsRankedResults,
  parseWordleMessage,
  parseAndResolveWordleMessage,
  extractWordleNumber,
  parseUserResults,
  resolveUsernames,
};
