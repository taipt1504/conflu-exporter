import type { ExporterOptions, ConfluencePage, ExportResult } from './types.js'
import { createApiClient, createContentFetcher, createAttachmentHandler } from './core/index.js'
import type { ConfluenceApiClient } from './core/index.js'
import type { ContentFetcher } from './core/index.js'
import type { AttachmentHandler } from './core/index.js'

/**
 * Main Confluence exporter class
 * Now uses real API integration with storage + view format support
 */
export class ConfluenceExporter {
  private options: Required<ExporterOptions>
  private apiClient: ConfluenceApiClient
  private contentFetcher: ContentFetcher
  private attachmentHandler: AttachmentHandler

  constructor(options: ExporterOptions) {
    this.options = {
      baseUrl: options.baseUrl,
      auth: options.auth || {},
      format: options.format || 'markdown',
      includeAttachments: options.includeAttachments ?? false,
    }

    this.validateOptions()

    // Initialize API client
    this.apiClient = createApiClient({
      baseUrl: this.options.baseUrl,
      email: this.options.auth.username,
      token: this.options.auth.token,
      timeout: 30000,
      retries: 3,
    })

    // Initialize content fetcher
    this.contentFetcher = createContentFetcher({
      apiClient: this.apiClient,
    })

    // Initialize attachment handler
    this.attachmentHandler = createAttachmentHandler({
      apiClient: this.apiClient,
    })
  }

  private validateOptions(): void {
    if (!this.options.baseUrl) {
      throw new Error('baseUrl is required')
    }

    try {
      new URL(this.options.baseUrl)
    } catch {
      throw new Error('baseUrl must be a valid URL')
    }
  }

  /**
   * Export pages from a Confluence space
   * @param spaceKey - The space key to export from
   * @returns Export result with pages and status
   */
  async exportSpace(spaceKey: string): Promise<ExportResult> {
    if (!spaceKey) {
      throw new Error('spaceKey is required')
    }

    try {
      const pages = await this.contentFetcher.fetchSpace(spaceKey)

      return {
        success: true,
        pages,
      }
    } catch (error) {
      return {
        success: false,
        pages: [],
        errors: [error instanceof Error ? error.message : String(error)],
      }
    }
  }

  /**
   * Export a single page by ID
   * @param pageId - The page ID to export
   * @returns The exported page
   */
  async exportPage(pageId: string): Promise<ConfluencePage> {
    if (!pageId) {
      throw new Error('pageId is required')
    }

    return this.contentFetcher.fetchPage(pageId)
  }

  /**
   * Export page with all children (recursive)
   * @param pageId - The root page ID
   * @returns All pages in the hierarchy
   */
  async exportPageHierarchy(pageId: string): Promise<ExportResult> {
    if (!pageId) {
      throw new Error('pageId is required')
    }

    try {
      const pages = await this.contentFetcher.fetchPageHierarchy(pageId)

      return {
        success: true,
        pages,
      }
    } catch (error) {
      return {
        success: false,
        pages: [],
        errors: [error instanceof Error ? error.message : String(error)],
      }
    }
  }

  /**
   * Search pages using CQL
   * @param cql - Confluence Query Language string
   * @returns Search results
   */
  async searchPages(cql: string): Promise<ExportResult> {
    if (!cql) {
      throw new Error('cql query is required')
    }

    try {
      const pages = await this.contentFetcher.searchPages(cql)

      return {
        success: true,
        pages,
      }
    } catch (error) {
      return {
        success: false,
        pages: [],
        errors: [error instanceof Error ? error.message : String(error)],
      }
    }
  }

  /**
   * Get attachments for a page
   * @param pageId - The page ID
   * @returns List of attachments
   */
  async getPageAttachments(pageId: string) {
    if (!pageId) {
      throw new Error('pageId is required')
    }

    return this.attachmentHandler.fetchPageAttachments(pageId)
  }

  /**
   * Download all attachments for a page
   * @param pageId - The page ID
   * @returns Map of filename to Buffer
   */
  async downloadPageAttachments(pageId: string): Promise<Map<string, Buffer>> {
    if (!pageId) {
      throw new Error('pageId is required')
    }

    return this.attachmentHandler.downloadPageAttachments(pageId)
  }

  /**
   * Test API connection
   * @returns true if connection is successful
   */
  async testConnection(): Promise<boolean> {
    return this.apiClient.testConnection()
  }

  /**
   * Get the configured export format
   */
  getFormat(): string {
    return this.options.format
  }

  /**
   * Get API client instance
   */
  getApiClient(): ConfluenceApiClient {
    return this.apiClient
  }

  /**
   * Get content fetcher instance
   */
  getContentFetcher(): ContentFetcher {
    return this.contentFetcher
  }

  /**
   * Get attachment handler instance
   */
  getAttachmentHandler(): AttachmentHandler {
    return this.attachmentHandler
  }
}
