/**
 * Leaderboard Command
 * 
 * /leaderboard - Display the top players by ELO
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { getLeaderboard, formatLeaderboardForEmbed, getServerStats } from '../services/statsService';
import { getLogger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the Wordle ranked leaderboard')
  .addIntegerOption((option) =>
    option
      .setName('limit')
      .setDescription('Number of players to show (default: 10)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(25)
  )
  .addBooleanOption((option) =>
    option
      .setName('all')
      .setDescription('Include inactive players')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const logger = getLogger();
  
  try {
    await interaction.deferReply();
    
    const limit = interaction.options.getInteger('limit') || 10;
    const includeInactive = interaction.options.getBoolean('all') || false;
    
    // Get leaderboard
    const leaderboard = getLeaderboard(limit, !includeInactive);
    const serverStats = getServerStats();
    
    if (leaderboard.length === 0) {
      await interaction.editReply({
        content: '❌ No players found on the leaderboard yet!',
      });
      return;
    }
    
    // Fetch guild members for display names
    const guild = interaction.guild;
    if (guild) {
      const discordIds = leaderboard.map((entry) => entry.discordId);
      await guild.members.fetch({ user: discordIds }).catch(() => null);
      
      // Update leaderboard entries with guild display names
      for (const entry of leaderboard) {
        const member = guild.members.cache.get(entry.discordId);
        if (member) {
          entry.username = member.displayName;
        }
      }
    }
    
    // Format leaderboard
    const leaderboardText = formatLeaderboardForEmbed(leaderboard);
    
    const embed = new EmbedBuilder()
      .setTitle('🏆 Wordle Ranked Leaderboard')
      .setColor(0xFFD700)
      .setDescription(leaderboardText)
      .addFields([
        {
          name: '📊 Server Stats',
          value: [
            `Total Players: ${serverStats.totalPlayers}`,
            `Active Players: ${serverStats.activePlayers}`,
            `Total Games: ${serverStats.totalGamesPlayed}`,
            `Average ELO: ${serverStats.averageElo}`,
          ].join('\n'),
          inline: false,
        },
      ])
      .setFooter({ text: `Showing ${leaderboard.length} players${includeInactive ? ' (including inactive)' : ''}` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
    logger.info(`Leaderboard displayed by ${interaction.user.username}`);
  } catch (error) {
    logger.error(`Error executing leaderboard command: ${error}`);
    
    const reply = interaction.deferred
      ? interaction.editReply.bind(interaction)
      : interaction.reply.bind(interaction);
    
    await reply({
      content: '❌ An error occurred while fetching the leaderboard. Please try again later.',
    });
  }
}
