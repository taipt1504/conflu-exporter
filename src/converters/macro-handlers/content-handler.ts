import { ParsedMacro, MacroParser } from '../macro-parser.js'
import { getLogger } from '../../cli/ui/logger.js'

/**
 * Content Macro Handler
 * Handles content macros: info, warning, note, tip, expand, status, toc, etc.
 */
export class ContentHandler {
  private logger = getLogger()
  private macroParser: MacroParser

  constructor(macroParser: MacroParser) {
    this.macroParser = macroParser
  }

  /**
   * Process all content macros in storage content
   */
  process(storageContent: string): string {
    let processedContent = storageContent

    // Process panel macros (info, warning, note, tip)
    processedContent = this.processPanels(processedContent)

    // Process status macros
    processedContent = this.processStatus(processedContent)

    // Process expand macros
    processedContent = this.processExpand(processedContent)

    // Process TOC macros
    processedContent = this.processTOC(processedContent)

    return processedContent
  }

  /**
   * Process panel macros (info, warning, note, tip)
   */
  private processPanels(storageContent: string): string {
    const panelTypes = [
      { name: 'info', emoji: 'ℹ️', prefix: 'INFO' },
      { name: 'warning', emoji: '⚠️', prefix: 'WARNING' },
      { name: 'note', emoji: '📝', prefix: 'NOTE' },
      { name: 'tip', emoji: '💡', prefix: 'TIP' },
      { name: 'panel', emoji: '📋', prefix: 'PANEL' },
    ]

    let processedContent = storageContent

    for (const panelType of panelTypes) {
      const macros = this.macroParser.findMacrosByName(storageContent, panelType.name)

      if (macros.length > 0) {
        this.logger.info(`Processing ${macros.length} ${panelType.name} panels...`)

        for (const macro of macros) {
          const markdown = this.convertPanelToMarkdown(macro, panelType.emoji, panelType.prefix)
          if (markdown) {
            processedContent = processedContent.replace(macro.rawXml, markdown)
          }
        }
      }
    }

    return processedContent
  }

  /**
   * Convert panel macro to markdown blockquote
   */
  private convertPanelToMarkdown(
    macro: ParsedMacro,
    emoji: string,
    prefix: string,
  ): string | null {
    if (!this.macroParser.hasRichTextBody(macro)) {
      return null
    }

    const title = this.macroParser.getMacroParameter(macro, 'title')
    const body = macro.body || ''

    // Remove HTML tags from body (will be processed later by HTML processor)
    const textContent = body.replace(/<[^>]*>/g, ' ').trim()

    let markdown = `\n> ${emoji} **${prefix}${title ? `: ${title}` : ''}**\n`
    markdown += `>\n`

    // Split content into lines and add blockquote prefix
    const lines = textContent.split('\n')
    for (const line of lines) {
      if (line.trim()) {
        markdown += `> ${line.trim()}\n`
      }
    }

    markdown += '\n'

    return markdown
  }

  /**
   * Process status macros
   */
  private processStatus(storageContent: string): string {
    const statusMacros = this.macroParser.findMacrosByName(storageContent, 'status')

    if (statusMacros.length === 0) {
      return storageContent
    }

    this.logger.info(`Processing ${statusMacros.length} status macros...`)

    let processedContent = storageContent

    for (const macro of statusMacros) {
      const markdown = this.convertStatusToMarkdown(macro)
      if (markdown) {
        processedContent = processedContent.replace(macro.rawXml, markdown)
      }
    }

    return processedContent
  }

  /**
   * Convert status macro to markdown badge
   */
  private convertStatusToMarkdown(macro: ParsedMacro): string | null {
    const title = this.macroParser.getMacroParameter(macro, 'title') || 'Status'
    const color = this.macroParser.getMacroParameter(macro, 'colour') || 'grey'
    const subtle = this.macroParser.getMacroParameter(macro, 'subtle') === 'true'

    // Map Confluence colors to emoji
    const colorEmoji: Record<string, string> = {
      grey: '⚪',
      red: '🔴',
      yellow: '🟡',
      green: '🟢',
      blue: '🔵',
      purple: '🟣',
    }

    const emoji = colorEmoji[color.toLowerCase()] || '⚪'

    return `${emoji} **[${title.toUpperCase()}]**${subtle ? ' *(subtle)*' : ''}`
  }

  /**
   * Process expand macros
   */
  private processExpand(storageContent: string): string {
    const expandMacros = this.macroParser.findMacrosByName(storageContent, 'expand')

    if (expandMacros.length === 0) {
      return storageContent
    }

    this.logger.info(`Processing ${expandMacros.length} expand macros...`)

    let processedContent = storageContent

    for (const macro of expandMacros) {
      const markdown = this.convertExpandToMarkdown(macro)
      if (markdown) {
        processedContent = processedContent.replace(macro.rawXml, markdown)
      }
    }

    return processedContent
  }

  /**
   * Convert expand macro to markdown details/summary
   */
  private convertExpandToMarkdown(macro: ParsedMacro): string | null {
    if (!this.macroParser.hasRichTextBody(macro)) {
      return null
    }

    const title = this.macroParser.getMacroParameter(macro, 'title') || 'Click to expand...'
    const body = macro.body || ''

    // Use HTML <details> element (supported in markdown)
    let markdown = `\n<details>\n`
    markdown += `<summary>${title}</summary>\n\n`
    markdown += body // Will be processed by HTML processor
    markdown += `\n</details>\n\n`

    return markdown
  }

  /**
   * Process TOC (Table of Contents) macros
   */
  private processTOC(storageContent: string): string {
    const tocMacros = this.macroParser.findMacrosByName(storageContent, 'toc')

    if (tocMacros.length === 0) {
      return storageContent
    }

    this.logger.info(`Processing ${tocMacros.length} TOC macros...`)

    let processedContent = storageContent

    for (const macro of tocMacros) {
      const markdown = this.convertTOCToMarkdown(macro)
      if (markdown) {
        processedContent = processedContent.replace(macro.rawXml, markdown)
      }
    }

    return processedContent
  }

  /**
   * Convert TOC macro to markdown
   * Note: Actual TOC generation should be done by markdown processor
   */
  private convertTOCToMarkdown(macro: ParsedMacro): string | null {
    const printable = this.macroParser.getMacroParameter(macro, 'printable') === 'true'
    const maxLevel = this.macroParser.getMacroParameter(macro, 'maxLevel') || '7'
    const minLevel = this.macroParser.getMacroParameter(macro, 'minLevel') || '1'

    // Use a unique text marker that will survive HTML to Markdown conversion
    // Using {{}} format which won't be interpreted as markdown or HTML syntax
    let markdown = `\n{{TOC_PLACEHOLDER_${minLevel}_${maxLevel}}}\n`

    if (printable) {
      markdown += `{{TOC_PRINTABLE}}\n`
    }

    markdown += `\n`

    return markdown
  }

  /**
   * Process quote/blockquote macros
   */
  processQuote(storageContent: string): string {
    const quoteMacros = this.macroParser.findMacrosByName(storageContent, 'quote')

    if (quoteMacros.length === 0) {
      return storageContent
    }

    this.logger.info(`Processing ${quoteMacros.length} quote macros...`)

    let processedContent = storageContent

    for (const macro of quoteMacros) {
      if (this.macroParser.hasRichTextBody(macro)) {
        const body = macro.body || ''
        const lines = body.split('\n')
        let markdown = '\n'

        for (const line of lines) {
          if (line.trim()) {
            markdown += `> ${line.trim()}\n`
          }
        }

        markdown += '\n'
        processedContent = processedContent.replace(macro.rawXml, markdown)
      }
    }

    return processedContent
  }

  /**
   * Process anchor macros
   */
  processAnchors(storageContent: string): string {
    const anchorMacros = this.macroParser.findMacrosByName(storageContent, 'anchor')

    if (anchorMacros.length === 0) {
      return storageContent
    }

    this.logger.info(`Processing ${anchorMacros.length} anchor macros...`)

    let processedContent = storageContent

    for (const macro of anchorMacros) {
      const anchorName = this.macroParser.getMacroParameter(macro, '') || 'anchor'
      const markdown = `<a id="${anchorName}"></a>`
      processedContent = processedContent.replace(macro.rawXml, markdown)
    }

    return processedContent
  }
}

export function createContentHandler(macroParser: MacroParser): ContentHandler {
  return new ContentHandler(macroParser)
}
