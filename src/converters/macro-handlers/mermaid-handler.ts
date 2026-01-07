import { ParsedMacro, MacroParser } from '../macro-parser.js'
import { getLogger } from '../../cli/ui/logger.js'

/**
 * CRITICAL: Mermaid Handler
 * Extracts Mermaid diagram source code from Confluence macros
 * and converts to markdown code fence format
 *
 * Supports:
 * 1. Built-in Mermaid macro (plain text body)
 * 2. Mermaid for Confluence plugin (attachment-based .mmd files)
 *
 * This ensures diagrams are exported as SOURCE CODE, not images,
 * maintaining full fidelity and sync compatibility
 */
export class MermaidHandler {
  private logger = getLogger()
  private macroParser: MacroParser
  private attachmentContentCache: Map<string, string> = new Map()

  constructor(macroParser: MacroParser) {
    this.macroParser = macroParser
  }

  /**
   * Set attachment content for mermaid files (.mmd)
   * Called by content fetcher when downloading attachments
   */
  setAttachmentContent(filename: string, content: string): void {
    this.attachmentContentCache.set(filename, content)
    this.logger.debug(`Cached mermaid attachment: ${filename}`)
  }

  /**
   * Clear attachment cache
   */
  clearCache(): void {
    this.attachmentContentCache.clear()
  }

  /**
   * Convert Mermaid macros in storage content to markdown code fences
   */
  process(storageContent: string): string {
    const mermaidMacros = this.macroParser.findMacrosByName(storageContent, 'mermaid')

    if (mermaidMacros.length === 0) {
      return storageContent
    }

    this.logger.info(`Processing ${mermaidMacros.length} Mermaid diagrams...`)

    let processedContent = storageContent

    for (const macro of mermaidMacros) {
      const markdown = this.convertToMarkdown(macro)
      if (markdown) {
        // Replace the original macro XML with markdown code fence
        processedContent = processedContent.replace(macro.rawXml, markdown)
      }
    }

    return processedContent
  }

  /**
   * Convert a Mermaid macro to markdown code fence
   * Handles both built-in macro and Mermaid for Confluence plugin
   */
  private convertToMarkdown(macro: ParsedMacro): string | null {
    let diagramSource = ''

    // Case 1: Built-in Mermaid macro with plain text body
    if (this.macroParser.hasPlainTextBody(macro) && macro.body) {
      diagramSource = macro.body.trim()
    }
    // Case 2: Mermaid for Confluence plugin - loads from attachment
    else {
      // Check for attachment parameter (Mermaid for Confluence plugin)
      const attachmentName = this.macroParser.getMacroParameter(macro, 'attachment')
      const filename = this.macroParser.getMacroParameter(macro, 'name') || attachmentName

      if (filename && filename.endsWith('.mmd')) {
        // Try to get content from cache
        const cachedContent = this.attachmentContentCache.get(filename)
        if (cachedContent) {
          diagramSource = cachedContent.trim()
          this.logger.debug(
            `Using cached mermaid content from attachment: ${filename}`,
          )
        } else {
          this.logger.warn(
            `Mermaid attachment ${filename} not found in cache. ` +
              `Make sure to download attachments first.`,
          )
          // Return placeholder with instruction
          return (
            `\n\n> **Mermaid Diagram:** ${filename}\n` +
            `> \n` +
            `> _This diagram uses the "Mermaid for Confluence" plugin._\n` +
            `> _Download the attachment \`${filename}\` to view the diagram source._\n\n`
          )
        }
      } else {
        this.logger.warn(
          'Mermaid macro found without plain text body or attachment reference',
        )
        return null
      }
    }

    if (!diagramSource) {
      this.logger.warn('Mermaid macro found with empty diagram source')
      return null
    }

    // Get optional parameters
    const theme = this.macroParser.getMacroParameter(macro, 'theme')
    const width = this.macroParser.getMacroParameter(macro, 'width')
    const height = this.macroParser.getMacroParameter(macro, 'height')

    // Build markdown code fence
    let markdown = '```mermaid\n'
    markdown += diagramSource
    markdown += '\n```'

    // Add metadata as HTML comment if parameters exist
    if (theme || width || height) {
      const metadata = []
      if (theme) metadata.push(`theme: ${theme}`)
      if (width) metadata.push(`width: ${width}`)
      if (height) metadata.push(`height: ${height}`)

      markdown += `\n<!-- Mermaid options: ${metadata.join(', ')} -->`
    }

    this.logger.debug(`Converted Mermaid diagram (${diagramSource.length} chars)`)

    return markdown
  }

  /**
   * Extract all Mermaid diagrams from storage content
   * Returns array of diagram sources
   */
  extractDiagrams(storageContent: string): string[] {
    const mermaidMacros = this.macroParser.findMacrosByName(storageContent, 'mermaid')
    const diagrams: string[] = []

    for (const macro of mermaidMacros) {
      if (this.macroParser.hasPlainTextBody(macro) && macro.body) {
        diagrams.push(macro.body.trim())
      }
    }

    return diagrams
  }

  /**
   * Validate Mermaid diagram syntax
   * Returns true if syntax appears valid
   */
  validateDiagram(diagramSource: string): boolean {
    // Basic validation: check for diagram type keywords
    const validKeywords = [
      'graph',
      'flowchart',
      'sequenceDiagram',
      'classDiagram',
      'stateDiagram',
      'erDiagram',
      'gantt',
      'pie',
      'journey',
      'gitGraph',
      'mindmap',
      'timeline',
    ]

    const trimmed = diagramSource.trim().toLowerCase()
    return validKeywords.some((keyword) => trimmed.startsWith(keyword.toLowerCase()))
  }
}

export function createMermaidHandler(macroParser: MacroParser): MermaidHandler {
  return new MermaidHandler(macroParser)
}
