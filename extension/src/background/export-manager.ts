/**
 * Export manager orchestrates export operations
 * 
 * NEW ARCHITECTURE (v2):
 * - Uses ExportBundler for ZIP exports (default)
 * - Uses UnifiedMacroProcessor for proper macro handling
 * - Downloads all assets with markdown in single ZIP
 * 
 * Why ZIP by default:
 * - Confluence pages typically have many attachments
 * - Ensures complete export with all images
 * - Single download for everything
 */
import { BrowserApiClient } from '../adapters/BrowserApiClient'
import { ConfluencePageData } from '../adapters/BrowserMarkdownConverter'
import { ConfigStorage } from '../shared/storage'
import { MessageType } from '../shared/messages'
import { ExportBundler } from '../core/ExportBundler'

export interface ExportPageOptions {
  pageId: string
  includeAttachments: boolean
  includeChildren: boolean
}

export interface ExportSpaceOptions {
  spaceKey: string
  includeAttachments: boolean
}

export interface ExportBatchOptions {
  pageIds: string[]
  includeAttachments: boolean
}

export class ExportManager {
  private storage = new ConfigStorage()

  /**
   * Export single page as ZIP bundle (default mode)
   * Includes markdown + all assets in one ZIP file
   */
  async exportPage(options: ExportPageOptions): Promise<void> {
    try {
      // Step 1: Get configuration
      this.sendProgress(0, 6, 'Loading configuration...')
      const config = await this.storage.getConfig()

      if (!config) {
        throw new Error('Confluence not configured. Please set up credentials in options.')
      }

      // Step 2: Ensure offscreen document (needed for DOM operations)
      this.sendProgress(1, 6, 'Initializing...')
      await this.ensureOffscreenDocument()

      // Step 3: Initialize API client and bundler
      this.sendProgress(2, 6, 'Connecting to Confluence...')
      const apiClient = new BrowserApiClient({
        baseUrl: config.confluenceUrl,
        email: config.email,
        token: config.apiToken,
      })

      const bundler = new ExportBundler(apiClient)

      // Step 4: Create ZIP bundle with progress updates
      const progressCallback = (message: string) => {
        console.log(`[ExportManager] ${message}`)
        this.sendProgress(3, 6, message)
      }

      this.sendProgress(3, 6, 'Creating export bundle...')
      const zipBlob = await bundler.createZipBlob(options.pageId, progressCallback)

      // Step 5: Download ZIP file
      this.sendProgress(5, 6, 'Downloading ZIP file...')
      const filename = await this.downloadZipBlob(zipBlob, options.pageId)

      // Complete
      this.sendProgress(6, 6, 'Export complete!')
      this.sendComplete(filename)

    } catch (error: any) {
      console.error('[ExportManager] Export failed:', error)
      this.sendError(error.message, error.stack)
    }
  }

  /**
   * Download ZIP blob using chrome.downloads API
   * CRITICAL: Service workers don't have URL.createObjectURL
   * Must use offscreen document for blob URL creation
   */
  private async downloadZipBlob(blob: Blob, pageId: string): Promise<string> {
    // Convert blob to ArrayBuffer, then to regular array for serialization
    // CRITICAL: ArrayBuffer cannot be serialized via chrome.runtime.sendMessage
    const arrayBuffer = await blob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const dataArray = Array.from(uint8Array)
    
    console.log(`[ExportManager] Sending ZIP data: ${dataArray.length} bytes`)
    
    // Create blob URL via offscreen document (has DOM access)
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_BLOB_URL',
      payload: {
        data: dataArray,
        mimeType: 'application/zip',
      }
    })

    if (!response?.success || !response.blobUrl) {
      throw new Error(`Failed to create blob URL: ${response?.error || 'Unknown error'}`)
    }

    const blobUrl = response.blobUrl
    
    // Get download folder
    const config = await this.storage.getConfig()
    const folder = config?.exportSettings.downloadFolder || 'confluence-exports'
    const sanitizedFolder = this.sanitizeFolderPath(folder)
    
    // Use page ID as filename base
    const filename = `confluence-export-${pageId}.zip`
    const fullPath = `${sanitizedFolder}/${filename}`

    try {
      await chrome.downloads.download({
        url: blobUrl,
        filename: fullPath,
        saveAs: false,
        conflictAction: 'uniquify'
      })

      console.log(`[ExportManager] ZIP downloaded: ${fullPath}`)
      return filename
    } finally {
      // Request offscreen to revoke URL
      chrome.runtime.sendMessage({
        type: 'REVOKE_BLOB_URL',
        payload: { blobUrl }
      }).catch(() => {}) // Ignore errors on cleanup
    }
  }

  /**
   * Export entire space
   */
  async exportSpace(options: ExportSpaceOptions): Promise<void> {
    try {
      this.sendProgress(0, 1, 'Loading configuration...')
      const config = await this.storage.getConfig()

      if (!config) {
        throw new Error(
          'Confluence not configured. Please set up credentials in options.'
        )
      }

      const apiClient = new BrowserApiClient({
        baseUrl: config.confluenceUrl,
        email: config.email,
        token: config.apiToken,
      })

      // Fetch all pages in space
      this.sendProgress(0.1, 1, 'Fetching space pages...')
      const pageIds = await this.fetchSpacePages(apiClient, options.spaceKey)

      // Export each page
      for (let i = 0; i < pageIds.length; i++) {
        const progress = 0.1 + (i / pageIds.length) * 0.9
        this.sendProgress(
          progress,
          1,
          `Exporting page ${i + 1}/${pageIds.length}...`
        )

        await this.exportPage({
          pageId: pageIds[i],
          includeAttachments: options.includeAttachments,
          includeChildren: false,
        })
      }

      this.sendProgress(1, 1, 'Space export complete!')
      this.sendComplete(`${pageIds.length} pages exported`)
    } catch (error: any) {
      this.sendError(error.message, error.stack)
    }
  }

  /**
   * Export batch of pages
   */
  async exportBatch(options: ExportBatchOptions): Promise<void> {
    try {
      const total = options.pageIds.length

      for (let i = 0; i < total; i++) {
        this.sendProgress(
          i,
          total,
          `Exporting page ${i + 1}/${total}...`
        )

        await this.exportPage({
          pageId: options.pageIds[i],
          includeAttachments: options.includeAttachments,
          includeChildren: false,
        })
      }

      this.sendProgress(total, total, 'Batch export complete!')
      this.sendComplete(`${total} pages exported`)
    } catch (error: any) {
      this.sendError(error.message, error.stack)
    }
  }

  /**
   * Fetch page with both storage and view formats
   */
  private async fetchPage(
    client: BrowserApiClient,
    pageId: string
  ): Promise<ConfluencePageData> {
    const expand = [
      'body.storage',
      'body.view',
      'body.export_view',
      'version',
      'metadata.labels',
      'metadata.properties',
      'space',
      'ancestors',
    ].join(',')

    const data = await client.get<any>(`/content/${pageId}`, { expand })

    return {
      id: data.id,
      title: data.title,
      content: {
        storage: data.body?.storage?.value || '',
        view: data.body?.view?.value || '',
        exportView: data.body?.export_view?.value,
      },
      spaceKey: data.space?.key,
      version: data.version?.number,
      metadata: {
        labels: data.metadata?.labels?.results?.map((l: any) => l.name),
        createdBy: data.version?.by?.displayName,
        createdAt: data.version?.when
          ? new Date(data.version.when)
          : undefined,
        updatedAt: data.version?.when
          ? new Date(data.version.when)
          : undefined,
        url: data._links?.webui,
        parentId: data.ancestors?.[data.ancestors.length - 1]?.id,
      },
    }
  }

  /**
   * Fetch all page IDs in a space
   */
  private async fetchSpacePages(
    client: BrowserApiClient,
    spaceKey: string
  ): Promise<string[]> {
    const pages: string[] = []
    let start = 0
    const limit = 50

    while (true) {
      const data = await client.get<any>(
        `/space/${spaceKey}/content/page`,
        { start, limit }
      )

      const results = data.results || []
      pages.push(...results.map((p: any) => p.id))

      if (results.length < limit) break
      start += limit
    }

    return pages
  }

  /**
   * Fetch Mermaid diagram attachments for a page
   * CRITICAL: Mermaid for Confluence plugin stores diagrams as text/plain attachments
   * These must be fetched BEFORE conversion to extract diagram source code
   */
  private async fetchMermaidAttachments(
    client: BrowserApiClient,
    pageId: string
  ): Promise<Map<string, string>> {
    const mermaidContent = new Map<string, string>()

    try {
      // Fetch all attachments for the page
      const attachmentsData = await client.get<any>(
        `/content/${pageId}/child/attachment`,
        { expand: 'version,metadata', limit: 100 }
      )

      const attachments = attachmentsData.results || []
      console.log(`[ExportManager] Found ${attachments.length} total attachments for page ${pageId}`)

      // Filter for Mermaid files:
      // 1. .mmd or .mermaid extensions (standard format)
      // 2. text/plain without extension (Mermaid for Confluence plugin)
      const mermaidFiles = attachments.filter((att: any) => {
        const filename = att.title || ''
        const mediaType = att.extensions?.mediaType || att.metadata?.mediaType || ''
        
        return (
          filename.endsWith('.mmd') ||
          filename.endsWith('.mermaid') ||
          (mediaType === 'text/plain' && !filename.includes('.'))
        )
      })

      console.log(`[ExportManager] Found ${mermaidFiles.length} Mermaid diagram files`)

      // Download each Mermaid file content
      for (const attachment of mermaidFiles) {
        try {
          const filename = attachment.title
          const downloadPath = attachment._links?.download
          
          if (!downloadPath) {
            console.warn(`[ExportManager] No download path for attachment: ${filename}`)
            continue
          }

          // Construct full download URL
          const baseUrl = client['config'].baseUrl
          const downloadUrl = downloadPath.startsWith('http')
            ? downloadPath
            : `${baseUrl}/wiki${downloadPath}`

          console.log(`[ExportManager] Downloading Mermaid file: ${filename}`)

          // Fetch the content
          const content = await client.getText(downloadUrl)
          
          if (content) {
            mermaidContent.set(filename, content)
            console.log(`[ExportManager] Downloaded ${filename}: ${content.length} chars`)
          }
        } catch (error) {
          console.error(`[ExportManager] Failed to download ${attachment.title}:`, error)
        }
      }
    } catch (error) {
      console.error('[ExportManager] Failed to fetch attachments:', error)
    }

    return mermaidContent
  }

  /**
   * Convert page to markdown via offscreen document
   * Service workers don't have DOM access, so we delegate to offscreen document
   */
  private async convertToMarkdown(
    page: ConfluencePageData,
    mermaidAttachments: Map<string, string> = new Map()
  ): Promise<string> {
    // Ensure offscreen document exists
    await this.ensureOffscreenDocument()

    // Convert Map to serializable object for message passing
    const mermaidContent: Record<string, string> = {}
    mermaidAttachments.forEach((value, key) => {
      mermaidContent[key] = value
    })

    // Send conversion request to offscreen document
    const response = await chrome.runtime.sendMessage({
      type: 'CONVERT_TO_MARKDOWN',
      payload: {
        page,
        mermaidAttachments: mermaidContent
      }
    })

    if (!response.success) {
      throw new Error(`Conversion failed: ${response.error}`)
    }

    return response.result.content
  }

  /**
   * Ensure offscreen document is created for DOM operations
   */
  private async ensureOffscreenDocument(): Promise<void> {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType]
    })

    if (existingContexts.length > 0) {
      return // Already exists
    }

    // Create offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER' as chrome.offscreen.Reason],
      justification: 'Convert HTML to Markdown using Turndown library which requires DOM access'
    })

    console.log('[ExportManager] Offscreen document created')
  }

  /**
   * Download file via offscreen document (has DOM access for URL.createObjectURL)
   * Architecture:
   * 1. Offscreen creates blob URL (needs DOM)
   * 2. Service worker downloads using chrome.downloads API
   */
  private async downloadFile(
    filename: string,
    content: string | ArrayBuffer,
    type: 'markdown' | 'attachment'
  ): Promise<void> {
    // Step 1: Ask offscreen to create blob URL
    const response = await chrome.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      payload: { filename, content, type }
    })

    if (!response.success) {
      throw new Error(`Blob creation failed: ${response.error}`)
    }

    // Step 2: Download using chrome.downloads API (only available in service worker)
    const downloadFolder = await this.getDownloadFolder()
    const sanitizedFolder = this.sanitizeFolderPath(downloadFolder)
    const sanitizedFilename = this.sanitizeFilename(filename)
    const fullPath = `${sanitizedFolder}/${sanitizedFilename}`

    console.log(`[ExportManager] Downloading to: ${fullPath}`)

    try {
      await chrome.downloads.download({
        url: response.blobUrl,
        filename: fullPath,
        saveAs: false,
        conflictAction: 'uniquify'
      })

      console.log(`[ExportManager] Downloaded successfully: ${sanitizedFilename}`)
    } catch (error: any) {
      console.error(`[ExportManager] Download failed:`, error)
      console.error(`  File: ${sanitizedFilename}`)
      console.error(`  Path: ${fullPath}`)
      throw new Error(`Download failed: ${error.message}`)
    }
  }

  /**
   * Get current download folder from config
   */
  private async getDownloadFolder(): Promise<string> {
    const config = await this.storage.getConfig()
    return config?.exportSettings.downloadFolder || 'confluence-exports'
  }

  /**
   * Download attachments for a page
   */
  private async downloadAttachments(
    client: BrowserApiClient,
    pageId: string
  ): Promise<void> {
    try {
      const attachments = await client.get<any>(
        `/content/${pageId}/child/attachment`
      )

      const results = attachments.results || []

      for (const attachment of results) {
        const downloadUrl = attachment._links.download
        const filename = attachment.title

        try {
          const buffer = await client.download(downloadUrl)
          await this.downloadFile(filename, buffer, 'attachment')
        } catch (error) {
          console.error(`Failed to download attachment: ${filename}`, error)
          // Continue with other attachments
        }
      }
    } catch (error) {
      console.error('Failed to fetch attachments:', error)
      // Don't fail the entire export if attachments fail
    }
  }

  /**
   * Send progress update to popup
   */
  private sendProgress(
    current: number,
    total: number,
    status: string
  ): void {
    chrome.runtime.sendMessage({
      type: MessageType.PROGRESS_UPDATE,
      payload: {
        current,
        total,
        status,
        percentage: Math.round((current / total) * 100),
      },
    })
  }

  /**
   * Send completion message
   */
  private sendComplete(filename: string): void {
    chrome.runtime.sendMessage({
      type: MessageType.EXPORT_COMPLETE,
      payload: { success: true, filename },
    })
  }

  /**
   * Send error message
   */
  private sendError(error: string, details?: string): void {
    chrome.runtime.sendMessage({
      type: MessageType.EXPORT_ERROR,
      payload: { error, details },
    })
  }

  /**
   * Sanitize filename for Chrome downloads
   * Chrome has strict rules: no special chars, no leading/trailing spaces or dots
   */
  private sanitizeFilename(filename: string): string {
    return filename
      // Replace invalid characters with underscore
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      // Replace multiple spaces with single underscore
      .replace(/\s+/g, '_')
      // Remove leading/trailing underscores and dots
      .replace(/^[_\.]+|[_\.]+$/g, '')
      // Limit length (Chrome max is 255, keep safe margin)
      .substring(0, 200)
      // Ensure not empty
      || 'untitled'
  }

  /**
   * Sanitize folder path for Chrome downloads
   * Remove leading/trailing slashes and invalid characters
   */
  private sanitizeFolderPath(folder: string): string {
    return folder
      // Replace invalid characters
      .replace(/[<>:"|?*\x00-\x1F]/g, '_')
      // Replace backslashes with forward slashes
      .replace(/\\/g, '/')
      // Remove leading/trailing slashes
      .replace(/^\/+|\/+$/g, '')
      // Remove double slashes
      .replace(/\/+/g, '/')
      // Limit length
      .substring(0, 100)
      // Ensure not empty
      || 'confluence-exports'
  }
}
