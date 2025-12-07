/**
 * Interaction Create Event Handler
 * 
 * Handles slash command interactions
 */

import { Client, Events, Interaction, ChatInputCommandInteraction } from 'discord.js';
import { getLogger } from '../utils/logger';
import { commands } from '../commands';

/**
 * Register interaction handler for slash commands
 */
export function registerInteractionHandler(client: Client): void {
  const logger = getLogger();

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // Only handle chat input commands
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const commandInteraction = interaction as ChatInputCommandInteraction;
    const commandName = commandInteraction.commandName;

    logger.debug(`Received command: ${commandName} from ${interaction.user.username}`);

    // Find the command
    const command = commands.find((cmd) => cmd.data.name === commandName);

    if (!command) {
      logger.warn(`Unknown command: ${commandName}`);
      await commandInteraction.reply({
        content: '❌ Unknown command.',
        ephemeral: true,
      });
      return;
    }

    try {
      await command.execute(commandInteraction);
      logger.info(`Command ${commandName} executed by ${interaction.user.username}`);
    } catch (error) {
      logger.error(`Error executing command ${commandName}: ${error}`);

      const errorMessage = '❌ An error occurred while executing this command.';

      if (commandInteraction.deferred || commandInteraction.replied) {
        await commandInteraction.editReply({ content: errorMessage });
      } else {
        await commandInteraction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  });

  logger.info('Interaction handler registered');
}

export default registerInteractionHandler;
