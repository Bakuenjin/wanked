/**
 * Ready Event Handler
 *
 * Handles bot ready state
 */

import { Client, Events, ActivityType } from 'discord.js'
import { getLogger } from '../utils/logger'

/**
 * Register ready event handler
 */
export function registerReadyHandler(client: Client): void {
  const logger = getLogger()

  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`🤖 Bot is online as ${readyClient.user.tag}`)
    logger.info(`📊 Connected to ${readyClient.guilds.cache.size} guild(s)`)

    // Set bot presence
    readyClient.user.setPresence({
      activities: [
        {
          name: 'Wordle Rankings',
          type: ActivityType.Watching
        }
      ],
      status: 'online'
    })

    // Log guild info
    readyClient.guilds.cache.forEach((guild) => {
      logger.info(`  - ${guild.name} (${guild.memberCount} members)`)
    })
  })

  logger.info('Ready handler registered')
}

export default registerReadyHandler
