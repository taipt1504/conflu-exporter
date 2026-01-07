import { cosmiconfig } from 'cosmiconfig'
import { config as loadDotenv } from 'dotenv'
import { ConfigSchema, type Config, type PartialConfig } from './config-schema.js'
import { DEFAULT_CONFIG } from './defaults.js'

const MODULE_NAME = 'conflu'

export class ConfigLoader {
  private static instance: ConfigLoader | null = null
  private cachedConfig: Config | null = null

  private constructor() {
    loadDotenv()
  }

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader()
    }
    return ConfigLoader.instance
  }

  async load(cliOptions: PartialConfig = {}): Promise<Config> {
    const explorer = cosmiconfig(MODULE_NAME, {
      searchPlaces: [
        `.${MODULE_NAME}rc`,
        `.${MODULE_NAME}rc.json`,
        `.${MODULE_NAME}rc.yaml`,
        `.${MODULE_NAME}rc.yml`,
        `.${MODULE_NAME}rc.js`,
        `.${MODULE_NAME}rc.cjs`,
        `${MODULE_NAME}.config.js`,
        `${MODULE_NAME}.config.cjs`,
      ],
    })

    const fileConfig = await this.loadFromFile(explorer)

    const envConfig = this.loadFromEnv()

    const mergedConfig = this.mergeConfigs(DEFAULT_CONFIG, fileConfig, envConfig, cliOptions)

    const validatedConfig = ConfigSchema.parse(mergedConfig)

    this.cachedConfig = validatedConfig
    return validatedConfig
  }

  private async loadFromFile(
    explorer: ReturnType<typeof cosmiconfig>,
  ): Promise<PartialConfig> {
    try {
      const result = await explorer.search()
      return result?.config || {}
    } catch (error) {
      return {}
    }
  }

  private loadFromEnv(): PartialConfig {
    const envConfig: PartialConfig = {}

    if (process.env.CONFLUENCE_BASE_URL) {
      envConfig.baseUrl = process.env.CONFLUENCE_BASE_URL
    }

    if (process.env.CONFLUENCE_EMAIL) {
      envConfig.email = process.env.CONFLUENCE_EMAIL
    }

    if (process.env.CONFLUENCE_TOKEN) {
      envConfig.token = process.env.CONFLUENCE_TOKEN
    }

    if (process.env.CONFLUENCE_FORMAT) {
      const format = process.env.CONFLUENCE_FORMAT.toLowerCase()
      if (format === 'markdown' || format === 'pdf' || format === 'docx') {
        envConfig.format = format
      }
    }

    if (process.env.CONFLUENCE_OUTPUT) {
      envConfig.output = process.env.CONFLUENCE_OUTPUT
    }

    if (process.env.CONFLUENCE_INCLUDE_ATTACHMENTS) {
      envConfig.includeAttachments =
        process.env.CONFLUENCE_INCLUDE_ATTACHMENTS.toLowerCase() === 'true'
    }

    if (process.env.CONFLUENCE_INCLUDE_CHILDREN) {
      envConfig.includeChildren =
        process.env.CONFLUENCE_INCLUDE_CHILDREN.toLowerCase() === 'true'
    }

    if (process.env.CONFLUENCE_FLAT) {
      envConfig.flat = process.env.CONFLUENCE_FLAT.toLowerCase() === 'true'
    }

    return envConfig
  }

  private mergeConfigs(...configs: PartialConfig[]): PartialConfig {
    const merged: any = {}

    for (const config of configs) {
      for (const key in config) {
        const value = (config as any)[key]

        if (value === undefined) {
          continue
        }

        if (key === 'api') {
          merged.api = {
            ...merged.api,
            ...value,
          }
        } else if (key === 'conversion') {
          merged.conversion = {
            ...merged.conversion,
            ...value,
            markdown: {
              ...merged.conversion?.markdown,
              ...value.markdown,
            },
            pdf: {
              ...merged.conversion?.pdf,
              ...value.pdf,
            },
            docx: {
              ...merged.conversion?.docx,
              ...value.docx,
            },
          }
        } else {
          merged[key] = value
        }
      }
    }

    return merged
  }

  getCachedConfig(): Config | null {
    return this.cachedConfig
  }

  clearCache(): void {
    this.cachedConfig = null
  }
}

export async function loadConfig(cliOptions: PartialConfig = {}): Promise<Config> {
  const loader = ConfigLoader.getInstance()
  return loader.load(cliOptions)
}

export function getCachedConfig(): Config | null {
  const loader = ConfigLoader.getInstance()
  return loader.getCachedConfig()
}
