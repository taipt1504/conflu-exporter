/**
 * Unified Macro Processor
 * 
 * Handles ALL Confluence macros by converting them to Markdown-compatible formats.
 * This follows the CLI's pattern of processing STORAGE format to extract content.
 * 
 * IMPORTANT: Uses RegexMacroParser (not BrowserMacroParser) because this runs
 * in service worker context without DOM access.
 * 
 * Design Principles:
 * 1. Each macro type has a dedicated conversion method
 * 2. Macros are replaced with markdown-compatible HTML/text
 * 3. Unknown macros are handled gracefully
 */

import { RegexMacroParser, ParsedMacro } from './RegexMacroParser'

export interface ProcessingResult {
  content: string
  macroStats: {
    mermaid: number
    code: number
    diagrams: number
    panels: number
    toc: number
    other: number
  }
}

export class UnifiedMacroProcessor {
  private macroParser: RegexMacroParser
  private mermaidCache: Map<string, string> = new Map()
  
  constructor() {
    this.macroParser = new RegexMacroParser()
  }

  /**
   * Set mermaid attachment content for plugin-based diagrams
   */
  setMermaidAttachments(attachments: Map<string, string>): void {
    this.mermaidCache = attachments
  }

  /**
   * Process storage format content, converting all macros to markdown
   */
  processStorage(storageContent: string): ProcessingResult {
    if (!storageContent) {
      return {
        content: '',
        macroStats: { mermaid: 0, code: 0, diagrams: 0, panels: 0, toc: 0, other: 0 }
      }
    }

    let processed = storageContent
    const stats = { mermaid: 0, code: 0, diagrams: 0, panels: 0, toc: 0, other: 0 }

    // 1. Process Mermaid diagrams
    const mermaidMacros = this.macroParser.findMermaidMacros(storageContent)
    for (const macro of mermaidMacros) {
      const markdown = this.convertMermaidToMarkdown(macro)
      if (markdown) {
        processed = processed.replace(macro.rawXml, markdown)
        stats.mermaid++
      }
    }

    // 2. Process Code blocks (includes noformat, preformatted, etc.)
    const codeMacros = this.macroParser.findCodeMacros(storageContent)
    for (const macro of codeMacros) {
      const markdown = this.convertCodeToMarkdown(macro)
      if (markdown) {
        processed = processed.replace(macro.rawXml, markdown)
        stats.code++
      }
    }

    // 3. Process Panel macros (info, warning, note, tip)
    const panelMacros = this.macroParser.findPanelMacros(storageContent)
    for (const macro of panelMacros) {
      const markdown = this.convertPanelToMarkdown(macro)
      if (markdown) {
        processed = processed.replace(macro.rawXml, markdown)
        stats.panels++
      }
    }

    // 4. Process TOC macros
    const tocMacros = this.macroParser.findTocMacros(storageContent)
    for (const macro of tocMacros) {
      // TOC is rendered in VIEW format, so we just remove it from storage
      // The VIEW format will provide the actual rendered TOC
      processed = processed.replace(macro.rawXml, '\n<!-- TOC rendered from view format -->\n')
      stats.toc++
    }

    // 5. Process Diagram macros (DrawIO, Gliffy, etc.)
    const diagramMacros = this.macroParser.findDiagramMacros(storageContent)
    for (const macro of diagramMacros) {
      const markdown = this.convertDiagramToMarkdown(macro)
      if (markdown) {
        processed = processed.replace(macro.rawXml, markdown)
        stats.diagrams++
      }
    }

    return { content: processed, macroStats: stats }
  }

  /**
   * Convert Mermaid macro to markdown code block
   */
  private convertMermaidToMarkdown(macro: ParsedMacro): string | null {
    let code = ''

    // Check for inline body first
    if (this.macroParser.hasPlainTextBody(macro) && macro.body) {
      code = macro.body.trim()
    } else {
      // Check attachment cache for plugin-based diagrams
      const attachmentName = this.macroParser.getMacroAttachmentReference(macro)
      if (attachmentName) {
        code = this.mermaidCache.get(attachmentName) || ''
        if (!code) {
          // Create placeholder for unavailable diagrams
          return `\n> **Mermaid Diagram:** ${attachmentName}\n> \n> _Diagram source not available. Download attachment to view._\n\n`
        }
      }
    }

    if (!code.trim()) {
      return null
    }

    return `\n\`\`\`mermaid\n${code}\n\`\`\`\n`
  }

  /**
   * Convert code/noformat/preformatted macro to markdown code block
   */
  private convertCodeToMarkdown(macro: ParsedMacro): string | null {
    let code = ''

    // Check for plain text body (most common)
    if (this.macroParser.hasPlainTextBody(macro) && macro.body) {
      code = macro.body
    } else if (macro.bodyType === 'rich' && macro.body) {
      // Extract text from rich body, stripping HTML tags
      code = macro.body.replace(/<[^>]+>/g, '').trim()
    }

    if (!code.trim()) {
      return null
    }

    // Get language - 'noformat' and similar don't have language
    let language = this.macroParser.getMacroParameter(macro, 'language') || ''
    
    // Handle specific macro types
    if (macro.name === 'noformat' || macro.name === 'preformatted') {
      language = '' // Plain text, no syntax highlighting
    } else if (macro.name === 'html') {
      language = 'html'
    } else if (macro.name === 'xml') {
      language = 'xml'
    } else if (macro.name === 'sql') {
      language = 'sql'
    }

    // Build code fence
    let markdown = `\n\`\`\`${language.toLowerCase()}\n`
    markdown += code
    if (!code.endsWith('\n')) {
      markdown += '\n'
    }
    markdown += '```\n'

    // Add title as comment if present
    const title = this.macroParser.getMacroParameter(macro, 'title')
    if (title) {
      markdown = `\n<!-- ${title} -->\n` + markdown
    }

    return markdown
  }

  /**
   * Convert panel macros (info, warning, note, tip) to markdown blockquotes
   */
  private convertPanelToMarkdown(macro: ParsedMacro): string | null {
    const panelEmoji: Record<string, { emoji: string; prefix: string }> = {
      'info': { emoji: 'ℹ️', prefix: 'INFO' },
      'warning': { emoji: '⚠️', prefix: 'WARNING' },
      'note': { emoji: '📝', prefix: 'NOTE' },
      'tip': { emoji: '💡', prefix: 'TIP' },
      'expand': { emoji: '📂', prefix: 'DETAILS' },
    }

    const panel = panelEmoji[macro.name] || { emoji: '📋', prefix: macro.name.toUpperCase() }
    const title = this.macroParser.getMacroParameter(macro, 'title')
    
    let body = ''
    if (macro.bodyType === 'rich' && macro.body) {
      // Strip HTML for blockquote content
      body = macro.body.replace(/<[^>]+>/g, ' ').trim()
    } else if (macro.body) {
      body = macro.body.trim()
    }

    if (!body) {
      return `\n> ${panel.emoji} **${panel.prefix}${title ? `: ${title}` : ''}**\n\n`
    }

    let markdown = `\n> ${panel.emoji} **${panel.prefix}${title ? `: ${title}` : ''}**\n>\n`
    
    // Split content into lines for blockquote formatting
    const lines = body.split('\n')
    for (const line of lines) {
      if (line.trim()) {
        markdown += `> ${line.trim()}\n`
      }
    }
    markdown += '\n'

    return markdown
  }

  /**
   * Convert diagram macros (DrawIO, Gliffy) to placeholder
   */
  private convertDiagramToMarkdown(macro: ParsedMacro): string | null {
    const diagramName = macro.name.charAt(0).toUpperCase() + macro.name.slice(1)
    const attachmentRef = this.macroParser.getMacroAttachmentReference(macro)
    
    if (attachmentRef) {
      return `\n> **${diagramName} Diagram:** [${attachmentRef}](./assets/${attachmentRef})\n\n`
    }

    const title = this.macroParser.getMacroParameter(macro, 'title') || `${diagramName} Diagram`
    return `\n> **${title}** _([${diagramName}] - View in Confluence)_\n\n`
  }
}
