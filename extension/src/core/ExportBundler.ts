/**
 * Export Bundler - Creates ZIP bundles with markdown and assets
 * 
 * This is the PRIMARY export method for the extension.
 * 
 * ARCHITECTURE:
 * - Service Worker: Fetch data, download assets, create ZIP
 * - Offscreen Document: HTML to Markdown conversion (needs DOM)
 * 
 * Why ZIP by default:
 * 1. Confluence pages typically have many attachments
 * 2. Ensures all assets are included
 * 3. Maintains relative links (./assets/filename.png)
 * 4. Single download for complete export
 */

import JSZip from 'jszip'
import { BrowserApiClient } from '../adapters/BrowserApiClient'

export interface ConfluencePageData {
  id: string
  title: string
  content: {
    storage: string
    view: string
    exportView?: string
  }
  spaceKey?: string
  version?: number
  metadata?: {
    labels?: string[]
    createdBy?: string
    createdAt?: string | Date
    updatedAt?: string | Date
    url?: string
    parentId?: string
  }
}

export interface ExportBundle {
  markdown: string
  assets: Map<string, ArrayBuffer>
  metadata: ExportMetadata
}

export interface ExportMetadata {
  pageId: string
  pageTitle: string
  spaceKey: string
  exportedAt: string
  assetCount: number
  format: 'markdown'
  macroStats: {
    mermaid: number
    code: number
    diagrams: number
    panels: number
  }
}

export interface Attachment {
  id: string
  filename: string
  mediaType: string
  fileSize: number
  downloadUrl: string
}

/**
 * ExportBundler - Creates complete export packages
 * 
 * IMPORTANT: This runs in service worker context (no DOM).
 * ALL macro processing is delegated to offscreen document (has DOM).
 * 
 * Service worker handles:
 * - API calls to Confluence
 * - Downloading attachments
 * - Creating ZIP archive
 * 
 * Offscreen handles:
 * - Macro parsing (needs DOMParser)
 * - HTML processing
 * - Markdown conversion
 */
export class ExportBundler {
  private apiClient: BrowserApiClient

  constructor(apiClient: BrowserApiClient) {
    this.apiClient = apiClient
  }

  /**
   * Create complete export bundle for a page
   */
  async createBundle(pageId: string, onProgress?: (message: string) => void): Promise<ExportBundle> {
    const progress = onProgress || (() => {})

    // Step 1: Fetch page and attachments in parallel
    progress('Fetching page content...')
    const [page, attachments] = await Promise.all([
      this.fetchPage(pageId),
      this.fetchAttachments(pageId),
    ])

    console.log(`[ExportBundler] Page: "${page.title}", ${attachments.length} attachments`)

    // Step 2: Download and cache Mermaid attachments
    const mermaidAttachments = this.filterMermaidAttachments(attachments)
    let mermaidContent = new Map<string, string>()
    
    if (mermaidAttachments.length > 0) {
      progress('Downloading diagram sources...')
      mermaidContent = await this.downloadTextAttachments(mermaidAttachments)
      console.log(`[ExportBundler] Downloaded ${mermaidContent.size} Mermaid attachments`)
    }

    // Step 3: Convert to markdown via OFFSCREEN document
    // CRITICAL: Send RAW content - let offscreen handle macro processing with DOM
    progress('Converting to Markdown...')
    const markdown = await this.convertViaOffscreen(page, mermaidContent)

    // Step 4: Download all image/binary attachments
    progress('Downloading assets...')
    const imageAttachments = this.filterImageAttachments(attachments)
    const assets = await this.downloadBinaryAttachments(imageAttachments)

    // Step 5: Update asset links in markdown
    const finalMarkdown = this.updateAssetLinks(markdown, assets)

    // Count macros from storage for metadata
    const mermaidCount = (page.content.storage.match(/<ac:structured-macro[^>]*ac:name=['"]mermaid/gi) || []).length
    const codeCount = (page.content.storage.match(/<ac:structured-macro[^>]*ac:name=['"]code/gi) || []).length

    return {
      markdown: finalMarkdown,
      assets,
      metadata: {
        pageId: page.id,
        pageTitle: page.title,
        spaceKey: page.spaceKey || '',
        exportedAt: new Date().toISOString(),
        assetCount: assets.size,
        format: 'markdown',
        macroStats: {
          mermaid: mermaidCount,
          code: codeCount,
          diagrams: 0,
          panels: 0,
        },
      },
    }
  }

  /**
   * Convert page to markdown via offscreen document
   * CRITICAL: Offscreen document has DOM access for Turndown/DOMParser
   */
  private async convertViaOffscreen(
    page: ConfluencePageData, 
    mermaidAttachments: Map<string, string>
  ): Promise<string> {
    // Convert Map to serializable object
    const mermaidRecord: Record<string, string> = {}
    mermaidAttachments.forEach((value, key) => {
      mermaidRecord[key] = value
    })

    // Send to offscreen document for conversion
    const response = await chrome.runtime.sendMessage({
      type: 'CONVERT_TO_MARKDOWN',
      payload: {
        page,
        mermaidAttachments: mermaidRecord
      }
    })

    if (!response?.success) {
      throw new Error(`Conversion failed: ${response?.error || 'Unknown error'}`)
    }

    return response.result.content
  }

  /**
   * Create ZIP blob ready for download
   * JSZip works without DOM, so this can run in service worker
   */
  async createZipBlob(pageId: string, onProgress?: (message: string) => void): Promise<Blob> {
    const bundle = await this.createBundle(pageId, onProgress)
    
    const progress = onProgress || (() => {})
    progress('Creating ZIP archive...')
    
    const zip = new JSZip()
    const sanitizedTitle = this.sanitizeFilename(bundle.metadata.pageTitle)
    
    // Add markdown file at root
    zip.file(`${sanitizedTitle}.md`, bundle.markdown)
    
    // Add assets folder
    if (bundle.assets.size > 0) {
      const assetsFolder = zip.folder('assets')
      if (assetsFolder) {
        for (const [filename, data] of bundle.assets) {
          assetsFolder.file(filename, data)
        }
      }
    }

    // Add metadata
    zip.file('export-metadata.json', JSON.stringify(bundle.metadata, null, 2))
    
    return zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
  }

  /**
   * Fetch page with all content formats
   */
  private async fetchPage(pageId: string): Promise<ConfluencePageData> {
    const expand = [
      'body.storage',
      'body.view',
      'body.export_view',
      'version',
      'space',
      'ancestors',
      'metadata.labels',
    ].join(',')

    const data = await this.apiClient.get<any>(`/content/${pageId}`, { expand })

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
        createdAt: data.version?.when,
        updatedAt: data.version?.when,
        url: data._links?.webui,
        parentId: data.ancestors?.[data.ancestors.length - 1]?.id,
      },
    }
  }

  /**
   * Fetch all attachments for a page
   */
  private async fetchAttachments(pageId: string): Promise<Attachment[]> {
    try {
      const data = await this.apiClient.get<any>(
        `/content/${pageId}/child/attachment`,
        { expand: 'version,metadata', limit: 200 }
      )

      return (data.results || []).map((att: any) => ({
        id: att.id,
        filename: att.title,
        mediaType: att.extensions?.mediaType || att.metadata?.mediaType || '',
        fileSize: att.extensions?.fileSize || 0,
        downloadUrl: att._links?.download || '',
      }))
    } catch (error) {
      console.error('[ExportBundler] Failed to fetch attachments:', error)
      return []
    }
  }

  /**
   * Filter Mermaid diagram attachments
   */
  private filterMermaidAttachments(attachments: Attachment[]): Attachment[] {
    return attachments.filter(att => 
      att.filename.endsWith('.mmd') ||
      att.filename.endsWith('.mermaid') ||
      (att.mediaType === 'text/plain' && !att.filename.includes('.'))
    )
  }

  /**
   * Filter image attachments (for bundling)
   */
  private filterImageAttachments(attachments: Attachment[]): Attachment[] {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']
    return attachments.filter(att => 
      imageExtensions.some(ext => att.filename.toLowerCase().endsWith(ext)) ||
      att.mediaType.startsWith('image/')
    )
  }

  /**
   * Download text attachments (for Mermaid diagrams)
   */
  private async downloadTextAttachments(attachments: Attachment[]): Promise<Map<string, string>> {
    const content = new Map<string, string>()

    for (const att of attachments) {
      try {
        if (!att.downloadUrl) continue
        const text = await this.apiClient.getText(att.downloadUrl)
        content.set(att.filename, text)
        console.log(`[ExportBundler] Downloaded text: ${att.filename}`)
      } catch (error) {
        console.error(`[ExportBundler] Text download failed: ${att.filename}`, error)
      }
    }

    return content
  }

  /**
   * Download binary attachments (images)
   */
  private async downloadBinaryAttachments(attachments: Attachment[]): Promise<Map<string, ArrayBuffer>> {
    const assets = new Map<string, ArrayBuffer>()

    for (const att of attachments) {
      try {
        if (!att.downloadUrl) continue
        const data = await this.apiClient.download(att.downloadUrl)
        assets.set(att.filename, data)
        console.log(`[ExportBundler] Downloaded: ${att.filename}`)
      } catch (error) {
        console.error(`[ExportBundler] Download failed: ${att.filename}`, error)
      }
    }

    return assets
  }

  /**
   * Update asset links in markdown to use local paths
   */
  private updateAssetLinks(markdown: string, assets: Map<string, ArrayBuffer>): string {
    let result = markdown
    const assetFilenames = Array.from(assets.keys())

    for (const filename of assetFilenames) {
      // Escape special regex characters
      const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      
      // Match Confluence download URLs ending with this filename
      const urlPattern = new RegExp(
        `\\]\\(https?://[^)]*?${escapedFilename}[^)]*\\)`,
        'gi'
      )
      
      // Replace with local path (using angle brackets for filenames with spaces)
      result = result.replace(urlPattern, `](<./assets/${filename}>)`)
    }

    return result
  }

  /**
   * Sanitize filename for file system
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 200)
  }
}
