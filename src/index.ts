/**
 * Discord Wordle Ranked Bot
 *
 * Main entry point - initializes and starts the bot
 */

import { Client, GatewayIntentBits, Partials } from 'discord.js'
import { getConfig } from './config'
import { initDatabase, closeDatabase } from './database'
import { initLogger, getLogger } from './utils/logger'
import {
  registerReadyHandler,
  registerMessageHandler,
  registerInteractionHandler
} from './events'

/**
 * Main function to start the bot
 */
async function main(): Promise<void> {
  // Load configuration
  const config = getConfig()

  // Initialize logger
  const logger = initLogger(config.logLevel)
  logger.info('Starting Discord Wordle Ranked Bot...')

  // Initialize database
  try {
    initDatabase(config.database.path)
    logger.info('Database initialized')
  } catch (error) {
    logger.error(`Failed to initialize database: ${error}`)
    process.exit(1)
  }

  // Create Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel]
  })

  // Register event handlers
  registerReadyHandler(client)
  registerMessageHandler(client, config)
  registerInteractionHandler(client)

  // Handle graceful shutdown
  process.on('SIGINT', () => gracefulShutdown(client, logger))
  process.on('SIGTERM', () => gracefulShutdown(client, logger))

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error}`)
  })

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`)
  })

  // Login to Discord
  try {
    await client.login(config.discord.token)
  } catch (error) {
    logger.error(`Failed to login: ${error}`)
    process.exit(1)
  }
}

/**
 * Graceful shutdown handler
 */
function gracefulShutdown(
  client: Client,
  logger: ReturnType<typeof getLogger>
): void {
  logger.info('Shutting down gracefully...')

  // Destroy client
  client.destroy()
  logger.info('Discord client disconnected')

  // Close database
  closeDatabase()

  logger.info('Shutdown complete')
  process.exit(0)
}

// Start the bot
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
