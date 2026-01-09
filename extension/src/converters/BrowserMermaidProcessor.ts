/**
 * Browser-compatible Mermaid processor
 * Handles extraction and conversion of Mermaid diagrams from Confluence macros
 */

import { BrowserMacroParser, ParsedMacro } from './BrowserMacroParser'

/**
 * Mermaid macro variants supported
 */
const BUILTIN_MACROS = ['mermaid']
const PLUGIN_MACROS = ['mermaid-cloud', 'mermaid-macro']
const ALL_MACROS = [...BUILTIN_MACROS, ...PLUGIN_MACROS]

interface MacroConversionContext {
  storageContent: string
  attachmentCache: Map<string, string>
  pageId?: string
  spaceKey?: string
}

/**
 * Browser-compatible Mermaid Processor
 * Extracts mermaid diagrams from macros and converts to markdown code blocks
 */
export class BrowserMermaidProcessor {
  private macroParser: BrowserMacroParser
  private diagramPlaceholders: Map<string, string> = new Map()
  private attachmentCache: Map<string, string> = new Map()

  constructor() {
    this.macroParser = new BrowserMacroParser()
  }

  /**
   * Set mermaid attachment content cache
   */
  setMermaidAttachments(attachments: Map<string, string>): void {
    this.attachmentCache = attachments
    console.log(`[BrowserMermaidProcessor] Cached ${attachments.size} mermaid attachment(s)`)
  }

  /**
   * Clear attachment cache
   */
  clearCache(): void {
    this.attachmentCache.clear()
    this.diagramPlaceholders.clear()
  }

  /**
   * Process all mermaid macros in storage content
   */
  async process(storageContent: string): Promise<string> {
    // Find all mermaid macros
    const allMacros = ALL_MACROS.flatMap((name) =>
      this.macroParser.findMacrosByName(storageContent, name)
    )

    if (allMacros.length === 0) {
      console.log('[BrowserMermaidProcessor] No mermaid macros found')
      return storageContent
    }

    console.log(`[BrowserMermaidProcessor] Processing ${allMacros.length} Mermaid diagrams...`)

    const context: MacroConversionContext = {
      storageContent,
      attachmentCache: this.attachmentCache,
    }

    let processedContent = storageContent

    // Process each macro
    for (const macro of allMacros) {
      try {
        const html = await this.convertMacro(macro, context)
        if (html) {
          // Replace macro XML with placeholder HTML
          processedContent = this.replaceMacroInContent(processedContent, macro, html)
        }
      } catch (error) {
        console.error(`[BrowserMermaidProcessor] Failed to process macro '${macro.name}':`, error)
      }
    }

    console.log(`[BrowserMermaidProcessor] Processed content length: ${processedContent.length} chars`)
    console.log(
      `[BrowserMermaidProcessor] Placeholders created: ${this.diagramPlaceholders.size}`
    )

    return processedContent
  }

  /**
   * Convert a single macro to placeholder HTML
   */
  private async convertMacro(
    macro: ParsedMacro,
    context: MacroConversionContext
  ): Promise<string | null> {
    const diagramSource = await this.extractDiagramSource(macro, context)

    if (!diagramSource) {
      console.warn(`[BrowserMermaidProcessor] No diagram source found for macro '${macro.name}'`)
      return null
    }

    return this.createPlaceholder(diagramSource, macro)
  }

  /**
   * Extract diagram source from macro
   */
  private async extractDiagramSource(
    macro: ParsedMacro,
    context: MacroConversionContext
  ): Promise<string | null> {
    // Built-in mermaid macro - has body with diagram source
    if (BUILTIN_MACROS.includes(macro.name)) {
      if (macro.body && macro.bodyType === 'plain') {
        return macro.body.trim()
      }
      console.warn(`[BrowserMermaidProcessor] Built-in mermaid macro has no plain text body`)
      return null
    }

    // Plugin mermaid macro - references attachment file
    if (PLUGIN_MACROS.includes(macro.name)) {
      const filename = this.macroParser.getMacroAttachmentReference(macro)

      if (!filename) {
        console.warn(`[BrowserMermaidProcessor] No filename parameter found for ${macro.name} macro`)
        return null
      }

      // Decode HTML entities in filename
      const decodedFilename = this.decodeHtmlEntities(filename)
      console.log(`[BrowserMermaidProcessor] Looking for attachment: ${decodedFilename}`)

      // Try to get content from cache
      const cachedContent = context.attachmentCache.get(decodedFilename)

      if (cachedContent) {
        console.log(
          `[BrowserMermaidProcessor] Using cached content for ${decodedFilename} (${cachedContent.length} chars)`
        )
        return cachedContent.trim()
      } else {
        console.warn(
          `[BrowserMermaidProcessor] Attachment ${decodedFilename} not found in cache. ` +
            `Available: ${Array.from(context.attachmentCache.keys()).join(', ')}`
        )
        return this.createAttachmentPlaceholder(decodedFilename)
      }
    }

    return null
  }

  /**
   * Create HTML placeholder for the diagram
   */
  private createPlaceholder(diagramSource: string, macro: ParsedMacro): string {
    const placeholderId = `MERMAID_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.diagramPlaceholders.set(placeholderId, diagramSource)

    console.log(
      `[BrowserMermaidProcessor] Created placeholder ${placeholderId} (${diagramSource.length} chars)`
    )

    // Wrap in div with data attribute for easy identification
    return `<div data-mermaid-placeholder="${placeholderId}"><code>MERMAID_PLACEHOLDER_${placeholderId}</code></div>`
  }

  /**
   * Create placeholder for missing attachment
   */
  private createAttachmentPlaceholder(filename: string): string {
    return (
      `\n\n> **Mermaid Diagram:** ${filename}\n` +
      `> \n` +
      `> _This diagram uses the "Mermaid for Confluence" plugin._\n` +
      `> _Download the attachment \`${filename}\` to view the diagram source._\n\n`
    )
  }

  /**
   * Replace macro XML in content with placeholder HTML
   */
  private replaceMacroInContent(content: string, macro: ParsedMacro, html: string): string {
    // Try exact match first
    if (content.includes(macro.rawXml)) {
      console.log('[BrowserMermaidProcessor] Replaced macro XML (exact match)')
      return content.replace(macro.rawXml, html)
    }

    // Fallback: Find and replace by unique macro-id
    const macroIdMatch = macro.rawXml.match(/ac:macro-id="([^"]+)"/)
    if (macroIdMatch) {
      const macroId = macroIdMatch[1]
      const macroStart = content.indexOf(`ac:macro-id="${macroId}"`)

      if (macroStart >= 0) {
        const beforeMacroId = content.substring(0, macroStart)
        const tagStart = beforeMacroId.lastIndexOf('<ac:structured-macro')

        if (tagStart >= 0) {
          const afterTagStart = content.substring(tagStart)
          const tagEnd =
            afterTagStart.indexOf('</ac:structured-macro>') + '</ac:structured-macro>'.length

          if (tagEnd > 0) {
            const originalMacroXml = afterTagStart.substring(0, tagEnd)
            console.log('[BrowserMermaidProcessor] Replaced macro XML (by macro ID)')
            return content.replace(originalMacroXml, html)
          }
        }
      }
    }

    console.warn(`[BrowserMermaidProcessor] Could not replace macro XML`)
    return content
  }

  /**
   * Replace placeholders in markdown with actual mermaid code blocks
   * Call this AFTER converting HTML to Markdown
   */
  replacePlaceholders(markdown: string): string {
    console.log(
      `[BrowserMermaidProcessor] Replacing ${this.diagramPlaceholders.size} placeholders in markdown`
    )

    let result = markdown

    for (const [placeholderId, diagramSource] of this.diagramPlaceholders.entries()) {
      const codeBlock = `\n\`\`\`mermaid\n${diagramSource}\n\`\`\`\n`
      const placeholderText = `MERMAID_PLACEHOLDER_${placeholderId}`

      // Try different patterns
      const backtickPattern = `\`${placeholderText}\``
      const codePattern = `<code>${placeholderText}</code>`

      if (result.includes(backtickPattern)) {
        result = result.replace(backtickPattern, codeBlock)
        console.log(`[BrowserMermaidProcessor] Replaced backtick placeholder`)
      } else if (result.includes(codePattern)) {
        result = result.replace(codePattern, codeBlock)
        console.log(`[BrowserMermaidProcessor] Replaced code tag placeholder`)
      } else if (result.includes(placeholderText)) {
        result = result.replace(placeholderText, codeBlock)
        console.log(`[BrowserMermaidProcessor] Replaced plain placeholder`)
      } else {
        console.warn(`[BrowserMermaidProcessor] Placeholder not found in markdown: ${placeholderId}`)
      }
    }

    this.clearPlaceholders()
    return result
  }

  /**
   * Clear placeholders
   */
  private clearPlaceholders(): void {
    this.diagramPlaceholders.clear()
  }

  /**
   * Decode HTML entities in text
   */
  private decodeHtmlEntities(text: string): string {
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
      '&ecirc;': 'ê',
      '&iacute;': 'í',
      '&igrave;': 'ì',
      '&oacute;': 'ó',
      '&ograve;': 'ò',
      '&ocirc;': 'ô',
      '&uacute;': 'ú',
      '&ugrave;': 'ù',
      '&yacute;': 'ý',
      '&ygrave;': 'ỳ',
    }

    let decoded = text
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char)
    }

    // Decode numeric entities
    decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    decoded = decoded.replace(
      /&#x([0-9a-fA-F]+);/g,
      (_, hex) => String.fromCharCode(parseInt(hex, 16))
    )

    return decoded
  }
}
