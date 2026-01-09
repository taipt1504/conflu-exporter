/**
 * Browser-compatible Markdown Converter
 * Simplified version of MarkdownConverter without Node.js dependencies
 *
 * Architecture:
 * - Uses Turndown for HTML to Markdown conversion
 * - Skips HtmlProcessor (requires jsdom - Node.js only)
 * - Works directly with view content (pre-rendered HTML)
 * - Preserves all custom Turndown rules for Confluence elements
 * - Frontmatter generation for metadata
 *
 * Limitations vs CLI version:
 * - No macro preprocessing (Mermaid, code blocks) - uses view content as-is
 * - No storage format merging - relies on view format only
 * - TOC generation simplified (no placeholder replacement)
 */
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import type { ConfluencePage } from '@types'

export interface MarkdownOptions {
  frontmatter?: boolean
  preserveHtml?: boolean
  gfm?: boolean
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

export class BrowserMarkdownConverter {
  private turndownService: TurndownService
  private options: MarkdownOptions

  constructor(options?: MarkdownOptions) {
    this.options = {
      frontmatter: true,
      preserveHtml: false,
      gfm: true,
      ...options,
    }

    this.turndownService = this.createTurndownService()
  }

  /**
   * Create and configure Turndown service
   */
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

    // Add GFM plugin for tables, strikethrough, etc.
    if (this.options.gfm) {
      service.use(gfm)
    }

    // Add custom rules for Confluence elements
    this.addCustomRules(service)

    return service
  }

  /**
   * Add custom Turndown rules for Confluence elements
   */
  private addCustomRules(service: TurndownService): void {
    // Rule: Preserve HTML comments
    service.addRule('preserveComments', {
      filter: (node: any) => {
        return node.nodeType === 8 // Node.COMMENT_NODE
      },
      replacement: (content) => {
        return `<!-- ${content} -->`
      },
    })

    // Rule: Handle Confluence images with data attributes
    service.addRule('confluenceImages', {
      filter: (node: any) => {
        return (
          node.nodeName === 'IMG' &&
          (node.getAttribute('data-confluence-image') === 'true' ||
            (node.getAttribute('src')?.includes('/download/') ?? false) ||
            (node.getAttribute('src')?.includes('/attachments/') ?? false))
        )
      },
      replacement: (_content, node: any) => {
        const alt = node.getAttribute('alt') || node.getAttribute('title') || ''
        const src = node.getAttribute('data-original-src') || node.getAttribute('src') || ''

        // Extract filename from URL
        let filename = src.split('/').pop() || 'image.png'

        // Remove query string
        if (filename.includes('?')) {
          filename = filename.split('?')[0]
        }

        // Decode URL-encoded characters
        try {
          filename = decodeURIComponent(filename)
        } catch {
          // If decoding fails, use original
        }

        // Build relative path with angle brackets for special characters
        const relativePath = `./assets/${filename}`
        let markdown = `![${alt}](<${relativePath}>)`

        // Preserve dimensions if available
        const width = node.getAttribute('width')
        const height = node.getAttribute('height')
        if (width || height) {
          markdown += ` <!-- Size: ${width || 'auto'}x${height || 'auto'} -->`
        }

        return markdown
      },
    })

    // Rule: Handle Confluence internal links
    service.addRule('confluenceLinks', {
      filter: (node) => {
        return node.nodeName === 'A' && node.getAttribute('data-confluence-link') === 'true'
      },
      replacement: (content, node: any) => {
        const href = node.getAttribute('href') || ''
        const title = node.getAttribute('title')

        // Extract page ID from Confluence URL
        const pageIdMatch = href.match(/\/pages\/(\d+)/)
        const pageId = pageIdMatch ? pageIdMatch[1] : null

        let markdown = `[${content}](${href}${title ? ` "${title}"` : ''})`

        if (pageId) {
          markdown += ` <!-- Confluence Page ID: ${pageId} -->`
        }

        return markdown
      },
    })

    // Rule: Handle Confluence attachment links
    service.addRule('confluenceAttachments', {
      filter: (node: any) => {
        if (node.nodeName !== 'A') return false
        if (node.getAttribute('data-confluence-link') === 'true') return false
        const href = node.getAttribute('href') || ''
        return href.includes('/download/') || href.includes('/attachments/')
      },
      replacement: (content, node: any) => {
        const href = node.getAttribute('href') || ''

        // Extract filename
        let filename = href.split('/').pop() || 'file'

        // Remove query string
        if (filename.includes('?')) {
          filename = filename.split('?')[0]
        }

        // Decode URL-encoded characters
        try {
          filename = decodeURIComponent(filename)
        } catch {
          // Use original if decoding fails
        }

        // Build relative path with angle brackets
        const relativePath = `./assets/${filename}`
        return `[${content}](<${relativePath}>)`
      },
    })

    // Rule: Handle blockquotes
    service.addRule('blockquotes', {
      filter: 'blockquote',
      replacement: (content) => {
        // Add blockquote markers
        return (
          '\n' +
          content
            .trim()
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n') +
          '\n'
        )
      },
    })

    // Rule: Handle Confluence tables with proper GFM format
    service.addRule('confluenceTables', {
      filter: 'table',
      replacement: function (_content, node: any) {
        try {
          // Extract table rows
          const rows: string[][] = []
          const tableRowNodes = node.querySelectorAll ? node.querySelectorAll('tr') : null
          const tableRows: any[] = tableRowNodes ? Array.from(tableRowNodes) : []

          if (tableRows.length === 0) {
            return _content || '\n'
          }

          for (const tr of tableRows) {
            const cells: string[] = []
            const tableCellNodes = tr.querySelectorAll ? tr.querySelectorAll('th, td') : null
            const tableCells: any[] = tableCellNodes ? Array.from(tableCellNodes) : []

            for (const cell of tableCells) {
              // Clean cell content
              let cellContent = cell.textContent || ''
              cellContent = cellContent.trim().replace(/\s+/g, ' ')
              cells.push(cellContent)
            }

            if (cells.length > 0) {
              rows.push(cells)
            }
          }

          if (rows.length === 0) {
            return '\n'
          }

          // Build markdown table
          let markdown = '\n'

          // Check if first row is header
          const hasHeader = node.querySelector
            ? node.querySelector('thead') || node.querySelector('th')
            : false
          let startRow = 0

          if (hasHeader && rows.length > 0) {
            // Header row
            markdown += '| ' + rows[0].join(' | ') + ' |\n'

            // Separator row
            const columnCount = rows[0].length
            markdown += '| ' + Array(columnCount).fill('---').join(' | ') + ' |\n'

            startRow = 1
          } else if (rows.length > 0) {
            // No header detected, create empty header
            const columnCount = rows[0].length
            markdown += '| ' + Array(columnCount).fill(' ').join(' | ') + ' |\n'
            markdown += '| ' + Array(columnCount).fill('---').join(' | ') + ' |\n'
          }

          // Data rows
          for (let i = startRow; i < rows.length; i++) {
            markdown += '| ' + rows[i].join(' | ') + ' |\n'
          }

          markdown += '\n'
          return markdown
        } catch (error) {
          console.warn('Table conversion failed, using fallback:', error)
          return _content || '\n'
        }
      },
    })
  }

  /**
   * Convert Confluence page to Markdown
   * Uses view content (pre-rendered HTML) instead of storage format
   */
  async convert(page: ConfluencePage, _options?: any): Promise<ConvertResult> {
    // Validate page has required content
    if (!page.content || !page.content.view) {
      throw new Error(`Page ${page.id} is missing view content`)
    }

    // Use view content (already rendered HTML) directly
    const html = page.content.view

    // Convert HTML to Markdown
    let markdown = this.turndownService.turndown(html)

    // Add frontmatter if enabled
    if (this.options.frontmatter) {
      const frontmatter = this.generateFrontmatter(page)
      markdown = `${frontmatter}\n${markdown}`
    }

    // Clean up markdown
    markdown = this.cleanupMarkdown(markdown)

    // Generate metadata
    const metadata = {
      format: 'markdown' as const,
      pageId: page.id,
      pageTitle: page.title,
      spaceKey: page.spaceKey,
      version: page.version,
      url: page.metadata?.url,
      exportedAt: new Date(),
      labels: page.metadata?.labels || [],
      createdBy: page.metadata?.createdBy,
      createdAt: page.metadata?.createdAt,
      updatedAt: page.metadata?.updatedAt,
      parentId: page.metadata?.parentId,
    }

    return {
      content: markdown,
      metadata,
    }
  }

  /**
   * Generate YAML frontmatter with metadata
   */
  private generateFrontmatter(page: ConfluencePage): string {
    const frontmatter = [
      '---',
      `title: "${this.escapeYaml(page.title)}"`,
      `confluenceId: "${page.id}"`,
      `confluenceSpaceKey: "${page.spaceKey || ''}"`,
      `confluenceUrl: "${page.metadata?.url || ''}"`,
      `confluenceVersion: ${page.version || 1}`,
      `confluenceCreatedBy: "${page.metadata?.createdBy || ''}"`,
      `confluenceCreatedAt: "${this.toISOString(page.metadata?.createdAt) || ''}"`,
      `confluenceUpdatedAt: "${this.toISOString(page.metadata?.updatedAt) || ''}"`,
    ]

    if (page.metadata?.parentId) {
      frontmatter.push(`confluenceParentId: "${page.metadata.parentId}"`)
    }

    if (page.metadata?.labels && page.metadata.labels.length > 0) {
      frontmatter.push(`confluenceLabels:`)
      for (const label of page.metadata.labels) {
        frontmatter.push(`  - "${label}"`)
      }
    }

    frontmatter.push(`exportedAt: "${new Date().toISOString()}"`)
    frontmatter.push(`exportedBy: "conflu-exporter-extension"`)
    frontmatter.push('---')

    return frontmatter.join('\n')
  }

  /**
   * Escape YAML special characters
   */
  private escapeYaml(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\n/g, '\\n')
  }

  /**
   * Safely convert date value to ISO string
   * Handles both Date objects and ISO string values (from message serialization)
   */
  private toISOString(dateValue: Date | string | undefined): string | undefined {
    if (!dateValue) {
      return undefined
    }

    // If already a string (serialized Date), return as-is
    if (typeof dateValue === 'string') {
      return dateValue
    }

    // If Date object, convert to ISO string
    if (dateValue instanceof Date) {
      return dateValue.toISOString()
    }

    return undefined
  }

  /**
   * Clean up generated markdown
   */
  private cleanupMarkdown(markdown: string): string {
    // Remove excessive blank lines (max 2 consecutive)
    markdown = markdown.replace(/\n{3,}/g, '\n\n')

    // Trim whitespace
    markdown = markdown.trim()

    // Ensure file ends with newline
    if (!markdown.endsWith('\n')) {
      markdown += '\n'
    }

    return markdown
  }
}
