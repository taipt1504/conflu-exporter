import { MacroHandler, MacroConversionContext } from '../base-macro-handler.js'
import { ParsedMacro, MacroParser } from '../../macro-parser.js'
import { getLogger } from '../../../cli/ui/logger.js'

/**
 * Base class for all Mermaid diagram handlers
 * Provides common functionality for different Mermaid macro variants
 */
export abstract class BaseMermaidHandler implements MacroHandler {
  protected logger = getLogger()
  protected macroParser: MacroParser
  protected diagramPlaceholders: Map<string, string> = new Map()
  protected diagramMetadata: Map<string, string> = new Map()

  constructor(macroParser: MacroParser) {
    this.macroParser = macroParser
  }

  abstract getMacroName(): string

  /**
   * Default implementation - can be overridden by subclasses
   */
  canHandle(macro: ParsedMacro): boolean {
    return macro.name === this.getMacroName()
  }

  /**
   * Convert macro to placeholder HTML
   */
  async convert(macro: ParsedMacro, context: MacroConversionContext): Promise<string | null> {
    const diagramSource = await this.extractDiagramSource(macro, context)

    if (!diagramSource) {
      this.logger.warn(`No diagram source found for macro '${macro.name}'`)
      return null
    }

    return this.createPlaceholder(diagramSource, macro)
  }

  /**
   * Extract diagram source from macro
   * Must be implemented by subclasses
   */
  protected abstract extractDiagramSource(
    macro: ParsedMacro,
    context: MacroConversionContext,
  ): Promise<string | null>

  /**
   * Create HTML placeholder for the diagram
   */
  protected createPlaceholder(diagramSource: string, macro: ParsedMacro): string {
    const placeholderId = `MERMAID_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.diagramPlaceholders.set(placeholderId, diagramSource)

    // Extract optional parameters
    const theme = this.macroParser.getMacroParameter(macro, 'theme')
    const width = this.macroParser.getMacroParameter(macro, 'width')
    const height = this.macroParser.getMacroParameter(macro, 'height')

    // Add metadata if parameters exist
    if (theme || width || height) {
      const metadata = []
      if (theme) metadata.push(`theme: ${theme}`)
      if (width) metadata.push(`width: ${width}`)
      if (height) metadata.push(`height: ${height}`)

      this.diagramMetadata.set(placeholderId, metadata.join(', '))
    }

    this.logger.debug(
      `Created placeholder ${placeholderId} for Mermaid diagram (${diagramSource.length} chars)`,
    )

    // Wrap in code tag to ensure Turndown preserves it
    return `<code data-mermaid-placeholder="${placeholderId}">MERMAID_PLACEHOLDER_${placeholderId}</code>`
  }

  /**
   * Decode HTML entities in text
   */
  protected decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      // Vietnamese characters
      '&aacute;': 'á',
      '&agrave;': 'à',
      '&atilde;': 'ã',
      '&acirc;': 'â',
      '&eacute;': 'é',
      '&egrave;': 'è',
      '&ecute;': 'ẽ',
      '&ecirc;': 'ê',
      '&iacute;': 'í',
      '&igrave;': 'ì',
      '&itilde;': 'ĩ',
      '&oacute;': 'ó',
      '&ograve;': 'ò',
      '&otilde;': 'õ',
      '&ocirc;': 'ô',
      '&uacute;': 'ú',
      '&ugrave;': 'ù',
      '&utilde;': 'ũ',
      '&yacute;': 'ý',
      '&ygrave;': 'ỳ',
      '&ytilde;': 'ỹ',
    }

    let decoded = text
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char)
    }

    // Decode numeric entities
    decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    decoded = decoded.replace(
      /&#x([0-9a-fA-F]+);/g,
      (_, hex) => String.fromCharCode(parseInt(hex, 16)),
    )

    return decoded
  }

  /**
   * Replace placeholders with actual mermaid code blocks
   */
  replacePlaceholders(markdown: string): string {
    this.logger.debug(`Starting placeholder replacement. Input length: ${markdown.length} chars`)
    this.logger.debug(`Placeholders to replace: ${this.diagramPlaceholders.size}`)

    let result = markdown

    for (const [placeholderId, diagramSource] of this.diagramPlaceholders.entries()) {
      let codeBlock = `\n\`\`\`mermaid\n${diagramSource}\n\`\`\`\n`

      if (this.diagramMetadata.has(placeholderId)) {
        codeBlock += `\n<!-- Mermaid options: ${this.diagramMetadata.get(placeholderId)} -->\n`
      }

      const placeholderText = `MERMAID_PLACEHOLDER_${placeholderId}`
      const backtickPattern = `\`${placeholderText}\``

      if (result.includes(backtickPattern)) {
        result = result.replace(backtickPattern, codeBlock)
        this.logger.debug(
          `Replaced placeholder ${placeholderId.substring(0, 30)}... with mermaid code block`,
        )
      } else if (result.includes(placeholderText)) {
        result = result.replace(placeholderText, codeBlock)
        this.logger.debug(
          `Replaced plain placeholder ${placeholderId.substring(0, 30)}... with mermaid code block`,
        )
      } else {
        this.logger.warn(
          `Placeholder ${placeholderId.substring(0, 30)}... not found in markdown (searched for: ${backtickPattern})`,
        )
      }
    }

    this.logger.debug(`After replacement. Output length: ${result.length} chars`)

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
}
