/**
 * Stats Command
 * 
 * /stats [user] - Display player statistics
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  User,
} from 'discord.js';
import { getPlayerStatsByDiscordId, formatStatsForEmbed } from '../services/statsService';
import { getLogger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View Wordle ranked statistics')
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('The user to view stats for (defaults to yourself)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const logger = getLogger();
  
  try {
    await interaction.deferReply();
    
    // Get target user (default to command executor)
    const targetUser: User = interaction.options.getUser('user') || interaction.user;
    
    // Get player stats
    const stats = getPlayerStatsByDiscordId(targetUser.id);

    // Get guild member for display name and avatar (fallback to global user)
    const guildMember = interaction.guild?.members.cache.get(targetUser.id) 
      ?? await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
    const displayName = guildMember?.displayName ?? targetUser.displayName ?? targetUser.username;
    const avatarUrl = guildMember?.displayAvatarURL() ?? targetUser.displayAvatarURL();
    
    if (!stats) {
      await interaction.editReply({
        content: `❌ No stats found for ${displayName}. They haven't played any Wordle games yet!`,
      });
      return;
    }
    
    // Build embed
    const { fields } = formatStatsForEmbed(stats);
    
    const embed = new EmbedBuilder()
      .setTitle(`📊 Wordle Stats: ${displayName}`)
      .setColor(stats.isActive ? 0x00FF00 : 0xFF6600)
      .setThumbnail(avatarUrl)
      .addFields(fields)
      .setFooter({ text: 'Wordle Ranked Bot' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
    logger.info(`Stats displayed for ${stats.username} by ${interaction.user.username}`);
  } catch (error) {
    logger.error(`Error executing stats command: ${error}`);
    
    const reply = interaction.deferred
      ? interaction.editReply.bind(interaction)
      : interaction.reply.bind(interaction);
    
    await reply({
      content: '❌ An error occurred while fetching stats. Please try again later.',
    });
  }
}
