/**
 * Browser-compatible Markdown Converter
 * 
 * ARCHITECTURE (follows CLI pattern):
 * 1. Uses BrowserHtmlProcessor to extract macros from STORAGE format
 * 2. Uses VIEW format as primary HTML (cleaner tables, TOC)
 * 3. Replaces macro placeholders AFTER Turndown conversion
 * 
 * This ensures:
 * - Code blocks have proper newlines preserved
 * - Tables render correctly
 * - TOC content is preserved
 * - Mermaid diagrams work properly
 */
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { BrowserHtmlProcessor } from '../core/BrowserHtmlProcessor'

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
    createdAt?: Date | string
    updatedAt?: Date | string
    url?: string
    parentId?: string
  }
}

export interface MarkdownOptions {
  frontmatter?: boolean
  preserveHtml?: boolean
  gfm?: boolean
}

export interface ConvertResult {
  content: string
  metadata: Record<string, any>
}

export class BrowserMarkdownConverter {
  private turndownService: TurndownService
  private htmlProcessor: BrowserHtmlProcessor
  private options: Required<MarkdownOptions>

  constructor(options?: MarkdownOptions) {
    this.options = {
      frontmatter: true,
      preserveHtml: false,
      gfm: true,
      ...options,
    }

    this.turndownService = this.createTurndownService()
    this.htmlProcessor = new BrowserHtmlProcessor()
  }

  /**
   * Set Mermaid attachments for diagram extraction
   * CRITICAL: Must be called BEFORE convert() for plugin-based Mermaid support
   */
  setMermaidAttachments(attachments: Map<string, string>): void {
    this.htmlProcessor.setMermaidAttachments(attachments)
  }

  private createTurndownService(): TurndownService {
    const service = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
      preformattedCode: true,
    })

    if (this.options.gfm) {
      service.use(gfm)
    }

    this.addCustomRules(service)
    return service
  }

  private addCustomRules(service: TurndownService): void {
    // Rule: Handle Confluence images
    service.addRule('confluenceImages', {
      filter: (node: any) => {
        if (node.nodeName !== 'IMG') return false
        const src = node.getAttribute('src') || ''
        return src.includes('/download/') || src.includes('/attachments/')
      },
      replacement: (_content: any, node: any) => {
        const alt = node.getAttribute('alt') || node.getAttribute('title') || ''
        const src = node.getAttribute('src') || ''

        let filename = src.split('/').pop() || 'image.png'
        if (filename.includes('?')) filename = filename.split('?')[0]
        try { filename = decodeURIComponent(filename) } catch { }

        return `![${alt}](<./assets/${filename}>)`
      },
    })

    // Rule: Handle tables with proper GFM format  
    service.addRule('gfmTables', {
      filter: 'table',
      replacement: function (_content, node: any) {
        try {
          const rows: string[][] = []
          const tableRows = Array.from(node.querySelectorAll('tr') || []) as any[]

          if (tableRows.length === 0) return _content || '\n'

          for (const tr of tableRows) {
            const cells: string[] = []
            const tableCells = Array.from(tr.querySelectorAll('th, td') || []) as any[]

            for (const cell of tableCells) {
              let cellContent = (cell.textContent || '').trim().replace(/\s+/g, ' ')
              cellContent = cellContent.replace(/\|/g, '\\|')
              cells.push(cellContent)
            }

            if (cells.length > 0) rows.push(cells)
          }

          if (rows.length === 0) return _content || '\n'

          let markdown = '\n'
          const columnCount = Math.max(...rows.map(r => r.length))
          
          const headerRow = rows[0].concat(Array(Math.max(0, columnCount - rows[0].length)).fill(' '))
          markdown += '| ' + headerRow.join(' | ') + ' |\n'
          markdown += '| ' + Array(columnCount).fill('---').join(' | ') + ' |\n'

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i].concat(Array(Math.max(0, columnCount - rows[i].length)).fill(' '))
            markdown += '| ' + row.join(' | ') + ' |\n'
          }

          return markdown + '\n'
        } catch (error) {
          console.warn('Table conversion failed:', error)
          return _content || '\n'
        }
      },
    })

    // Rule: Handle generic preformatted blocks (noformat macro fallback)
    service.addRule('confluenceNoformat', {
      filter: (node: any) => {
        return node.nodeName === 'DIV' && 
              (node.classList.contains('preformatted') || node.classList.contains('noformat'))
      },
      replacement: (content: string) => {
        const trimmed = content.trim()
        // If content already appears to be a code block (handled by inner PRE), pass through
        if (trimmed.startsWith('```')) return '\n' + trimmed + '\n'
        
        // Otherwise force text block
        return '\n```text\n' + trimmed + '\n```\n'
      }
    })
  }

  /**
   * Convert Confluence page to Markdown
   * Uses HtmlProcessor to properly extract macros and process content
   */
  async convert(page: ConfluencePageData): Promise<ConvertResult> {
    console.log('[BrowserMarkdownConverter] Converting page:', page.id)

    // Step 1: Process content using HtmlProcessor
    // This extracts macros from storage and uses view for layout
    const processed = await this.htmlProcessor.process(
      page.content.storage,
      page.content.view
    )

    console.log('[BrowserMarkdownConverter] Processed content:', {
      macros: processed.macros,
      htmlLength: processed.html.length,
    })

    // Step 2: Convert processed HTML to Markdown
    let markdown = this.turndownService.turndown(processed.html)

    // Step 3: Generate Table of Contents
    // Done BEFORE restoring code blocks to avoid false TOC entries from code content
    markdown = this.generateTableOfContents(markdown)

    // Step 4: Replace macro placeholders with actual code blocks
    // CRITICAL: This restores proper newlines in code blocks
    markdown = this.htmlProcessor.replaceMermaidPlaceholders(markdown)

    // Step 5: Add frontmatter
    if (this.options.frontmatter) {
      markdown = this.generateFrontmatter(page, processed.macros) + '\n' + markdown
    }

    // Step 6: Final cleanup
    markdown = this.cleanupMarkdown(markdown)

    // Clear processor state for next conversion
    this.htmlProcessor.clearPlaceholders()

    return {
      content: markdown,
      metadata: {
        format: 'markdown',
        pageId: page.id,
        pageTitle: page.title,
        spaceKey: page.spaceKey,
        macros: processed.macros,
        exportedAt: new Date().toISOString(),
      },
    }
  }

  /**
   * Generate Table of Contents from headings
   */
  private generateTableOfContents(markdown: string): string {
    // Check for TOC placeholder
    // ID format: {{TOC-PLACEHOLDER-min-max}}
    // Turndown might escape hyphens (though rarely inside words), so we handle optional backslashes
    // Regex matches: {{TOC \-? PLACEHOLDER \-? (\d+) \-? (\d+) }}
    const tocPlaceholderRegex = /\{\{TOC\\?-PLACEHOLDER\\?-(\d+)\\?-(\d+)\}\}/
    const match = markdown.match(tocPlaceholderRegex)
    
    if (!match) {
      return markdown
    }

    const minLevel = parseInt(match[1], 10)
    const maxLevel = parseInt(match[2], 10)

    console.log(`[BrowserMarkdownConverter] Generating TOC (levels ${minLevel}-${maxLevel})`)

    // Extract headings
    const headings: Array<{ level: number; text: string; anchor: string }> = []
    // Match # Heading 1, ## Heading 2, etc. (Github Flavored Markdown)
    const headingRegex = /^(#{1,6})\s+(.+)$/gm
    let headMatch

    while ((headMatch = headingRegex.exec(markdown)) !== null) {
      const level = headMatch[1].length
      const text = headMatch[2].trim()

      if (level < minLevel || level > maxLevel) continue

      // Clean text and generate anchor
      const cleanText = text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
        .replace(/`([^`]+)`/g, '$1') // Remove inline code
        .replace(/^[0-9]+\.\s+/, '') // Remove numbered lists markers if any

      const anchor = cleanText
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove non-word chars
        .replace(/\s+/g, '-') // Replace spaces with dashes
        .replace(/-+/g, '-') // Normalize dashes
        .replace(/^-|-$/g, '') // Trim

      headings.push({ level, text: cleanText, anchor })
    }

    // Cleanup regex for printable marker (also escaped)
    const printableRegex = /\{\{TOC\\?-PRINTABLE\}\}/g

    if (headings.length === 0) {
      return markdown.replace(tocPlaceholderRegex, '').replace(printableRegex, '')
    }

    // Build TOC markdown
    const tocLines = headings.map(h => {
      const indent = '  '.repeat(h.level - minLevel)
      // Escape loose brackets in text if any? Turndown handles this usually.
      return `${indent}- [${h.text}](#${h.anchor})`
    })

    const tocMarkdown = `<!-- Table of Contents -->\n${tocLines.join('\n')}\n`

    // Replace placeholder
    return markdown
      .replace(tocPlaceholderRegex, tocMarkdown)
      .replace(printableRegex, '')
  }

  private generateFrontmatter(
    page: ConfluencePageData,
    macros?: { mermaid: number; code: number; diagrams: number; panels: number }
  ): string {
    const lines = [
      '---',
      `title: "${this.escapeYaml(page.title)}"`,
      `confluenceId: "${page.id}"`,
    ]

    if (page.spaceKey) lines.push(`confluenceSpaceKey: "${page.spaceKey}"`)
    if (page.metadata?.url) lines.push(`confluenceUrl: "${page.metadata.url}"`)
    if (page.version) lines.push(`confluenceVersion: ${page.version}`)
    if (page.metadata?.createdBy) lines.push(`confluenceCreatedBy: "${page.metadata.createdBy}"`)
    if (page.metadata?.createdAt) lines.push(`confluenceCreatedAt: "${this.toISOString(page.metadata.createdAt)}"`)
    if (page.metadata?.updatedAt) lines.push(`confluenceUpdatedAt: "${this.toISOString(page.metadata.updatedAt)}"`)
    if (page.metadata?.parentId) lines.push(`confluenceParentId: "${page.metadata.parentId}"`)

    if (page.metadata?.labels && page.metadata.labels.length > 0) {
      lines.push(`confluenceLabels:`)
      page.metadata.labels.forEach(label => lines.push(`  - "${label}"`))
    }

    lines.push(`exportedAt: "${new Date().toISOString()}"`)
    lines.push(`exportedBy: "conflu-exporter-extension"`)
    lines.push('---')

    return lines.join('\n')
  }

  private escapeYaml(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\n/g, '\\n')
  }

  private toISOString(date: Date | string): string {
    return typeof date === 'string' ? date : date.toISOString()
  }

  private cleanupMarkdown(markdown: string): string {
    markdown = markdown.replace(/\n{3,}/g, '\n\n')
    markdown = markdown.trim()
    if (!markdown.endsWith('\n')) markdown += '\n'
    return markdown
  }
}
