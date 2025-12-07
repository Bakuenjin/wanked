/**
 * Message Parser Service
 * 
 * Parses Wordle bot messages to extract game results
 * 
 * Expected message format:
 * **Your group is on an 85 day streak!** 🔥 Here are yesterday's results:
 * 👑 2/6: @brollen <@297641031401209857>
 * 4/6: <@1232894750080761869>
 * 5/6: <@371221596649684993> <@245940683221762048> <@245963142390218753>
 * 6/6: <@245971590179717121>
 * x/6: <@123456789> (failed attempts)
 */

import { Message, Snowflake } from 'discord.js';
import { DailyResults, UnresolvedDailyResults, ParsedPlayerResult, UnresolvedPlayerResult } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Regular expression patterns for parsing Wordle messages
 */
const PATTERNS = {
  // Matches the streak line: **Your group is on an 85 day streak!**
  streakLine: /\*\*Your group is on an? (\d+) day streak!\*\*/i,
  
  // Matches a result row: "👑 2/6:" or "4/6:" or "x/6:"
  // Captures: guessCount (number or 'x')
  resultRow: /^(?:👑\s*)?([1-6x])\/6:\s*(.+)$/im,
  
  // Matches a Discord user mention: <@123456789> or <@!123456789>
  userMention: /<@!?(\d+)>/g,
  
  // Matches a plain username (not a mention): @username
  plainUsername: /@(\w+)/g,
};

/**
 * Parsed result row containing guess count and player identifiers
 */
interface ParsedRow {
  guessCount: number;  // 1-6 for success, 7 for failed (x/6)
  players: Array<{
    discordId?: Snowflake;
    username: string;
  }>;
}

/**
 * Check if a message is from the Wordle bot
 */
export function isWordleMessage(message: Message, wordleBotId: Snowflake): boolean {
  return message.author.id === wordleBotId;
}

/**
 * Check if the message contains Wordle results (has streak line and result rows)
 */
export function containsWordleResults(content: string): boolean {
  return PATTERNS.streakLine.test(content) && /[1-6x]\/6:/i.test(content);
}

/**
 * Extract streak days from message
 */
export function extractStreakDays(content: string): number | undefined {
  const match = content.match(PATTERNS.streakLine);
  if (match) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

/**
 * Parse a single result row to extract players
 * Format: "👑 2/6: @brollen <@297641031401209857>" or "4/6: <@1232894750080761869>"
 */
function parseResultRow(row: string): ParsedRow | null {
  const logger = getLogger();
  
  // Match the row format: optional crown, guess count, colon, then players
  const rowMatch = row.match(/^(?:👑\s*)?([1-6x])\/6:\s*(.+)$/i);
  if (!rowMatch) {
    return null;
  }
  
  const guessStr = rowMatch[1].toLowerCase();
  const guessCount = guessStr === 'x' ? 7 : parseInt(guessStr, 10);
  const playersSection = rowMatch[2];
  
  const players: Array<{ discordId?: Snowflake; username: string }> = [];
  
  // Track positions of mentions to avoid double-parsing
  const mentionPositions: Array<{ start: number; end: number }> = [];
  
  // First, extract all Discord mentions <@123456789> or <@!123456789>
  const mentionRegex = /<@!?(\d+)>/g;
  let mentionMatch;
  while ((mentionMatch = mentionRegex.exec(playersSection)) !== null) {
    const discordId = mentionMatch[1] as Snowflake;
    players.push({
      discordId,
      username: '', // Will be resolved later
    });
    mentionPositions.push({
      start: mentionMatch.index,
      end: mentionMatch.index + mentionMatch[0].length,
    });
  }
  
  // Then, extract plain usernames (@username) that are NOT part of a mention
  const usernameRegex = /@(\w+)/g;
  let usernameMatch;
  while ((usernameMatch = usernameRegex.exec(playersSection)) !== null) {
    const matchStart = usernameMatch.index;
    const matchEnd = matchStart + usernameMatch[0].length;
    
    // Check if this @username is inside a Discord mention
    const isInsideMention = mentionPositions.some(
      pos => matchStart >= pos.start && matchEnd <= pos.end
    );
    
    if (!isInsideMention) {
      // This is a plain username, not a Discord mention
      players.push({
        discordId: undefined,
        username: usernameMatch[1],
      });
      logger.debug(`Found plain username: @${usernameMatch[1]} (needs resolution)`);
    }
  }
  
  if (players.length === 0) {
    logger.warn(`No players found in row: ${row}`);
    return null;
  }
  
  return { guessCount, players };
}

/**
 * Parse all result rows from message content
 * Returns unresolved results that need username/ID resolution
 */
export function parseResultRows(content: string): UnresolvedPlayerResult[] {
  const logger = getLogger();
  const results: UnresolvedPlayerResult[] = [];
  
  // Split by newlines and process each line
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and the streak header line
    if (!trimmedLine || PATTERNS.streakLine.test(trimmedLine)) {
      continue;
    }
    
    // Check if this line looks like a result row
    if (!/[1-6x]\/6:/i.test(trimmedLine)) {
      continue;
    }
    
    const parsedRow = parseResultRow(trimmedLine);
    if (!parsedRow) {
      continue;
    }
    
    // Add all players from this row
    for (const player of parsedRow.players) {
      results.push({
        discordId: player.discordId,
        username: player.username,
        guessCount: parsedRow.guessCount,
      });
    }
  }
  
  logger.debug(`Parsed ${results.length} player results`);
  return results;
}

/**
 * Parse a complete Wordle bot message
 * Returns unresolved results that need username/ID resolution
 */
export function parseWordleMessage(message: Message): UnresolvedDailyResults | null {
  const logger = getLogger();
  const content = message.content;
  
  // Check if message contains Wordle results
  if (!containsWordleResults(content)) {
    logger.debug('Message does not contain Wordle results');
    return null;
  }
  
  // Extract results
  const results = parseResultRows(content);
  
  if (results.length === 0) {
    logger.warn('No valid results found in message');
    return null;
  }
  
  // Extract streak days (informational)
  const streakDays = extractStreakDays(content);
  if (streakDays) {
    logger.debug(`Group streak: ${streakDays} days`);
  }
  
  // Get game date (use message timestamp, but the results are for "yesterday")
  // The message says "Here are yesterday's results", so subtract 1 day
  const messageDate = new Date(message.createdAt);
  messageDate.setDate(messageDate.getDate() - 1);
  const gameDate = messageDate.toISOString().split('T')[0];
  
  logger.info(`Parsed ${results.length} results for ${gameDate}`);
  
  return {
    gameDate,
    wordleNumber: undefined, // This format doesn't include Wordle number
    results,
  };
}

/**
 * Resolve Discord IDs and usernames for parsed results using the guild
 * - For mentions with discordId: fetch the username
 * - For plain usernames: search for matching guild member
 * 
 * Only returns results that could be fully resolved (have both discordId and username)
 */
export async function resolveUsernames(
  results: UnresolvedPlayerResult[],
  message: Message
): Promise<ParsedPlayerResult[]> {
  const logger = getLogger();
  const guild = message.guild;
  
  if (!guild) {
    logger.warn('No guild available for resolving usernames');
    return [];
  }
  
  const resolvedResults: ParsedPlayerResult[] = [];
  
  // Fetch all guild members for username lookup
  let guildMembers;
  try {
    guildMembers = await guild.members.fetch();
  } catch (error) {
    logger.error('Failed to fetch guild members', error);
    return [];
  }
  
  for (const result of results) {
    try {
      if (result.discordId) {
        // We have a Discord ID - fetch the member to get username
        const member = await guild.members.fetch(result.discordId);
        resolvedResults.push({
          discordId: result.discordId,
          username: member.user.username,
          guessCount: result.guessCount,
        });
      } else if (result.username) {
        // We only have a username - search for matching member
        const searchName = result.username.toLowerCase();
        const matchingMember = guildMembers.find(member => 
          member.user.username.toLowerCase() === searchName ||
          member.displayName.toLowerCase() === searchName ||
          member.nickname?.toLowerCase() === searchName
        );
        
        if (matchingMember) {
          resolvedResults.push({
            discordId: matchingMember.id as Snowflake,
            username: matchingMember.user.username,
            guessCount: result.guessCount,
          });
          logger.debug(`Resolved username @${result.username} to ${matchingMember.user.username} (${matchingMember.id})`);
        } else {
          logger.warn(`Could not find guild member matching username: @${result.username}`);
          // Skip this result - cannot be resolved
        }
      } else {
        logger.warn('Result has neither discordId nor username');
      }
    } catch (error) {
      logger.warn(`Could not resolve user ${result.discordId || result.username}`, error);
      // Skip this result - resolution failed
    }
  }
  
  return resolvedResults;
}

/**
 * Full parse pipeline: parse message and resolve usernames
 * Only returns results that could be fully resolved to a Discord ID
 */
export async function parseAndResolveWordleMessage(
  message: Message
): Promise<DailyResults | null> {
  const logger = getLogger();
  const parsed = parseWordleMessage(message);
  
  if (!parsed) {
    return null;
  }
  
  // Resolve usernames and Discord IDs (only returns fully resolved results)
  const resolvedResults = await resolveUsernames(parsed.results, message);
  
  if (resolvedResults.length === 0) {
    logger.warn('No valid results after resolution');
    return null;
  }
  
  if (resolvedResults.length < parsed.results.length) {
    logger.warn(`${parsed.results.length - resolvedResults.length} results could not be resolved`);
  }
  
  return {
    gameDate: parsed.gameDate,
    wordleNumber: parsed.wordleNumber,
    results: resolvedResults,
  };
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

// Legacy exports for backwards compatibility
export const containsRankedResults = containsWordleResults;
export const extractWordleNumber = extractStreakDays; // Repurposed
export const parseUserResults = parseResultRows;

export default {
  isWordleMessage,
  containsWordleResults,
  containsRankedResults, // Legacy alias
  parseWordleMessage,
  parseAndResolveWordleMessage,
  extractStreakDays,
  parseResultRows,
  resolveUsernames,
};
