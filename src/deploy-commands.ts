/**
 * Deploy Slash Commands
 *
 * Run this script to register slash commands with Discord
 * Usage: npm run deploy-commands
 */

import { REST, Routes } from 'discord.js'
import { getConfig } from './config'
import { commands } from './commands'
import { initLogger } from './utils/logger'

async function deployCommands(): Promise<void> {
  const config = getConfig()
  const logger = initLogger(config.logLevel)

  // Build command data
  const commandData = commands.map((cmd) => cmd.data.toJSON())

  logger.info(`Deploying ${commandData.length} commands...`)

  // Create REST client
  const rest = new REST({ version: '10' }).setToken(config.discord.token)

  try {
    // Deploy to specific guild (faster, for development)
    if (config.discord.guildId) {
      logger.info(`Deploying to guild: ${config.discord.guildId}`)

      await rest.put(
        Routes.applicationGuildCommands(
          config.discord.clientId,
          config.discord.guildId
        ),
        { body: commandData }
      )

      logger.info('Successfully deployed guild commands!')
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      logger.info('Deploying globally...')

      await rest.put(Routes.applicationCommands(config.discord.clientId), {
        body: commandData
      })

      logger.info('Successfully deployed global commands!')
      logger.info('Note: Global commands may take up to 1 hour to appear.')
    }

    // Log deployed commands
    logger.info('Deployed commands:')
    commandData.forEach((cmd) => {
      logger.info(`  - /${cmd.name}: ${cmd.description}`)
    })
  } catch (error) {
    logger.error(`Failed to deploy commands: ${error}`)
    process.exit(1)
  }
}

deployCommands()
