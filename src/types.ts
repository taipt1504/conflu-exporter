/**
 * Core types for Confluence exporter
 */

export interface ExporterOptions {
  /**
   * Base URL of the Confluence instance
   */
  baseUrl: string

  /**
   * Authentication token or credentials
   */
  auth?: {
    username?: string
    token?: string
  }

  /**
   * Export format
   */
  format?: 'markdown' | 'html' | 'json'

  /**
   * Whether to include attachments
   */
  includeAttachments?: boolean
}

export interface ConfluencePage {
  id: string
  title: string

  /**
   * Content in different formats
   * CRITICAL: Both storage and view formats are required for proper macro extraction
   */
  content: {
    /**
     * Storage format (XHTML with Confluence macros)
     * Used for extracting macro source code (e.g., Mermaid diagrams)
     */
    storage: string

    /**
     * View format (rendered HTML)
     * Used for display and conversion to other formats
     */
    view: string

    /**
     * Export view format (HTML optimized for export)
     * Optional, used primarily for PDF generation
     */
    exportView?: string
  }

  spaceKey: string
  version?: number

  /**
   * Full metadata for bidirectional sync compatibility
   */
  metadata?: {
    labels?: string[]
    createdBy?: string
    createdAt?: Date
    updatedAt?: Date
    url?: string
    parentId?: string
    position?: number
    properties?: Record<string, any>
  }

  /**
   * Legacy fields for backward compatibility
   * @deprecated Use content.view instead
   */
  createdAt?: Date
  /**
   * @deprecated Use content.view instead
   */
  updatedAt?: Date
}

export interface ExportResult {
  success: boolean
  pages: ConfluencePage[]
  errors?: string[]
}
