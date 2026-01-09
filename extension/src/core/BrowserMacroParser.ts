/**
 * Browser-compatible Macro Parser
 * Uses native DOMParser instead of JSDOM
 * 
 * This replicates the logic from CLI's MacroParser but works in browser context
 */

export interface MacroParameter {
  name: string
  value: string
}

export interface ParsedMacro {
  name: string
  parameters: MacroParameter[]
  body?: string
  bodyType?: 'plain' | 'rich'
  rawXml: string
}

export interface ParsedImage {
  filename: string
  alt?: string
  caption?: string
  width?: number
  height?: number
  rawXml: string
}

export interface ParsedLink {
  type: 'page' | 'external' | 'attachment'
  text: string
  href?: string
  pageTitle?: string
  spaceKey?: string
  attachmentFilename?: string
  rawXml: string
}

export class BrowserMacroParser {
  private parser: DOMParser

  constructor() {
    this.parser = new DOMParser()
  }

  /**
   * Parse Confluence storage format and extract all macros
   */
  parseMacros(storageContent: string): ParsedMacro[] {
    const macros: ParsedMacro[] = []

    if (!storageContent || typeof storageContent !== 'string') {
      return macros
    }

    try {
      const doc = this.parser.parseFromString(storageContent, 'text/html')

      // Find all structured macros using multiple selector strategies
      let macroElements: NodeListOf<Element> | Element[] = doc.querySelectorAll(
        'ac\\:structured-macro, structured-macro'
      )

      // Try alternative approaches if no results
      if (macroElements.length === 0) {
        macroElements = doc.querySelectorAll('[ac\\:name]')
      }

      const macroArray = Array.from(macroElements)

      for (const element of macroArray) {
        const macro = this.parseMacroElement(element)
        if (macro) {
          macros.push(macro)
        }
      }

      console.debug(`[BrowserMacroParser] Parsed ${macros.length} macros from storage format`)
    } catch (error) {
      console.warn('[BrowserMacroParser] Macro parsing encountered an issue:', error)
    }

    return macros
  }

  /**
   * Parse a single macro element
   */
  private parseMacroElement(element: Element): ParsedMacro | null {
    const name = element.getAttribute('ac:name') || element.getAttribute('name')
    if (!name) {
      return null
    }

    const parameters: MacroParameter[] = []
    const paramElements = element.querySelectorAll('ac\\:parameter, parameter')

    paramElements.forEach((param) => {
      const paramName = param.getAttribute('ac:name') || param.getAttribute('name')
      const paramValue = param.textContent || ''

      if (paramName) {
        parameters.push({
          name: paramName,
          value: paramValue.trim(),
        })
      }
    })

    // Extract body content
    let body: string | undefined
    let bodyType: 'plain' | 'rich' | undefined

    const plainTextBody = element.querySelector('ac\\:plain-text-body, plain-text-body')
    if (plainTextBody) {
      // 1. Try standard textContent first
      let content = plainTextBody.textContent || ''
      
      // 2. If empty, check for CDATA in comments (HTML parser treats <![CDATA[...]]> as comments)
      if (!content.trim()) {
        plainTextBody.childNodes.forEach(node => {
          if (node.nodeType === 8) { // Node.COMMENT_NODE
            const comment = node.textContent || ''
            // Check for CDATA markers [CDATA[ ... ]]
            if (comment.includes('[CDATA[') && comment.includes(']]')) {
               // Extract content between [CDATA[ and ]]
               const matches = comment.match(/\[CDATA\[([\s\S]*?)\]\]/)
               if (matches && matches[1]) {
                 content += matches[1]
               } else {
                 // Fallback: use whole comment or simplistic strip
                 content += comment.replace(/^\s*\[CDATA\[/, '').replace(/\]\]\s*$/, '')
               }
            }
          }
        })
      }
      
      body = content
      bodyType = 'plain'
    } else {
      const richTextBody = element.querySelector('ac\\:rich-text-body, rich-text-body')
      if (richTextBody) {
        body = richTextBody.innerHTML || ''
        bodyType = 'rich'
      }
    }

    return {
      name,
      parameters,
      body,
      bodyType,
      rawXml: element.outerHTML,
    }
  }

  /**
   * Find macros by name
   */
  findMacrosByName(storageContent: string, macroName: string): ParsedMacro[] {
    const allMacros = this.parseMacros(storageContent)
    return allMacros.filter((macro) => macro.name === macroName)
  }

  /**
   * Get macro parameter value by name
   */
  getMacroParameter(macro: ParsedMacro, paramName: string): string | undefined {
    const param = macro.parameters.find((p) => p.name === paramName)
    return param?.value
  }

  /**
   * Check if macro has plain text body
   */
  hasPlainTextBody(macro: ParsedMacro): boolean {
    return macro.bodyType === 'plain' && !!macro.body
  }

  /**
   * Get macro attachment reference
   */
  getMacroAttachmentReference(macro: ParsedMacro): string | undefined {
    const attachmentParamNames = ['filename', 'attachment', 'name', 'file', 'src']

    for (const paramName of attachmentParamNames) {
      const value = this.getMacroParameter(macro, paramName)
      if (value) {
        return value
      }
    }

    return undefined
  }

  /**
   * Get all Mermaid macro names (variants)
   */
  getMermaidMacroNames(): string[] {
    return [
      'mermaid',           // Built-in
      'mermaid-cloud',     // Mermaid for Confluence plugin (new)
      'mermaid-macro',     // Mermaid for Confluence plugin (old)
    ]
  }

  /**
   * Find all Mermaid macros
   */
  findMermaidMacros(storageContent: string): ParsedMacro[] {
    const names = this.getMermaidMacroNames()
    return names.flatMap(name => this.findMacrosByName(storageContent, name))
  }

  /**
   * Find all code macros (includes code, noformat, preformatted)
   * Generic approach: any macro that contains plain text body for code
   */
  findCodeMacros(storageContent: string): ParsedMacro[] {
    // All macro names that represent "code" or "preformatted" content
    // REMOVED 'noformat' and 'preformatted' to match CLI behavior (let them fall through to view)
    const codeNames = ['code', 'html', 'xml', 'sql']
    return codeNames.flatMap(name => this.findMacrosByName(storageContent, name))
  }

  /**
   * Find all diagram macros (Draw.io, Gliffy, etc.)
   */
  findDiagramMacros(storageContent: string): ParsedMacro[] {
    const diagramNames = ['drawio', 'gliffy', 'lucidchart', 'plantuml']
    return diagramNames.flatMap(name => this.findMacrosByName(storageContent, name))
  }

  /**
   * Find all panel macros (info, warning, note, tip)
   */
  findPanelMacros(storageContent: string): ParsedMacro[] {
    const panelNames = ['info', 'warning', 'note', 'tip', 'expand']
    return panelNames.flatMap(name => this.findMacrosByName(storageContent, name))
  }

  /**
   * Find TOC (Table of Contents) macros
   */
  findTocMacros(storageContent: string): ParsedMacro[] {
    const tocNames = ['toc', 'toc-zone', 'children', 'pagetree']
    return tocNames.flatMap(name => this.findMacrosByName(storageContent, name))
  }

  /**
   * Find noformat macros
   */
  findNoformatMacros(storageContent: string): ParsedMacro[] {
    const names = ['noformat', 'preformatted']
    return names.flatMap(name => this.findMacrosByName(storageContent, name))
  }

  /**
   * Get all macro names that should be treated as "preformatted/code"
   */
  getPreformattedMacroNames(): string[] {
    return ['code', 'noformat', 'preformatted', 'html', 'xml', 'sql']
  }
}

