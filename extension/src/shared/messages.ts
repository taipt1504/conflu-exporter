/**
 * Message passing types for extension communication
 *
 * Architecture:
 * - Defines all message types for inter-component communication
 * - Type-safe message payloads
 * - Used for popup <-> background <-> options communication
 */

export enum MessageType {
  EXPORT_PAGE = 'EXPORT_PAGE',
  EXPORT_SPACE = 'EXPORT_SPACE',
  EXPORT_BATCH = 'EXPORT_BATCH',
  PROGRESS_UPDATE = 'PROGRESS_UPDATE',
  EXPORT_COMPLETE = 'EXPORT_COMPLETE',
  EXPORT_ERROR = 'EXPORT_ERROR',
  TEST_CONNECTION = 'TEST_CONNECTION',
}

export interface ExportPageMessage {
  type: MessageType.EXPORT_PAGE
  payload: {
    pageId: string
    includeAttachments: boolean
    includeChildren: boolean
  }
}

export interface ExportSpaceMessage {
  type: MessageType.EXPORT_SPACE
  payload: {
    spaceKey: string
    includeAttachments: boolean
  }
}

export interface ExportBatchMessage {
  type: MessageType.EXPORT_BATCH
  payload: {
    pageIds: string[]
    includeAttachments: boolean
  }
}

export interface ProgressUpdateMessage {
  type: MessageType.PROGRESS_UPDATE
  payload: {
    current: number
    total: number
    status: string
    percentage: number
  }
}

export interface ExportCompleteMessage {
  type: MessageType.EXPORT_COMPLETE
  payload: {
    success: true
    filename: string
  }
}

export interface ExportErrorMessage {
  type: MessageType.EXPORT_ERROR
  payload: {
    error: string
    details?: string
  }
}

export interface TestConnectionMessage {
  type: MessageType.TEST_CONNECTION
}

export type ExtensionMessage =
  | ExportPageMessage
  | ExportSpaceMessage
  | ExportBatchMessage
  | ProgressUpdateMessage
  | ExportCompleteMessage
  | ExportErrorMessage
  | TestConnectionMessage

/**
 * Message response type
 */
export interface MessageResponse {
  success: boolean
  error?: string
  data?: any
}
