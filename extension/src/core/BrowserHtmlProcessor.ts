/**
 * Browser-compatible HTML Processor
 * 
 * ARCHITECTURE:
 * 1. VIEW format is PRIMARY for HTML content
 * 2. STORAGE format used for extracting ALL macros to ensure fidelity
 * 3. Mermaid/Code/Noformat -> ID Placeholders (Hyphenated) -> Post-process Replacement
 * 4. This guarantees formatting (newlines, symbols) survives Turndown conversion
 */
import { BrowserMacroParser, ParsedMacro } from './BrowserMacroParser'

export interface ProcessedContent {
  html: string
  macros: {
    mermaid: number
    code: number
    noformat: number
    diagrams: number
    panels: number
    toc: number
  }
  mermaidBlocks: MermaidBlock[]
}

export interface MermaidBlock {
  id: string
  code: string
  source: 'inline' | 'attachment'
  attachmentName?: string
}

type MacroType = 'mermaid' | 'code' | 'noformat' | 'toc'

interface MacroPlaceholder {
  id: string
  type: MacroType
  content: string
  language?: string
}

export class BrowserHtmlProcessor {
  private macroParser: BrowserMacroParser
  private placeholders: Map<string, MacroPlaceholder> = new Map()
  private mermaidAttachmentCache: Map<string, string> = new Map()
  private placeholderCounter = 0

  constructor() {
    this.macroParser = new BrowserMacroParser()
  }

  setMermaidAttachments(attachments: Map<string, string>): void {
    this.mermaidAttachmentCache = attachments
  }

  /**
   * Process page content
   */
  async process(storageContent: string, viewContent: string): Promise<ProcessedContent> {
    const mermaidMacros = this.macroParser.findMermaidMacros(storageContent)
    const codeMacros = this.macroParser.findCodeMacros(storageContent)
    // Re-enable Noformat extraction to guarantee Block Code rendering
    const noformatMacros = this.macroParser.findNoformatMacros(storageContent)
    const diagramMacros = this.macroParser.findDiagramMacros(storageContent)
    const panelMacros = this.macroParser.findPanelMacros(storageContent)
    const tocMacros = this.macroParser.findTocMacros(storageContent)

    console.log('[BrowserHtmlProcessor] Found macros:', {
      mermaid: mermaidMacros.length,
      code: codeMacros.length,
      noformat: noformatMacros.length,
      diagrams: diagramMacros.length,
      panels: panelMacros.length,
      toc: tocMacros.length,
    })

    this.extractMacroContent(mermaidMacros, 'mermaid')
    this.extractMacroContent(codeMacros, 'code')
    this.extractMacroContent(noformatMacros, 'noformat')
    this.extractTocMacros(tocMacros)

    let html = this.processViewFormat(viewContent)
    html = this.injectMacroPlaceholders(html)
    html = this.cleanupConfluenceArtifacts(html)

    return {
      html,
      macros: {
        mermaid: mermaidMacros.length,
        code: codeMacros.length,
        noformat: noformatMacros.length,
        diagrams: diagramMacros.length,
        panels: panelMacros.length,
        toc: tocMacros.length,
      },
      mermaidBlocks: this.extractMermaidBlocks(mermaidMacros),
    }
  }

  private extractMacroContent(macros: ParsedMacro[], type: 'mermaid' | 'code' | 'noformat'): void {
    for (const macro of macros) {
      let content: string | null = null
      let language: string | undefined

      if (type === 'mermaid') {
        if (this.macroParser.hasPlainTextBody(macro) && macro.body) {
          content = macro.body.trim()
        } else {
          const attachmentName = this.macroParser.getMacroAttachmentReference(macro)
          if (attachmentName) {
            content = this.mermaidAttachmentCache.get(attachmentName) || null
            if (!content) {
              content = `%% Mermaid diagram: ${attachmentName}\n%% Diagram source not available`
            }
          }
        }
        language = 'mermaid'
      } else if (type === 'code' || type === 'noformat') {
        // Strategy 1: Plain Text Body (Preferred)
        if (this.macroParser.hasPlainTextBody(macro) && macro.body) {
          content = macro.body.trim()
          if (type === 'code') {
            language = this.macroParser.getMacroParameter(macro, 'language') || ''
          }
        } 
        // Strategy 2: Rich Text or Unknown Body (Fallback - Strip HTML)
        else if (macro.body) {
          // Robust fallback: treat as HTML, strip tags, decode basic entities
          content = macro.body
            .replace(/<br\s*\/?>/gi, '\n') // Handle break tags first
            .replace(/<[^>]+>/g, '') // Strip other tags
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim()
            
          if (type === 'code') {
             language = this.macroParser.getMacroParameter(macro, 'language') || ''
          }
        }
        
        // Strategy 3: Graceful Failure
        if (!content) {
          content = `// ${type} content could not be extracted`
        }
      }

      if (content) {
        // Use HYPHENS in ID to avoid Turndown escaping underscores
        const placeholderId = `MACRO-${type.toUpperCase()}-${++this.placeholderCounter}`
        this.placeholders.set(placeholderId, {
          id: placeholderId,
          type,
          content,
          language,
        })
      }
    }
  }

  private extractTocMacros(macros: ParsedMacro[]): void {
    if (macros.length === 0) return

    const macro = macros[0]
    const minLevel = this.macroParser.getMacroParameter(macro, 'minLevel') || '1'
    const maxLevel = this.macroParser.getMacroParameter(macro, 'maxLevel') || '7'
    const typeCase = this.macroParser.getMacroParameter(macro, 'type')
    const outline = this.macroParser.getMacroParameter(macro, 'outline')

    const content = `{{TOC-PLACEHOLDER-${minLevel}-${maxLevel}}}`
    const printable = outline !== 'false' && typeCase !== 'flat'
    const fullContent = printable ? `${content}\n{{TOC-PRINTABLE}}` : content

    const placeholderId = `MACRO-TOC-1`
    this.placeholders.set(placeholderId, {
      id: placeholderId,
      type: 'toc',
      content: fullContent
    })
  }

  private processViewFormat(viewContent: string): string {
    if (!viewContent) return ''
    const parser = new DOMParser()
    const doc = parser.parseFromString(viewContent, 'text/html')
    this.removeConfluenceUI(doc)
    this.processTables(doc)
    this.processLinks(doc)
    this.processImages(doc)
    return doc.body.innerHTML
  }

  private injectMacroPlaceholders(html: string): string {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const replaceWithId = (container: Element, placeholder: MacroPlaceholder) => {
      // Inject {{ID}} as simple text in paragraph. Turndown preserves {{ and - }}
      const uniqueToken = `{{${placeholder.id}}}`
      const p = doc.createElement('p')
      p.setAttribute('data-macro-placeholder', placeholder.id)
      p.textContent = uniqueToken
      container.replaceWith(p)
    }

    // Replace Mermaid
    const mermaidContainers = doc.querySelectorAll(
      '[data-macro-name="mermaid"], [data-macro-name="mermaid-cloud"], .mermaid-macro-container, iframe[src*="mermaid"]'
    )
    let mermaidIndex = 0
    mermaidContainers.forEach((container) => {
      const placeholder = this.getPlaceholderByIndex('mermaid', mermaidIndex++)
      if (placeholder) replaceWithId(container, placeholder)
    })

    // Replace Code
    const codeContainers = doc.querySelectorAll(
      '[data-macro-name="code"], .code-macro, .codeContent'
    )
    let codeIndex = 0
    codeContainers.forEach((container) => {
      const placeholder = this.getPlaceholderByIndex('code', codeIndex++)
      if (placeholder) replaceWithId(container, placeholder)
    })

    // Replace Noformat (Restored)
    // Replace Noformat (Restored)
    // Expanded selectors to ensure we catch all variations of preformatted rendering
    const noformatContainers = doc.querySelectorAll(
      '[data-macro-name="noformat"], .noformat, .preformatted, .preformattedContent'
    )
    let noformatIndex = 0
    noformatContainers.forEach((container) => {
      // Ensure container is still in the document (handle nesting replacement)
      // If we replaced the parent (.preformatted), the child (.preformattedContent) is detached
      if (!doc.contains(container)) return

      // Also skip if somehow already processed
      if (container.hasAttribute('data-macro-placeholder')) return

      const placeholder = this.getPlaceholderByIndex('noformat', noformatIndex)
      if (placeholder) {
        replaceWithId(container, placeholder)
        noformatIndex++
      }
    })

    // Replace TOC
    const tocContainers = doc.querySelectorAll(
      '[data-macro-name="toc"], .toc-macro, .client-side-toc-macro'
    )
    if (tocContainers.length > 0) {
      const placeholder = this.placeholders.get('MACRO-TOC-1')
      if (placeholder) {
        const container = tocContainers[0]
        const p = doc.createElement('p')
        p.textContent = placeholder.content
        container.replaceWith(p)
      }
    }

    return doc.body.innerHTML
  }

  replaceMermaidPlaceholders(markdown: string): string {
    let result = markdown

    for (const [id, placeholder] of this.placeholders) {
      if (placeholder.type === 'toc') continue 

      // Use 'text' language for noformat
      const lang = placeholder.type === 'noformat' ? 'text' : (placeholder.language || placeholder.type)
      const replacement = `\`\`\`${lang}\n${placeholder.content}\n\`\`\`\n`
      
      const patterns = [
        `\\{\\{${id}\\}\\}`,       // {{ID}} 
        `\\\\{\\\\{${id}\\\\}\\\\}`, // \\{\\{ID\\}\\} (Double escaped)
        `\\{\\\\{${id}\\}\\\\}`,     // \{\{ID\}\} (Escaped)
      ]
      
      const combinedPattern = new RegExp(patterns.join('|'), 'g')
      result = result.replace(combinedPattern, replacement)
    }

    return result
  }

  private getPlaceholderByIndex(type: MacroType, index: number): MacroPlaceholder | null {
    let count = 0
    for (const [, placeholder] of this.placeholders) {
      if (placeholder.type === type) {
        if (count === index) return placeholder
        count++
      }
    }
    return null
  }

  private appendMissingPlaceholders(doc: Document): void {
    for (const [, placeholder] of this.placeholders) {
      if (placeholder.type === 'toc') continue
      
      const existing = doc.querySelector(`[data-macro-placeholder="${placeholder.id}"]`)
      if (!existing) {
        const p = doc.createElement('p')
        p.setAttribute('data-macro-placeholder', placeholder.id)
        p.textContent = `{{${placeholder.id}}}`
        doc.body.appendChild(p)
      }
    }
  }

  private removeConfluenceUI(doc: Document): void {
    const selectorsToRemove = [
      'script', 'style', 'iframe[src*="stratus-addons"]', 'iframe[src*="mermaid"]',
      '.confluence-information-macro-icon', '.expand-control', '.page-metadata',
      '.footer-body', '#action-menu', '.like-button', '.watch-button',
      '.apple-interchange-newline'
    ]
    selectorsToRemove.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((el) => el.remove())
    })
  }

  private processTables(doc: Document): void {
    const tables = doc.querySelectorAll('table')
    tables.forEach((table) => {
      table.classList.add('gfm-table')
      const rows = table.querySelectorAll('tr')
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('th, td')
        cells.forEach((cell) => {
          let text = cell.textContent || ''
          text = text.trim().replace(/\s+/g, ' ').replace(/\|/g, '\\|')
          cell.textContent = text
        })
        if (rowIndex === 0 && row.querySelector('th')) {
          row.classList.add('table-header')
        }
      })
    })
  }

  private processLinks(doc: Document): void {
    const links = doc.querySelectorAll('a')
    links.forEach((link) => {
      const href = link.getAttribute('href')
      if (href?.includes('/wiki/spaces/') || href?.includes('/pages/')) {
        link.setAttribute('data-confluence-link', 'true')
      }
    })
  }

  private processImages(doc: Document): void {
    const images = doc.querySelectorAll('img')
    images.forEach((img) => {
      const src = img.getAttribute('src')
      if (src?.includes('/download/') || src?.includes('/attachments/')) {
        img.setAttribute('data-confluence-image', 'true')
        img.setAttribute('data-original-src', src)
      }
    })
  }

  private cleanupConfluenceArtifacts(html: string): string {
    html = html.replace(/\/\/\s*<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    html = html.replace(/\(function\(\)\{[\s\S]*?}\(\)\);?/g, '')
    html = html.replace(/<p>\s*<\/p>/g, '')
    html = html.replace(/<div>\s*<\/div>/g, '')
    return html
  }

  private extractMermaidBlocks(mermaidMacros: ParsedMacro[]): MermaidBlock[] {
    const blocks: MermaidBlock[] = []
    for (const macro of mermaidMacros) {
      if (this.macroParser.hasPlainTextBody(macro) && macro.body) {
        blocks.push({
          id: `mermaid-${blocks.length + 1}`,
          code: macro.body.trim(),
          source: 'inline',
        })
      } else {
        const attachment = this.macroParser.getMacroAttachmentReference(macro)
        if (attachment) {
          const code = this.mermaidAttachmentCache.get(attachment) || ''
          blocks.push({
            id: `mermaid-${blocks.length + 1}`,
            code,
            source: 'attachment',
            attachmentName: attachment,
          })
        }
      }
    }
    return blocks
  }

  replaceMermaidPlaceholdersLogic(markdown: string): string {
      return this.replaceMermaidPlaceholders(markdown)
  }

  clearPlaceholders(): void {
    this.placeholders.clear()
    this.placeholderCounter = 0
  }

  private unescapeHtml(text: string): string {
    if (!text) return ''
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
  }
}
