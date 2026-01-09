import { ParsedMacro, MacroParser } from '../macro-parser.js'
import { getLogger } from '../../cli/ui/logger.js'

/**
 * Code Block Handler
 * Converts Confluence code macros to markdown code fences
 * Preserves language, line numbers, and source code
 */
export class CodeHandler {
  private logger = getLogger()
  private macroParser: MacroParser

  constructor(macroParser: MacroParser) {
    this.macroParser = macroParser
  }

  /**
   * Convert code macros in storage content to markdown code fences
   */
  process(storageContent: string): string {
    const codeMacros = this.macroParser.findMacrosByName(storageContent, 'code')

    if (codeMacros.length === 0) {
      return storageContent
    }

    this.logger.info(`Processing ${codeMacros.length} code blocks...`)

    let processedContent = storageContent

    for (const macro of codeMacros) {
      const markdown = this.convertToMarkdown(macro)
      if (markdown) {
        processedContent = processedContent.replace(macro.rawXml, markdown)
      }
    }

    return processedContent
  }

  /**
   * Convert a code macro to markdown code fence
   */
  private convertToMarkdown(macro: ParsedMacro): string | null {
    // Extract code from various possible sources
    let code = ''

    // Try plain text body first (most common)
    if (this.macroParser.hasPlainTextBody(macro)) {
      code = macro.body || ''
    }
    // Try rich text body (might contain code)
    else if (macro.bodyType === 'rich' && macro.body) {
      // Extract text content from rich body, stripping HTML tags
      code = macro.body.replace(/<[^>]+>/g, '').trim()
      this.logger.debug('Extracted code from rich text body')
    }
    // Check for attachment reference (like external file)
    else {
      const attachmentRef = this.macroParser.getMacroAttachmentReference(macro)
      if (attachmentRef) {
        this.logger.info(`Code macro references attachment: ${attachmentRef}`)
        // Create a placeholder indicating the code is in an attachment
        const language = this.macroParser.getMacroParameter(macro, 'language') || ''
        const title = this.macroParser.getMacroParameter(macro, 'title') || attachmentRef
        return (
          `\n> **Code Block:** ${title}\n` +
          `> \n` +
          `> Language: ${language || 'Unknown'}\n` +
          `> Source: [${attachmentRef}](./assets/${attachmentRef})\n\n`
        )
      }

      // No code found in any format
      this.logger.warn('Code macro found without plain text body or attachment')
      const title = this.macroParser.getMacroParameter(macro, 'title') || 'Code Block'
      return `\n> **${title}** _(code content not available)_\n\n`
    }

    if (!code.trim()) {
      this.logger.warn('Code macro has empty content')
      return null
    }

    const language = this.macroParser.getMacroParameter(macro, 'language') || ''
    const linenumbers = this.macroParser.getMacroParameter(macro, 'linenumbers')
    const title = this.macroParser.getMacroParameter(macro, 'title')
    const theme = this.macroParser.getMacroParameter(macro, 'theme')
    const collapse = this.macroParser.getMacroParameter(macro, 'collapse')

    // Build markdown code fence with language
    let markdown = `\`\`\`${language.toLowerCase()}\n`
    markdown += code
    if (!code.endsWith('\n')) {
      markdown += '\n'
    }
    markdown += '```'

    // Add metadata as HTML comment if needed
    const metadata = []
    if (title) metadata.push(`title: ${title}`)
    if (linenumbers === 'true') metadata.push('linenumbers: true')
    if (theme) metadata.push(`theme: ${theme}`)
    if (collapse === 'true') metadata.push('collapse: true')

    if (metadata.length > 0) {
      markdown += `\n<!-- Code block options: ${metadata.join(', ')} -->`
    }

    this.logger.debug(`Converted code block (language: ${language}, ${code.length} chars)`)

    return markdown
  }

  /**
   * Extract all code blocks with metadata
   */
  extractCodeBlocks(storageContent: string): Array<{
    language: string
    code: string
    title?: string
    linenumbers?: boolean
  }> {
    const codeMacros = this.macroParser.findMacrosByName(storageContent, 'code')
    const blocks: Array<{
      language: string
      code: string
      title?: string
      linenumbers?: boolean
    }> = []

    for (const macro of codeMacros) {
      if (this.macroParser.hasPlainTextBody(macro) && macro.body) {
        const language = this.macroParser.getMacroParameter(macro, 'language') || 'text'
        const title = this.macroParser.getMacroParameter(macro, 'title')
        const linenumbers = this.macroParser.getMacroParameter(macro, 'linenumbers') === 'true'

        blocks.push({
          language,
          code: macro.body,
          title,
          linenumbers,
        })
      }
    }

    return blocks
  }
}

export function createCodeHandler(macroParser: MacroParser): CodeHandler {
  return new CodeHandler(macroParser)
}
