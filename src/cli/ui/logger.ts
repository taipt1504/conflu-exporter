import pino from 'pino'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LoggerOptions {
  level?: LogLevel
  verbose?: boolean
  quiet?: boolean
  pretty?: boolean
}

let loggerInstance: pino.Logger | null = null

export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const { level = 'info', verbose = false, quiet = false, pretty: enablePretty = true } = options

  let finalLevel: LogLevel = level

  if (quiet) {
    finalLevel = 'error'
  } else if (verbose) {
    finalLevel = 'debug'
  }

  const transport = enablePretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
        },
      }
    : undefined

  const logger = pino({
    level: finalLevel,
    ...(transport && { transport }),
  })

  loggerInstance = logger
  return logger
}

export function getLogger(): pino.Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger()
  }
  return loggerInstance
}

export function setLogLevel(level: LogLevel): void {
  const logger = getLogger()
  logger.level = level
}
