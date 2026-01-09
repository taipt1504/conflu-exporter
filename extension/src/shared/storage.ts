/**
 * Chrome storage wrapper for configuration
 * Handles credentials with secure storage
 *
 * Architecture:
 * - Uses chrome.storage.sync for cross-device sync
 * - Credentials encrypted by Chrome's storage layer
 * - Provides type-safe config interface
 */

export interface ExtensionConfig {
  confluenceUrl: string
  email: string
  apiToken: string
  exportSettings: {
    includeAttachments: boolean
    includeChildren: boolean
    format: 'markdown'
    downloadFolder: string // Folder path for exported files (default: 'confluence-exports')
  }
}

export class ConfigStorage {
  /**
   * Get stored configuration
   */
  async getConfig(): Promise<ExtensionConfig | null> {
    const result = await chrome.storage.sync.get('config')
    return result.config || null
  }

  /**
   * Save configuration
   */
  async saveConfig(config: ExtensionConfig): Promise<void> {
    await chrome.storage.sync.set({ config })
  }

  /**
   * Test connection with stored credentials
   */
  async testConnection(): Promise<boolean> {
    const config = await this.getConfig()
    if (!config) return false

    const { BrowserApiClient } = await import(
      '../adapters/BrowserApiClient'
    )
    const client = new BrowserApiClient({
      baseUrl: config.confluenceUrl,
      email: config.email,
      token: config.apiToken,
    })

    return client.testConnection()
  }

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    await chrome.storage.sync.clear()
  }

  /**
   * Update specific export settings
   */
  async updateExportSettings(
    settings: Partial<ExtensionConfig['exportSettings']>
  ): Promise<void> {
    const config = await this.getConfig()
    if (!config) {
      throw new Error('No configuration found')
    }

    config.exportSettings = {
      ...config.exportSettings,
      ...settings,
    }

    await this.saveConfig(config)
  }

  /**
   * Get export settings only
   */
  async getExportSettings(): Promise<
    ExtensionConfig['exportSettings'] | null
  > {
    const config = await this.getConfig()
    return config?.exportSettings || null
  }
}
