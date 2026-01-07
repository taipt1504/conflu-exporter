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
  private diagramPlaceholders: Map<string, string> = new Map()
  private diagramMetadata: Map<string, string> = new Map()

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
    // Support both built-in 'mermaid' macro and 'mermaid-cloud' from Mermaid for Confluence plugin
    const builtinMacros = this.macroParser.findMacrosByName(storageContent, 'mermaid')
    const cloudMacros = this.macroParser.findMacrosByName(storageContent, 'mermaid-cloud')
    const mermaidMacros = [...builtinMacros, ...cloudMacros]

    if (mermaidMacros.length === 0) {
      this.logger.debug('No mermaid or mermaid-cloud macros found')
      return storageContent
    }

    this.logger.info(
      `Processing ${mermaidMacros.length} Mermaid diagrams (${builtinMacros.length} built-in, ${cloudMacros.length} cloud plugin)...`,
    )

    let processedContent = storageContent

    for (const macro of mermaidMacros) {
      const html = this.convertToMarkdown(macro)
      if (html) {
        // Replace the original macro XML with HTML pre/code block
        this.logger.debug(`Replacing macro XML (${macro.rawXml.length} chars) with HTML (${html.length} chars)`)
        processedContent = processedContent.replace(macro.rawXml, html)
      }
    }

    this.logger.debug(`After mermaid processing: ${processedContent.length} chars`)
    return processedContent
  }

  /**
   * Convert a Mermaid macro to markdown code fence
   * Handles both built-in macro and Mermaid for Confluence plugin
   */
  private convertToMarkdown(macro: ParsedMacro): string | null {
    let diagramSource = ''

    // Debug: Log macro structure
    this.logger.debug(`Converting ${macro.name} macro`)
    this.logger.debug(`  - Has plain text body: ${this.macroParser.hasPlainTextBody(macro)}`)
    this.logger.debug(`  - Parameters: ${JSON.stringify(macro.parameters)}`)

    // Case 1: Built-in Mermaid macro with plain text body
    if (this.macroParser.hasPlainTextBody(macro) && macro.body) {
      diagramSource = macro.body.trim()
    }
    // Case 2: Mermaid for Confluence plugin - loads from attachment
    else {
      // Use getMacroAttachmentReference which checks multiple parameter names
      // including 'filename' (used by mermaid-cloud), 'attachment', 'name', etc.
      const filename = this.macroParser.getMacroAttachmentReference(macro)

      this.logger.debug(`  - Attachment filename: ${filename || 'N/A'}`)

      if (filename) {
        // Try to get content from cache
        // Note: Mermaid for Confluence plugin stores diagrams as text/plain attachments
        // with just the diagram name (no extension), e.g., "NHLAD" instead of "NHLAD.mmd"
        const cachedContent = this.attachmentContentCache.get(filename)
        if (cachedContent) {
          diagramSource = cachedContent.trim()
          this.logger.debug(
            `Using cached mermaid content from attachment: ${filename} (${diagramSource.length} chars)`,
          )
        } else {
          this.logger.warn(
            `Mermaid attachment ${filename} not found in cache. ` +
              `Make sure to download attachments first. Available files: ${Array.from(this.attachmentContentCache.keys()).join(', ')}`,
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

    // Use code tag with special marker - Turndown preserves code elements better
    const placeholderId = `MERMAID_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.diagramPlaceholders.set(placeholderId, diagramSource)

    // Wrap in code tag to ensure Turndown preserves it
    // Format: <code data-mermaid-placeholder="ID">PLACEHOLDER_TEXT</code>
    let placeholder = `<code data-mermaid-placeholder="${placeholderId}">MERMAID_PLACEHOLDER_${placeholderId}</code>`

    // Add metadata if parameters exist
    if (theme || width || height) {
      const metadata = []
      if (theme) metadata.push(`theme: ${theme}`)
      if (width) metadata.push(`width: ${width}`)
      if (height) metadata.push(`height: ${height}`)

      this.diagramMetadata.set(placeholderId, metadata.join(', '))
    }

    this.logger.debug(`Created placeholder ${placeholderId} for Mermaid diagram (${diagramSource.length} chars)`)

    return placeholder
  }

  /**
   * Replace placeholders in markdown with actual Mermaid code blocks
   * Call this AFTER HTML-to-markdown conversion
   */
  replacePlaceholders(markdown: string): string {
    this.logger.debug(`Starting placeholder replacement. Input length: ${markdown.length} chars`)
    this.logger.debug(`Placeholders to replace: ${this.diagramPlaceholders.size}`)

    let result = markdown

    for (const [placeholderId, diagramSource] of this.diagramPlaceholders.entries()) {
      // Build markdown code fence
      let codeBlock = `\n\`\`\`mermaid\n${diagramSource}\n\`\`\`\n`

      // Add metadata if exists
      if (this.diagramMetadata.has(placeholderId)) {
        codeBlock += `\n<!-- Mermaid options: ${this.diagramMetadata.get(placeholderId)} -->\n`
      }

      // Match the placeholder text (Turndown converts <code> to backticks)
      // Pattern: `MERMAID_PLACEHOLDER_${placeholderId}`
      const placeholderText = `MERMAID_PLACEHOLDER_${placeholderId}`
      const backtickPattern = `\`${placeholderText}\``

      if (result.includes(backtickPattern)) {
        result = result.replace(backtickPattern, codeBlock)
        this.logger.debug(`Replaced placeholder ${placeholderId.substring(0, 30)}... with mermaid code block`)
      } else if (result.includes(placeholderText)) {
        // Fallback without backticks
        result = result.replace(placeholderText, codeBlock)
        this.logger.debug(`Replaced plain placeholder ${placeholderId.substring(0, 30)}... with mermaid code block`)
      } else {
        this.logger.warn(`Placeholder ${placeholderId.substring(0, 30)}... not found in markdown (searched for: ${backtickPattern})`)
      }
    }

    this.logger.debug(`After replacement. Output length: ${result.length} chars`)

    // Clear placeholders after replacement
    this.clearPlaceholders()

    return result
  }

  /**
   * Clear diagram placeholders and metadata
   */
  clearPlaceholders(): void {
    this.diagramPlaceholders.clear()
    this.diagramMetadata.clear()
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
