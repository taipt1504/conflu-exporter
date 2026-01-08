import { BaseMermaidHandler } from './base-mermaid-handler.js'
import { ParsedMacro } from '../../macro-parser.js'
import { MacroConversionContext } from '../base-macro-handler.js'

/**
 * Handler for Mermaid for Confluence plugin macros
 * Supports:
 * - mermaid-cloud (newer plugin version)
 * - mermaid-macro (older plugin version)
 *
 * These plugins store diagram source in text/plain attachments without file extension
 */
export class PluginMermaidHandler extends BaseMermaidHandler {
  private supportedMacroNames: string[]

  constructor(macroParser: any, macroNames: string[] = ['mermaid-cloud', 'mermaid-macro']) {
    super(macroParser)
    this.supportedMacroNames = macroNames
  }

  getMacroName(): string {
    // Return first supported name as primary
    return this.supportedMacroNames[0]
  }

  canHandle(macro: ParsedMacro): boolean {
    return this.supportedMacroNames.includes(macro.name)
  }

  protected async extractDiagramSource(
    macro: ParsedMacro,
    context: MacroConversionContext,
  ): Promise<string | null> {
    // Plugin macros always use attachment references
    const filename = this.macroParser.getMacroAttachmentReference(macro)

    if (!filename) {
      this.logger.warn(`No filename parameter found for ${macro.name} macro`)
      return null
    }

    // Decode HTML entities in filename (e.g., "luồng r&uacute;t tiền" -> "luồng rút tiền")
    const decodedFilename = this.decodeHtmlEntities(filename)
    this.logger.debug(`Decoded filename: ${decodedFilename}`)

    // Try to get content from cache
    // Note: Plugin stores diagrams as text/plain attachments without extension
    const cachedContent = context.attachmentCache.get(decodedFilename)

    if (cachedContent) {
      this.logger.debug(
        `Using cached mermaid content from attachment: ${decodedFilename} (${cachedContent.length} chars)`,
      )
      return cachedContent.trim()
    } else {
      this.logger.warn(
        `Mermaid attachment ${decodedFilename} not found in cache. ` +
          `Original filename: ${filename}. ` +
          `Available files: ${Array.from(context.attachmentCache.keys()).join(', ')}`,
      )
      return this.createAttachmentPlaceholder(decodedFilename)
    }
  }

  private createAttachmentPlaceholder(filename: string): string {
    return (
      `\n\n> **Mermaid Diagram:** ${filename}\n` +
      `> \n` +
      `> _This diagram uses the "Mermaid for Confluence" plugin._\n` +
      `> _Download the attachment \`${filename}\` to view the diagram source._\n\n`
    )
  }
}
