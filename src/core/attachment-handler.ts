import { ConfluenceApiClient } from './api-client.js'
import { RateLimiter } from './rate-limiter.js'
import { PaginationHandler, PaginatedResponse } from './pagination.js'
import { getLogger } from '../cli/ui/logger.js'
import { AttachmentDownloadError } from '../errors/index.js'

export interface Attachment {
  id: string
  title: string
  filename: string
  mediaType: string
  fileSize: number
  downloadUrl: string
  version?: {
    number: number
    when: string
  }
  metadata?: {
    comment?: string
    mediaTypeDescription?: string
  }
}

export interface AttachmentHandlerOptions {
  apiClient: ConfluenceApiClient
  rateLimiter?: RateLimiter
  paginationHandler?: PaginationHandler
}

interface ConfluenceApiAttachment {
  id: string
  type: string
  title: string
  metadata: {
    mediaType: string
    comment?: string
    mediaTypeDescription?: string
  }
  extensions: {
    mediaType: string
    fileSize: number
    comment?: string
  }
  version?: {
    number: number
    when: string
  }
  _links: {
    download: string
    webui?: string
    self?: string
  }
}

export class AttachmentHandler {
  private apiClient: ConfluenceApiClient
  private rateLimiter: RateLimiter
  private paginationHandler: PaginationHandler

  constructor(options: AttachmentHandlerOptions) {
    this.apiClient = options.apiClient
    this.rateLimiter = options.rateLimiter || new RateLimiter({ concurrency: 3 })
    this.paginationHandler = options.paginationHandler || new PaginationHandler({ limit: 50 })
  }

  /**
   * Fetch all attachments for a page
   */
  async fetchPageAttachments(pageId: string): Promise<Attachment[]> {
    const logger = getLogger()
    logger.info(`Fetching attachments for page ${pageId}...`)

    const fetchPageFn = async (
      start: number,
      limit: number,
    ): Promise<PaginatedResponse<ConfluenceApiAttachment>> => {
      return this.rateLimiter.execute(() =>
        this.apiClient.get<PaginatedResponse<ConfluenceApiAttachment>>(
          `/content/${pageId}/child/attachment`,
          {
            params: {
              start,
              limit,
              expand: 'version,metadata',
            },
          },
        ),
      )
    }

    const apiAttachments = await this.paginationHandler.fetchAll(fetchPageFn)
    const attachments = apiAttachments.map((att) => this.transformAttachment(att))

    logger.debug(`Found ${attachments.length} attachments for page ${pageId}`)

    return attachments
  }

  /**
   * Download an attachment by URL
   * Returns Buffer with the file content
   */
  async downloadAttachment(attachment: Attachment): Promise<Buffer> {
    const logger = getLogger()
    logger.info(`Downloading attachment: ${attachment.filename} (${attachment.fileSize} bytes)`)

    try {
      const buffer = await this.rateLimiter.execute(() =>
        this.apiClient.download(attachment.downloadUrl),
      )

      logger.debug(
        `Downloaded ${attachment.filename}: ${buffer.length} bytes (expected: ${attachment.fileSize})`,
      )

      // Verify file size matches
      if (buffer.length !== attachment.fileSize) {
        logger.warn(
          `File size mismatch for ${attachment.filename}: got ${buffer.length}, expected ${attachment.fileSize}`,
        )
      }

      return buffer
    } catch (error) {
      throw new AttachmentDownloadError(
        `Failed to download ${attachment.filename}`,
        attachment.downloadUrl,
        error,
      )
    }
  }

  /**
   * Download all attachments for a page
   * Returns a map of filename to Buffer
   */
  async downloadPageAttachments(pageId: string): Promise<Map<string, Buffer>> {
    const attachments = await this.fetchPageAttachments(pageId)
    const downloads = new Map<string, Buffer>()

    const logger = getLogger()
    logger.info(`Downloading ${attachments.length} attachments for page ${pageId}...`)

    for (const attachment of attachments) {
      try {
        const buffer = await this.downloadAttachment(attachment)
        downloads.set(attachment.filename, buffer)
      } catch (error) {
        logger.error(`Failed to download ${attachment.filename}:`, error)
        // Continue with other attachments even if one fails
      }
    }

    logger.info(`Downloaded ${downloads.size}/${attachments.length} attachments successfully`)
    return downloads
  }

  /**
   * Find images in page attachments
   * Returns only attachments with image media types
   */
  async fetchPageImages(pageId: string): Promise<Attachment[]> {
    const attachments = await this.fetchPageAttachments(pageId)
    return attachments.filter((att) => att.mediaType.startsWith('image/'))
  }

  /**
   * Download a specific attachment by filename
   */
  async downloadAttachmentByFilename(pageId: string, filename: string): Promise<Buffer> {
    const attachments = await this.fetchPageAttachments(pageId)
    const attachment = attachments.find((att) => att.filename === filename)

    if (!attachment) {
      throw new AttachmentDownloadError(
        `Attachment not found: ${filename}`,
        `/content/${pageId}/child/attachment`,
        { pageId, filename, availableFiles: attachments.map((a) => a.filename) },
      )
    }

    return this.downloadAttachment(attachment)
  }

  /**
   * Download text attachment and return as string
   * Useful for .mmd, .txt, .json files etc.
   */
  async downloadTextAttachment(pageId: string, filename: string): Promise<string> {
    const buffer = await this.downloadAttachmentByFilename(pageId, filename)
    return buffer.toString('utf-8')
  }

  /**
   * Download all Mermaid diagram files for a page
   * Returns a map of filename to content
   *
   * Supports multiple storage formats:
   * 1. .mmd or .mermaid files (standard format)
   * 2. text/plain attachments with diagram name (Mermaid for Confluence plugin)
   */
  async downloadMermaidAttachments(pageId: string): Promise<Map<string, string>> {
    const attachments = await this.fetchPageAttachments(pageId)

    // Find mermaid files by extension OR by text/plain MIME type
    const mermaidFiles = attachments.filter(
      (att) =>
        att.filename.endsWith('.mmd') ||
        att.filename.endsWith('.mermaid') ||
        (att.mediaType === 'text/plain' && !att.filename.includes('.'))
    )

    const logger = getLogger()
    if (mermaidFiles.length === 0) {
      logger.debug(`No Mermaid diagram attachments found for page ${pageId}`)
      return new Map()
    }

    logger.info(
      `Downloading ${mermaidFiles.length} Mermaid diagram files for page ${pageId}...`,
    )

    const mermaidContent = new Map<string, string>()

    for (const attachment of mermaidFiles) {
      try {
        const buffer = await this.downloadAttachment(attachment)
        const content = buffer.toString('utf-8')
        mermaidContent.set(attachment.filename, content)
        logger.debug(`Downloaded mermaid file: ${attachment.filename} (${content.length} chars)`)
      } catch (error) {
        logger.error(`Failed to download ${attachment.filename}:`, error)
      }
    }

    return mermaidContent
  }

  /**
   * Transform Confluence API attachment to our Attachment format
   */
  private transformAttachment(apiAttachment: ConfluenceApiAttachment): Attachment {
    const logger = getLogger()
    const baseUrl = this.apiClient.getBaseUrl()

    // The _links.download from Confluence API is a relative path
    // It looks like: /download/attachments/149323923/file.mmd?version=1&...
    // We need to construct the full URL by prepending baseUrl + /wiki
    let downloadUrl = apiAttachment._links.download

    if (!downloadUrl.startsWith('http')) {
      // Confluence Cloud download paths need /wiki prefix
      downloadUrl = `${baseUrl}/wiki${downloadUrl}`
    }

    logger.debug(`Attachment: ${apiAttachment.title} (id: ${apiAttachment.id})`)
    logger.debug(`  - Original _links.download: ${apiAttachment._links.download}`)
    logger.debug(`  - Constructed download URL: ${downloadUrl}`)

    return {
      id: apiAttachment.id,
      title: apiAttachment.title,
      filename: apiAttachment.title,
      mediaType: apiAttachment.extensions.mediaType || apiAttachment.metadata.mediaType,
      fileSize: apiAttachment.extensions.fileSize,
      downloadUrl,
      version: apiAttachment.version
        ? {
            number: apiAttachment.version.number,
            when: apiAttachment.version.when,
          }
        : undefined,
      metadata: {
        comment: apiAttachment.extensions.comment || apiAttachment.metadata.comment,
        mediaTypeDescription: apiAttachment.metadata.mediaTypeDescription,
      },
    }
  }

  /**
   * Get rate limiter instance
   */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter
  }
}

export function createAttachmentHandler(options: AttachmentHandlerOptions): AttachmentHandler {
  return new AttachmentHandler(options)
}
