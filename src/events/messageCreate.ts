/**
 * Message Create Event Handler
 * 
 * Listens for Wordle bot messages and processes daily results
 */

import { Client, Events, Message, EmbedBuilder } from 'discord.js';
import { getLogger } from '../utils/logger';
import { BotConfig } from '../types';
import {
  isWordleMessage,
  parseAndResolveWordleMessage,
} from '../services/messageParser';
import { processDailyResults } from '../services/eloService';
import { updatePlayerActivity } from '../services/activityService';
import { updateRoles } from '../services/roleService';
import {
  isDailyResultsProcessed,
  saveDailySummary,
} from '../database/gameRepository';
import {
  getHighestEloPlayer,
  getLowestEloPlayer,
} from '../database/playerRepository';

/**
 * Register message create event handler
 */
export function registerMessageHandler(client: Client, config: BotConfig): void {
  const logger = getLogger();

  client.on(Events.MessageCreate, async (message: Message) => {
    // Ignore messages from our bot
    if (message.author.id === client.user?.id) {
      return;
    }

    // Check if message is from Wordle bot
    if (!isWordleMessage(message, config.discord.wordleBotId)) {
      return;
    }

    logger.info(`Received message from Wordle bot in ${message.guild?.name || 'DM'}`);

    try {
      // Parse the message
      const dailyResults = await parseAndResolveWordleMessage(message);

      if (!dailyResults) {
        logger.debug('Message did not contain parseable ranked results');
        return;
      }

      // Check if already processed
      if (isDailyResultsProcessed(dailyResults.gameDate)) {
        logger.warn(`Results for ${dailyResults.gameDate} already processed, skipping`);
        return;
      }

      // Process ELO calculations
      const eloResults = processDailyResults(
        dailyResults.results,
        dailyResults.gameDate,
        config.elo,
        dailyResults.wordleNumber
      );

      if (eloResults.length === 0) {
        logger.warn('No ELO calculations performed');
        return;
      }

      // Update player activity
      updatePlayerActivity(dailyResults.gameDate, config.inactivityThreshold);

      // Update roles
      if (message.guild) {
        await updateRoles(
          message.guild,
          config.discord.highestEloRoleId,
          config.discord.lowestEloRoleId
        );
      }

      // Get updated standings
      const highest = getHighestEloPlayer();
      const lowest = getLowestEloPlayer();

      // Save daily summary
      saveDailySummary(
        dailyResults.gameDate,
        eloResults.length,
        highest?.id ?? null,
        lowest?.id ?? null,
        dailyResults.wordleNumber
      );

      // Reply to the Wordle bot message
      const responseEmbed = buildDailyResponseEmbed(
        dailyResults.gameDate,
        dailyResults.wordleNumber,
        eloResults.length,
        highest ? { username: highest.username, elo: highest.elo } : null,
        lowest ? { username: lowest.username, elo: lowest.elo } : null
      );

      await message.reply({ embeds: [responseEmbed] });

      logger.info(`Successfully processed ${eloResults.length} results for ${dailyResults.gameDate}`);
    } catch (error) {
      logger.error(`Error processing Wordle message: ${error}`);
    }
  });

  logger.info('Message handler registered');
}

/**
 * Build the daily response embed
 */
function buildDailyResponseEmbed(
  gameDate: string,
  wordleNumber: number | undefined,
  participantCount: number,
  highest: { username: string; elo: number } | null,
  lowest: { username: string; elo: number } | null
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🎯 Wordle Ranked Results`)
    .setColor(0x6AA84F)
    .setTimestamp();

  if (wordleNumber) {
    embed.setDescription(`Wordle #${wordleNumber} - ${gameDate}`);
  } else {
    embed.setDescription(`Date: ${gameDate}`);
  }

  const fields = [
    {
      name: '👥 Participants',
      value: `${participantCount} players`,
      inline: true,
    },
  ];

  if (highest) {
    fields.push({
      name: '👑 Highest ELO',
      value: `**${highest.username}** (${highest.elo})`,
      inline: true,
    });
  }

  if (lowest) {
    fields.push({
      name: '📉 Lowest ELO',
      value: `**${lowest.username}** (${lowest.elo})`,
      inline: true,
    });
  }

  embed.addFields(fields);
  embed.setFooter({ text: 'Use /stats to view your ranking' });

  return embed;
}

export default registerMessageHandler;
