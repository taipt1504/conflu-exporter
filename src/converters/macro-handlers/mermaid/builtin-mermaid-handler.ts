import { BaseMermaidHandler } from './base-mermaid-handler.js'
import { ParsedMacro } from '../../macro-parser.js'
import { MacroConversionContext } from '../base-macro-handler.js'

/**
 * Handler for built-in Confluence mermaid macro
 * Supports:
 * - Plain text body with mermaid source
 * - .mmd file attachments
 */
export class BuiltinMermaidHandler extends BaseMermaidHandler {
  getMacroName(): string {
    return 'mermaid'
  }

  protected async extractDiagramSource(
    macro: ParsedMacro,
    context: MacroConversionContext,
  ): Promise<string | null> {
    // Case 1: Plain text body
    if (this.macroParser.hasPlainTextBody(macro) && macro.body) {
      return macro.body.trim()
    }

    // Case 2: .mmd file attachment
    const filename = this.macroParser.getMacroAttachmentReference(macro)
    if (filename && (filename.endsWith('.mmd') || filename.endsWith('.mermaid'))) {
      const cachedContent = context.attachmentCache.get(filename)
      if (cachedContent) {
        this.logger.debug(`Using mermaid content from .mmd file: ${filename}`)
        return cachedContent.trim()
      } else {
        this.logger.warn(`Mermaid attachment ${filename} not found in cache`)
        return this.createAttachmentPlaceholder(filename)
      }
    }

    return null
  }

  private createAttachmentPlaceholder(filename: string): string {
    return (
      `> **Mermaid Diagram:** ${filename}\n` +
      `> \n` +
      `> _Download the attachment \`${filename}\` to view the diagram source._\n`
    )
  }
}
