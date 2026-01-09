/**
 * Browser-compatible HTML Processor
 * Processes both storage format (macros) and view format (rendered HTML)
 * Uses native DOM APIs instead of JSDOM
 */

import { BrowserMacroParser, ParsedImage, ParsedLink } from './BrowserMacroParser'
import { BrowserMermaidProcessor } from './BrowserMermaidProcessor'

export interface ProcessedContent {
  html: string
  images: ParsedImage[]
  links: ParsedLink[]
  macros: {
    mermaid: number
    code: number
    diagrams: number
    panels: number
  }
}

/**
 * Browser HTML Processor
 * Processes Confluence storage and view formats to extract macros and prepare for markdown conversion
 */
export class BrowserHtmlProcessor {
  private parser = new DOMParser()
  private macroParser: BrowserMacroParser
  private mermaidProcessor: BrowserMermaidProcessor

  constructor() {
    this.macroParser = new BrowserMacroParser()
    this.mermaidProcessor = new BrowserMermaidProcessor()
  }

  /**
   * Set Mermaid attachment content before processing
   */
  setMermaidAttachments(attachments: Map<string, string>): void {
    this.mermaidProcessor.setMermaidAttachments(attachments)
    console.log(`[BrowserHtmlProcessor] Cached ${attachments.size} mermaid attachment(s)`)
  }

  /**
   * Clear all cached mermaid attachments
   */
  clearMermaidAttachments(): void {
    this.mermaidProcessor.clearCache()
  }

  /**
   * Replace Mermaid placeholders in markdown with actual code blocks
   * Call this after converting HTML to Markdown
   */
  replaceMermaidPlaceholders(markdown: string): string {
    return this.mermaidProcessor.replacePlaceholders(markdown)
  }

  /**
   * Process page content (storage + view formats)
   * Returns processed HTML ready for conversion
   */
  async process(storageContent: string, viewContent: string): Promise<ProcessedContent> {
    console.log('[BrowserHtmlProcessor] Processing page content with macro extraction...')

    // Default fallback result
    const fallbackResult: ProcessedContent = {
      html: viewContent || storageContent || '',
      images: [],
      links: [],
      macros: {
        mermaid: 0,
        code: 0,
        diagrams: 0,
        panels: 0,
      },
    }

    // Validate inputs
    if (!storageContent && !viewContent) {
      console.warn('[BrowserHtmlProcessor] No content provided for processing')
      return fallbackResult
    }

    try {
      // Step 1: Process storage format to extract macros
      const processedStorage = await this.processStorageFormat(storageContent || '')

      // Step 2: Process view format for display content
      const processedView = this.processViewFormat(viewContent || '')

      // Step 3: Merge processed content (prioritize storage for macros)
      const mergedHtml = this.mergeContent(processedStorage, processedView)

      // Step 4: Extract metadata
      let images: ParsedImage[] = []
      let links: ParsedLink[] = []
      let mermaidCount = 0
      let codeCount = 0

      try {
        images = this.macroParser.parseImages(storageContent || '')
      } catch (e) {
        console.warn('[BrowserHtmlProcessor] Image parsing failed:', e)
      }

      try {
        links = this.macroParser.parseLinks(storageContent || '')
      } catch (e) {
        console.warn('[BrowserHtmlProcessor] Link parsing failed:', e)
      }

      try {
        mermaidCount = this.macroParser.findMacrosByName(storageContent || '', 'mermaid').length +
                       this.macroParser.findMacrosByName(storageContent || '', 'mermaid-cloud').length +
                       this.macroParser.findMacrosByName(storageContent || '', 'mermaid-macro').length
        codeCount = this.macroParser.findMacrosByName(storageContent || '', 'code').length
      } catch (e) {
        console.warn('[BrowserHtmlProcessor] Macro counting failed:', e)
      }

      console.log(
        `[BrowserHtmlProcessor] Processed content: ${mermaidCount} Mermaid, ${codeCount} code blocks`
      )

      return {
        html: mergedHtml,
        images,
        links,
        macros: {
          mermaid: mermaidCount,
          code: codeCount,
          diagrams: 0,
          panels: 0,
        },
      }
    } catch (error) {
      console.error('[BrowserHtmlProcessor] Content processing failed:', error)
      return fallbackResult
    }
  }

  /**
   * Process storage format to extract macro source code
   * CRITICAL: This preserves diagram source code, not just rendered output
   */
  private async processStorageFormat(storageContent: string): Promise<string> {
    if (!storageContent) {
      return ''
    }

    let processed = storageContent

    // 1. Process Mermaid diagrams (CRITICAL - extract source code)
    try {
      processed = await this.mermaidProcessor.process(processed)
      console.log('[BrowserHtmlProcessor] Mermaid processing complete')
    } catch (error) {
      console.warn('[BrowserHtmlProcessor] Mermaid processing failed:', error)
    }

    // Note: Other macro handlers (code blocks, diagrams, panels) can be added here
    // For now, focusing on Mermaid which is the reported issue

    return processed
  }

  /**
   * Process view format to clean up rendered HTML
   */
  private processViewFormat(viewContent: string): string {
    if (!viewContent) {
      return ''
    }

    try {
      const doc = this.parser.parseFromString(viewContent, 'text/html')

      // Remove Confluence UI elements
      this.removeConfluenceUI(doc)

      // Process links
      this.processLinks(doc)

      // Process images
      this.processImages(doc)

      // Process tables
      this.processTables(doc)

      return doc.body.innerHTML
    } catch (error) {
      console.error('[BrowserHtmlProcessor] View format processing failed:', error)
      return viewContent
    }
  }

  /**
   * Remove Confluence-specific UI elements
   */
  private removeConfluenceUI(doc: Document): void {
    const selectorsToRemove = [
      '.conf-macro-output-inline',
      '.confluence-information-macro-icon',
      '.expand-control',
      '.page-metadata',
      '.comment-thread',
      '.footer-body',
      '.navmenu',
      'script',
      'style',
      '.plugin_pagetree',
    ]

    for (const selector of selectorsToRemove) {
      const elements = doc.querySelectorAll(selector)
      elements.forEach((el) => el.remove())
    }
  }

  /**
   * Process links in HTML
   */
  private processLinks(doc: Document): void {
    const links = doc.querySelectorAll('a')

    links.forEach((link) => {
      const href = link.getAttribute('href')

      if (href) {
        // Convert Confluence internal links to relative paths
        if (href.includes('/wiki/spaces/') || href.includes('/pages/')) {
          link.setAttribute('data-confluence-link', 'true')
        }
      }
    })
  }

  /**
   * Process images in HTML
   */
  private processImages(doc: Document): void {
    const images = doc.querySelectorAll('img')

    images.forEach((img) => {
      const src = img.getAttribute('src')

      if (src) {
        // Mark Confluence images for later download
        if (src.includes('/download/') || src.includes('/attachments/')) {
          img.setAttribute('data-confluence-image', 'true')
          img.setAttribute('data-original-src', src)
        }
      }
    })
  }

  /**
   * Process tables for better markdown conversion
   */
  private processTables(doc: Document): void {
    const tables = doc.querySelectorAll('table')

    tables.forEach((table) => {
      table.classList.add('confluence-table')

      const headers = table.querySelectorAll('th')
      headers.forEach((th) => {
        th.setAttribute('data-heading', 'true')
      })
    })
  }

  /**
   * Merge storage and view content
   * Prioritize storage for macros, view for general content
   */
  private mergeContent(storageContent: string, viewContent: string): string {
    // Check if storage has been processed (contains placeholders or markdown code fences)
    const hasMacros =
      storageContent.includes('data-mermaid-placeholder') ||
      storageContent.includes('MERMAID_PLACEHOLDER_') ||
      storageContent.includes('```mermaid') ||
      storageContent.includes('```')

    if (!hasMacros) {
      // No macros in storage, use view content as primary
      console.log('[BrowserHtmlProcessor] Using view content (no macro placeholders in storage)')
      return viewContent
    }

    console.log('[BrowserHtmlProcessor] Storage has macros, merging with view content for images...')

    // Extract images from view content
    const viewImages = this.extractImagesFromHtml(viewContent)

    if (viewImages.length === 0) {
      console.log('[BrowserHtmlProcessor] No images in view content, using storage only')
      return storageContent
    }

    console.log(`[BrowserHtmlProcessor] Found ${viewImages.length} images in view content`)

    // Extract images already in storage content
    const storageImages = this.extractImagesFromHtml(storageContent)
    console.log(`[BrowserHtmlProcessor] Found ${storageImages.length} images in storage content`)

    // Find images that are in view but not in storage
    const storageImageFilenames = new Set(
      storageImages.map((img) => this.extractFilenameFromSrc(img.src)).filter(Boolean)
    )

    const missingImages = viewImages.filter((img) => {
      const filename = this.extractFilenameFromSrc(img.src)
      return filename && !storageImageFilenames.has(filename)
    })

    if (missingImages.length === 0) {
      console.log('[BrowserHtmlProcessor] All view images already present in storage')
      return storageContent
    }

    console.log(`[BrowserHtmlProcessor] Merging ${missingImages.length} missing images from view content`)

    // Append missing images to storage content
    return this.appendImagesToContent(storageContent, missingImages)
  }

  /**
   * Extract image information from HTML content
   */
  private extractImagesFromHtml(html: string): Array<{ src: string; alt: string; html: string }> {
    const images: Array<{ src: string; alt: string; html: string }> = []

    if (!html) {
      return images
    }

    try {
      const doc = this.parser.parseFromString(html, 'text/html')
      const imgElements = doc.querySelectorAll('img')

      imgElements.forEach((img) => {
        const src = img.getAttribute('data-original-src') || img.getAttribute('src') || ''
        // Only include Confluence images
        if (src.includes('/download/') || src.includes('/attachments/')) {
          images.push({
            src,
            alt: img.getAttribute('alt') || '',
            html: img.outerHTML,
          })
        }
      })
    } catch (error) {
      console.warn('[BrowserHtmlProcessor] Failed to extract images:', error)
    }

    return images
  }

  /**
   * Extract filename from image src URL
   */
  private extractFilenameFromSrc(src: string): string | null {
    if (!src) {
      return null
    }

    try {
      let filename = src.split('/').pop() || ''

      // Remove query string
      if (filename.includes('?')) {
        filename = filename.split('?')[0]
      }

      // Decode URL-encoded characters
      try {
        filename = decodeURIComponent(filename)
      } catch {
        // If decoding fails, use the original
      }

      return filename || null
    } catch {
      return null
    }
  }

  /**
   * Append missing images to content
   */
  private appendImagesToContent(
    storageContent: string,
    missingImages: Array<{ src: string; alt: string; html: string }>
  ): string {
    try {
      const doc = this.parser.parseFromString(storageContent, 'text/html')

      for (const image of missingImages) {
        const imgElement = doc.createElement('img')
        imgElement.setAttribute('src', image.src)
        imgElement.setAttribute('alt', image.alt)
        imgElement.setAttribute('data-confluence-image', 'true')
        imgElement.setAttribute('data-original-src', image.src)

        // Add a paragraph wrapper for better formatting
        const wrapper = doc.createElement('p')
        wrapper.appendChild(imgElement)

        doc.body.appendChild(wrapper)
        console.log(`[BrowserHtmlProcessor] Appended image: ${this.extractFilenameFromSrc(image.src)}`)
      }

      return doc.body.innerHTML
    } catch (error) {
      console.warn('[BrowserHtmlProcessor] Failed to merge images:', error)
      return storageContent
    }
  }
}
