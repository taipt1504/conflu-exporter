import { JSDOM } from 'jsdom'
import { getLogger } from '../cli/ui/logger.js'
import { MacroParser, ParsedImage, ParsedLink } from './macro-parser.js'
import {
  MermaidHandler,
  CodeHandler,
  DiagramHandler,
  ContentHandler,
} from './macro-handlers/index.js'

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
 * HTML Processor
 * Processes both storage format (macros) and view format (rendered HTML)
 * to prepare content for conversion to markdown/PDF/DOCX
 *
 * CRITICAL: Processes storage format FIRST to extract macro source code,
 * then processes view format for final HTML
 */
export class HtmlProcessor {
  private logger = getLogger()
  private macroParser: MacroParser
  private mermaidHandler: MermaidHandler
  private codeHandler: CodeHandler
  private diagramHandler: DiagramHandler
  private contentHandler: ContentHandler

  constructor() {
    this.macroParser = new MacroParser()
    this.mermaidHandler = new MermaidHandler(this.macroParser)
    this.codeHandler = new CodeHandler(this.macroParser)
    this.diagramHandler = new DiagramHandler(this.macroParser)
    this.contentHandler = new ContentHandler(this.macroParser)
  }

  /**
   * Set Mermaid attachment content before processing
   * Call this method to cache .mmd file content for attachment-based Mermaid macros
   */
  setMermaidAttachmentContent(filename: string, content: string): void {
    this.mermaidHandler.setAttachmentContent(filename, content)
    this.logger.debug(`Cached mermaid attachment in HtmlProcessor: ${filename}`)
  }

  /**
   * Set multiple Mermaid attachments at once
   */
  setMermaidAttachments(attachments: Map<string, string>): void {
    for (const [filename, content] of attachments) {
      this.setMermaidAttachmentContent(filename, content)
    }
    this.logger.info(`Cached ${attachments.size} mermaid attachment(s)`)
  }

  /**
   * Clear all cached mermaid attachments
   */
  clearMermaidAttachments(): void {
    this.mermaidHandler.clearCache()
    this.logger.debug('Cleared mermaid attachment cache')
  }

  /**
   * Process page content (storage + view formats)
   * Returns processed HTML ready for conversion
   */
  process(storageContent: string, viewContent: string): ProcessedContent {
    this.logger.info('Processing page content with macro extraction...')

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
      this.logger.warn('No content provided for processing')
      return fallbackResult
    }

    try {
      // Step 1: Process storage format to extract macros
      const processedStorage = this.processStorageFormat(storageContent || '')

      // Step 2: Process view format for display content
      const processedView = this.processViewFormat(viewContent || '')

      // Step 3: Merge processed content (prioritize storage for macros)
      const mergedHtml = this.mergeContent(processedStorage, processedView)

      // Step 4: Extract metadata with safe fallbacks
      let images: ParsedImage[] = []
      let links: ParsedLink[] = []
      let mermaidCount = 0
      let codeCount = 0
      let diagramCount = 0
      let panelCount = 0

      try {
        images = this.macroParser.parseImages(storageContent || '')
      } catch (e) {
        this.logger.debug('Image parsing failed, using empty array')
      }

      try {
        links = this.macroParser.parseLinks(storageContent || '')
      } catch (e) {
        this.logger.debug('Link parsing failed, using empty array')
      }

      try {
        mermaidCount = this.macroParser.findMacrosByName(storageContent || '', 'mermaid').length
        codeCount = this.macroParser.findMacrosByName(storageContent || '', 'code').length
        diagramCount =
          this.macroParser.findMacrosByName(storageContent || '', 'drawio').length +
          this.macroParser.findMacrosByName(storageContent || '', 'gliffy').length +
          this.macroParser.findMacrosByName(storageContent || '', 'lucidchart').length
        panelCount =
          this.macroParser.findMacrosByName(storageContent || '', 'info').length +
          this.macroParser.findMacrosByName(storageContent || '', 'warning').length +
          this.macroParser.findMacrosByName(storageContent || '', 'note').length +
          this.macroParser.findMacrosByName(storageContent || '', 'tip').length
      } catch (e) {
        this.logger.debug('Macro counting failed, using zeros')
      }

      this.logger.info(
        `Processed content: ${mermaidCount} Mermaid, ${codeCount} code, ${diagramCount} diagrams, ${panelCount} panels`,
      )

      return {
        html: mergedHtml,
        images,
        links,
        macros: {
          mermaid: mermaidCount,
          code: codeCount,
          diagrams: diagramCount,
          panels: panelCount,
        },
      }
    } catch (error) {
      this.logger.error('Content processing failed, using fallback:', error)
      return fallbackResult
    }
  }

  /**
   * Process storage format to extract macro source code
   * CRITICAL: This preserves diagram source code, not just rendered output
   */
  private processStorageFormat(storageContent: string): string {
    if (!storageContent) {
      return ''
    }

    let processed = storageContent

    // Process in order of priority with defensive error handling
    // 1. Mermaid diagrams (CRITICAL - extract source code)
    try {
      processed = this.mermaidHandler.process(processed)
    } catch (error) {
      this.logger.debug('Mermaid processing failed, continuing with original content')
    }

    // 2. Code blocks (preserve source code)
    try {
      processed = this.codeHandler.process(processed)
    } catch (error) {
      this.logger.debug('Code block processing failed, continuing')
    }

    // 3. Other diagrams (DrawIO, Gliffy, etc.)
    try {
      processed = this.diagramHandler.process(processed)
    } catch (error) {
      this.logger.debug('Diagram processing failed, continuing')
    }

    // 4. Content panels (info, warning, note, etc.)
    try {
      processed = this.contentHandler.process(processed)
    } catch (error) {
      this.logger.debug('Content panel processing failed, continuing')
    }

    // 5. Additional content macros
    try {
      processed = this.contentHandler.processQuote(processed)
      processed = this.contentHandler.processAnchors(processed)
    } catch (error) {
      this.logger.debug('Quote/Anchor processing failed, continuing')
    }

    return processed
  }

  /**
   * Process view format to clean up rendered HTML
   */
  private processViewFormat(viewContent: string): string {
    try {
      const dom = new JSDOM(viewContent)
      const doc = dom.window.document

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
      this.logger.error('Failed to process view format:', error)
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
          // Will be handled by link processing later
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
      // Add class for markdown processor
      table.classList.add('confluence-table')

      // Process table headers
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
    // For now, use processed storage content as primary
    // View content is used as fallback for content without macros

    // Check if storage has been processed (contains placeholders or markdown code fences)
    if (
      storageContent.includes('MERMAID_PLACEHOLDER_') ||
      storageContent.includes('data-mermaid-placeholder') ||
      storageContent.includes('```mermaid') ||
      storageContent.includes('```')
    ) {
      this.logger.debug('Using processed storage content (contains macro placeholders)')
      return storageContent
    }

    // Otherwise use view content
    this.logger.debug('Using view content (no macro placeholders in storage)')
    return viewContent
  }

  /**
   * Sanitize HTML for safety
   */
  sanitize(html: string): string {
    try {
      const dom = new JSDOM(html)
      const doc = dom.window.document

      // Remove dangerous elements
      const dangerousSelectors = ['script', 'iframe', 'object', 'embed']

      for (const selector of dangerousSelectors) {
        const elements = doc.querySelectorAll(selector)
        elements.forEach((el) => el.remove())
      }

      // Remove event handlers
      const allElements = doc.querySelectorAll('*')
      allElements.forEach((el) => {
        const attributes = el.attributes
        for (let i = attributes.length - 1; i >= 0; i--) {
          const attr = attributes[i]
          if (attr.name.startsWith('on')) {
            el.removeAttribute(attr.name)
          }
        }
      })

      return doc.body.innerHTML
    } catch (error) {
      this.logger.error('Failed to sanitize HTML:', error)
      return html
    }
  }
}

export function createHtmlProcessor(): HtmlProcessor {
  return new HtmlProcessor()
}
