/**
 * Logger Utility
 *
 * Centralized logging with Winston
 */

import winston from 'winston'

const { combine, timestamp, printf, colorize, errors } = winston.format

/**
 * Custom log format
 */
const logFormat = printf((info) => {
  const ts = info.timestamp as string
  const stack = info.stack as string | undefined
  const message = info.message as string
  return `${ts} [${info.level}]: ${stack || message}`
})

/**
 * Create logger instance
 */
export function createLogger(logLevel: string = 'info'): winston.Logger {
  return winston.createLogger({
    level: logLevel,
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      logFormat
    ),
    transports: [
      new winston.transports.Console({
        format: combine(
          colorize(),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          errors({ stack: true }),
          logFormat
        )
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error'
      }),
      new winston.transports.File({
        filename: 'logs/combined.log'
      })
    ]
  })
}

// Default logger instance
let loggerInstance: winston.Logger | null = null

export function getLogger(): winston.Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger()
  }
  return loggerInstance
}

export function initLogger(logLevel: string): winston.Logger {
  loggerInstance = createLogger(logLevel)
  return loggerInstance
}

export default getLogger
