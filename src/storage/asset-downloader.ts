import { join } from 'path'
import { getLogger } from '../cli/ui/logger.js'
import { AttachmentHandler, type Attachment } from '../core/attachment-handler.js'
import { FileWriter } from './file-writer.js'
import { DirectoryManager } from './directory-manager.js'

export interface DownloadResult {
  filename: string
  path: string
  size: number
  success: boolean
  error?: string
}

export interface AssetDownloaderOptions {
  attachmentHandler: AttachmentHandler
  fileWriter: FileWriter
  directoryManager: DirectoryManager
}

/**
 * Asset Downloader
 * Downloads and saves images and attachments from Confluence
 *
 * Features:
 * - Download original resolution images
 * - Save to organized directory structure
 * - Track download progress
 * - Handle failures gracefully
 */
export class AssetDownloader {
  private logger = getLogger()
  private attachmentHandler: AttachmentHandler
  private fileWriter: FileWriter
  private directoryManager: DirectoryManager

  constructor(options: AssetDownloaderOptions) {
    this.attachmentHandler = options.attachmentHandler
    this.fileWriter = options.fileWriter
    this.directoryManager = options.directoryManager
  }

  /**
   * Download all attachments for a page
   */
  async downloadPageAssets(
    pageId: string,
    spaceKey: string,
    includeAll: boolean = true,
  ): Promise<DownloadResult[]> {
    this.logger.info(`Downloading assets for page ${pageId}...`)

    try {
      // Fetch attachments
      const attachments = await this.attachmentHandler.fetchPageAttachments(pageId)

      if (attachments.length === 0) {
        this.logger.debug(`No attachments found for page ${pageId}`)
        return []
      }

      // Filter to images only if needed
      const assetsToDownload = includeAll
        ? attachments
        : attachments.filter((att) => att.mediaType.startsWith('image/'))

      this.logger.info(
        `Found ${assetsToDownload.length} assets to download for page ${pageId}`,
      )

      // Get assets directory
      const assetsDir = await this.directoryManager.getAssetsDirectory(spaceKey, pageId)

      // Download all assets
      const results: DownloadResult[] = []

      for (const attachment of assetsToDownload) {
        const result = await this.downloadAsset(attachment, assetsDir)
        results.push(result)
      }

      const successCount = results.filter((r) => r.success).length
      this.logger.info(
        `Downloaded ${successCount}/${results.length} assets for page ${pageId}`,
      )

      return results
    } catch (error) {
      this.logger.error(`Failed to download assets for page ${pageId}:`, error)
      return []
    }
  }

  /**
   * Download a single asset
   */
  async downloadAsset(attachment: Attachment, targetDir: string): Promise<DownloadResult> {
    this.logger.debug(`Downloading: ${attachment.filename}`)

    try {
      // Download attachment
      const buffer = await this.attachmentHandler.downloadAttachment(attachment)

      // Write to file
      const filePath = join(targetDir, attachment.filename)
      const writeResult = await this.fileWriter.writeBinary(filePath, buffer)

      return {
        filename: attachment.filename,
        path: writeResult.path,
        size: writeResult.size,
        success: true,
      }
    } catch (error) {
      this.logger.error(`Failed to download ${attachment.filename}:`, error)

      return {
        filename: attachment.filename,
        path: '',
        size: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Download specific images by filename
   */
  async downloadImages(
    pageId: string,
    spaceKey: string,
    filenames: string[],
  ): Promise<DownloadResult[]> {
    this.logger.info(`Downloading ${filenames.length} specific images for page ${pageId}...`)

    const assetsDir = await this.directoryManager.getAssetsDirectory(spaceKey, pageId)
    const results: DownloadResult[] = []

    for (const filename of filenames) {
      try {
        const buffer = await this.attachmentHandler.downloadAttachmentByFilename(pageId, filename)
        const filePath = join(assetsDir, filename)
        const writeResult = await this.fileWriter.writeBinary(filePath, buffer)

        results.push({
          filename,
          path: writeResult.path,
          size: writeResult.size,
          success: true,
        })
      } catch (error) {
        this.logger.error(`Failed to download ${filename}:`, error)

        results.push({
          filename,
          path: '',
          size: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    this.logger.info(`Downloaded ${successCount}/${filenames.length} images`)

    return results
  }

  /**
   * Get relative asset path for use in markdown
   */
  getRelativeAssetPath(pageId: string, filename: string): string {
    return `./assets/${pageId}/${filename}`
  }

  /**
   * Extract image filenames from parsed images
   */
  extractImageFilenames(images: Array<{ filename: string }>): string[] {
    return images.map((img) => img.filename)
  }
}

export function createAssetDownloader(options: AssetDownloaderOptions): AssetDownloader {
  return new AssetDownloader(options)
}
