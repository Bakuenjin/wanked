/**
 * Reset Command
 *
 * /reset - Clear all Wordle ranked data (admin only)
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js'
import { getDatabase } from '../database/connection'
import { getLogger } from '../utils/logger'

export const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription(
    'Reset all Wordle ranked data (clears all players, games, and history)'
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const logger = getLogger()

  try {
    // Double-check admin permissions
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.reply({
        content: '❌ You must be a server administrator to use this command.',
        ephemeral: true
      })
      return
    }

    await interaction.deferReply({ ephemeral: true })

    const db = getDatabase()

    // Clear all tables in the correct order (respect foreign keys)
    db.exec(`
      DELETE FROM elo_history;
      DELETE FROM games;
      DELETE FROM daily_summaries;
      DELETE FROM players;
    `)

    logger.warn(
      `Database reset by ${interaction.user.username} (${interaction.user.id}) in guild ${interaction.guild?.name}`
    )

    await interaction.editReply({
      content:
        '✅ All Wordle ranked data has been reset.\n\n' +
        '**Cleared:**\n' +
        '• All player records\n' +
        '• All game history\n' +
        '• All ELO history\n' +
        '• All daily summaries\n\n' +
        'The bot will start fresh with new data.'
    })
  } catch (error) {
    logger.error(`Error executing reset command: ${error}`)

    const reply = interaction.deferred
      ? interaction.editReply.bind(interaction)
      : interaction.reply.bind(interaction)

    await reply({
      content:
        '❌ An error occurred while resetting data. Please try again later.'
    })
  }
}
