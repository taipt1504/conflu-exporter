import { ConfluencePage } from '../types.js'
import { HtmlProcessor, ProcessedContent } from './html-processor.js'
import { getLogger } from '../cli/ui/logger.js'

export interface ConvertOptions {
  baseUrl?: string
  outputDir?: string
  includeAttachments?: boolean
  [key: string]: any
}

export interface ConvertResult {
  content: string
  metadata: {
    format: string
    pageId: string
    pageTitle: string
    exportedAt: Date
    [key: string]: any
  }
}

/**
 * Base Converter
 * Abstract base class for all format converters
 */
export abstract class BaseConverter {
  protected logger = getLogger()
  protected htmlProcessor: HtmlProcessor

  constructor() {
    this.htmlProcessor = new HtmlProcessor()
  }

  /**
   * Convert a Confluence page to target format
   * Must be implemented by subclasses
   */
  abstract convert(page: ConfluencePage, options?: ConvertOptions): Promise<ConvertResult>

  /**
   * Get the output file extension
   */
  abstract getFileExtension(): string

  /**
   * Get the format name
   */
  abstract getFormatName(): string

  /**
   * Set Mermaid attachment content before processing
   * Use this to provide .mmd file content for attachment-based Mermaid macros
   */
  protected setMermaidAttachments(attachments: Map<string, string>): void {
    this.htmlProcessor.setMermaidAttachments(attachments)
  }

  /**
   * Clear Mermaid attachment cache
   */
  protected clearMermaidAttachments(): void {
    this.htmlProcessor.clearMermaidAttachments()
  }

  /**
   * Process page content (both storage and view formats)
   */
  protected async processContent(page: ConfluencePage): Promise<ProcessedContent> {
    this.logger.debug(`Processing content for page ${page.id}...`)

    return await this.htmlProcessor.process(page.content.storage, page.content.view)
  }

  /**
   * Generate metadata for the export
   */
  protected generateMetadata(page: ConfluencePage): Record<string, any> {
    return {
      pageId: page.id,
      pageTitle: page.title,
      spaceKey: page.spaceKey,
      version: page.version,
      url: page.metadata?.url,
      exportedAt: new Date().toISOString(),
      labels: page.metadata?.labels || [],
      createdBy: page.metadata?.createdBy,
      createdAt: page.metadata?.createdAt?.toISOString(),
      updatedAt: page.metadata?.updatedAt?.toISOString(),
      parentId: page.metadata?.parentId,
    }
  }

  /**
   * Sanitize filename for filesystem
   */
  protected sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
  }

  /**
   * Validate page has required content
   */
  protected validatePage(page: ConfluencePage): void {
    if (!page.content || !page.content.storage || !page.content.view) {
      throw new Error(
        `Page ${page.id} is missing required content formats (storage or view)`,
      )
    }
  }
}
