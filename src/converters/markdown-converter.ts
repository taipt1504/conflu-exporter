import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { BaseConverter, ConvertOptions, ConvertResult } from './base-converter.js'
import { ConfluencePage } from '../types.js'
import type { MarkdownOptions } from '../config/config-schema.js'

/**
 * Markdown Converter
 * Converts Confluence pages to Markdown with full metadata preservation
 *
 * CRITICAL Features:
 * - Full frontmatter metadata for bidirectional sync
 * - Preserves macro source code (Mermaid, code blocks)
 * - Processes both storage and view formats
 * - Custom Turndown rules for Confluence elements
 */
export class MarkdownConverter extends BaseConverter {
  private turndownService: TurndownService
  private options: MarkdownOptions

  constructor(options?: MarkdownOptions) {
    super()

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

    // Add custom rules
    this.addCustomRules(service)

    return service
  }

  /**
   * Add custom Turndown rules for Confluence elements
   */
  private addCustomRules(service: TurndownService): void {
    // Rule: Preserve code blocks that are already in markdown format
    service.addRule('preserveCodeBlocks', {
      filter: (node: any) => {
        if (node.nodeName === 'PRE') {
          const code = node.querySelector('code')
          if (code && code.textContent?.startsWith('```')) {
            return true
          }
        }
        return false
      },
      replacement: (content) => {
        return `\n${content}\n`
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

        // Extract filename from URL path
        // URL format: /download/attachments/pageId/filename.png?...
        // or: /attachments/pageId/filename.png?...
        let filename = src.split('/').pop() || 'image.png'

        // Remove query string from filename
        if (filename.includes('?')) {
          filename = filename.split('?')[0]
        }

        // Decode URL-encoded characters (e.g., %20 -> space, %28 -> (, %29 -> ))
        try {
          filename = decodeURIComponent(filename)
        } catch {
          // If decoding fails, use the original filename
        }

        // Build relative path - use the decoded filename
        const relativePath = `./assets/${filename}`

        // Wrap path in angle brackets to support filenames with spaces and special characters
        // This is the standard Markdown way to handle URLs with spaces
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

        // Extract page ID from Confluence URL if possible
        const pageIdMatch = href.match(/\/pages\/(\d+)/)
        const pageId = pageIdMatch ? pageIdMatch[1] : null

        let markdown = `[${content}](${href}${title ? ` "${title}"` : ''})`

        if (pageId) {
          markdown += ` <!-- Confluence Page ID: ${pageId} -->`
        }

        return markdown
      },
    })

    // Rule: Handle Confluence attachment links (PDFs, DOCX, ZIP, etc.)
    service.addRule('confluenceAttachments', {
      filter: (node: any) => {
        if (node.nodeName !== 'A') return false
        // Skip if already handled as Confluence internal link
        if (node.getAttribute('data-confluence-link') === 'true') return false
        const href = node.getAttribute('href') || ''
        // Match attachment download URLs
        return href.includes('/download/') || href.includes('/attachments/')
      },
      replacement: (content, node: any) => {
        const href = node.getAttribute('href') || ''

        // Extract filename from URL path
        let filename = href.split('/').pop() || 'file'

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

        // Build relative path to assets folder
        const relativePath = `./assets/${filename}`

        // Wrap path in angle brackets to support filenames with spaces
        return `[${content}](<${relativePath}>)`
      },
    })

    // Rule: Handle blockquotes (already processed by content handler)
    service.addRule('blockquotes', {
      filter: 'blockquote',
      replacement: (content) => {
        // Content already has '>' prefix from content handler
        if (content.trim().startsWith('>')) {
          return `\n${content}\n`
        }

        // Otherwise, add blockquote markers
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
          // Extract table rows - use Array.from() to ensure iterable
          const rows: string[][] = []
          const tableRowNodes = node.querySelectorAll ? node.querySelectorAll('tr') : null
          const tableRows: any[] = tableRowNodes ? Array.from(tableRowNodes) : []

          if (tableRows.length === 0) {
            // Fallback: return original content if no rows found
            return _content || '\n'
          }

          for (const tr of tableRows) {
            const cells: string[] = []
            const tableCellNodes = tr.querySelectorAll ? tr.querySelectorAll('th, td') : null
            const tableCells: any[] = tableCellNodes ? Array.from(tableCellNodes) : []

            for (const cell of tableCells) {
              // Clean cell content and remove excessive whitespace
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

          // Determine if first row is header (check for <th> tags)
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
          // Graceful fallback on any error
          console.warn('Table conversion failed, using fallback:', error)
          return _content || '\n'
        }
      },
    })
  }

  /**
   * Convert Confluence page to Markdown
   */
  async convert(page: ConfluencePage, _options?: ConvertOptions): Promise<ConvertResult> {
    this.validatePage(page)

    this.logger.info(`Converting page ${page.id} to Markdown...`)

    // Process content (storage + view)
    const processed = await this.processContent(page)

    // Convert HTML to Markdown
    let markdown = this.turndownService.turndown(processed.html)

    // Replace mermaid placeholders with actual code blocks (CRITICAL: Must be done AFTER Turndown)
    markdown = this.htmlProcessor.replaceMermaidPlaceholders(markdown)

    // Add frontmatter if enabled
    if (this.options.frontmatter) {
      const frontmatter = this.generateFrontmatter(page, processed)
      markdown = `${frontmatter}\n${markdown}`
    }

    // Clean up markdown
    markdown = this.cleanupMarkdown(markdown)

    this.logger.info(`Converted page ${page.id}: ${markdown.length} chars`)

    const baseMetadata = this.generateMetadata(page)

    return {
      content: markdown,
      metadata: {
        format: 'markdown',
        pageId: baseMetadata.pageId,
        pageTitle: baseMetadata.pageTitle,
        exportedAt: new Date(),
        ...baseMetadata,
        macros: processed.macros,
        imageCount: processed.images.length,
        linkCount: processed.links.length,
      },
    }
  }

  /**
   * Generate YAML frontmatter with FULL metadata
   * CRITICAL: This metadata is essential for bidirectional sync
   */
  private generateFrontmatter(page: ConfluencePage, processed: any): string {
    const metadata = this.generateMetadata(page)

    const frontmatter = [
      '---',
      `title: "${this.escapeYaml(page.title)}"`,
      `confluenceId: "${page.id}"`,
      `confluenceSpaceKey: "${page.spaceKey}"`,
      `confluenceUrl: "${metadata.url || ''}"`,
      `confluenceVersion: ${page.version || 1}`,
      `confluenceCreatedBy: "${metadata.createdBy || ''}"`,
      `confluenceCreatedAt: "${metadata.createdAt || ''}"`,
      `confluenceUpdatedAt: "${metadata.updatedAt || ''}"`,
    ]

    if (metadata.parentId) {
      frontmatter.push(`confluenceParentId: "${metadata.parentId}"`)
    }

    if (metadata.labels && metadata.labels.length > 0) {
      frontmatter.push(`confluenceLabels:`)
      for (const label of metadata.labels) {
        frontmatter.push(`  - "${label}"`)
      }
    }

    // Add macro statistics
    if (processed.macros) {
      frontmatter.push(`macros:`)
      frontmatter.push(`  mermaid: ${processed.macros.mermaid}`)
      frontmatter.push(`  code: ${processed.macros.code}`)
      frontmatter.push(`  diagrams: ${processed.macros.diagrams}`)
      frontmatter.push(`  panels: ${processed.macros.panels}`)
    }

    frontmatter.push(`exportedAt: "${metadata.exportedAt}"`)
    frontmatter.push(`exportedBy: "conflu-exporter"`)
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

  /**
   * Get file extension
   */
  getFileExtension(): string {
    return '.md'
  }

  /**
   * Get format name
   */
  getFormatName(): string {
    return 'markdown'
  }
}

export function createMarkdownConverter(options?: MarkdownOptions): MarkdownConverter {
  return new MarkdownConverter(options)
}
