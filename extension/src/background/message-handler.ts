/**
 * Central message router for extension
 * Routes messages from popup/options to appropriate handlers
 *
 * Architecture:
 * - Type-safe message routing
 * - Delegates to ExportManager for export operations
 * - Delegates to ConfigStorage for configuration
 */
import { MessageType, ExtensionMessage, MessageResponse } from '../shared/messages'
import { ExportManager } from './export-manager'
import { ConfigStorage } from '../shared/storage'

export class MessageHandler {
  private exportManager = new ExportManager()
  private storage = new ConfigStorage()

  async handle(message: ExtensionMessage): Promise<MessageResponse> {
    try {
      switch (message.type) {
        case MessageType.EXPORT_PAGE:
          await this.exportManager.exportPage(message.payload)
          return { success: true }

        case MessageType.EXPORT_SPACE:
          await this.exportManager.exportSpace(message.payload)
          return { success: true }

        case MessageType.EXPORT_BATCH:
          await this.exportManager.exportBatch(message.payload)
          return { success: true }

        case MessageType.TEST_CONNECTION:
          const isConnected = await this.storage.testConnection()
          return { success: isConnected, data: { connected: isConnected } }

        default:
          throw new Error(
            `Unknown message type: ${(message as any).type}`
          )
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }
}
