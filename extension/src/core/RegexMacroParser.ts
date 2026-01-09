/**
 * Regex-based Macro Parser (Service Worker compatible)
 * 
 * This parser uses REGEX instead of DOMParser, allowing it to run
 * in service worker context without DOM access.
 * 
 * Follows CLI pattern of using regex for storage format parsing.
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

export class RegexMacroParser {
  
  /**
   * Find all macros of a specific type in storage content
   */
  findMacrosByName(storageContent: string, macroName: string): ParsedMacro[] {
    if (!storageContent) return []
    
    const macros: ParsedMacro[] = []
    
    // Pattern for Confluence structured macros
    // <ac:structured-macro ac:name="macroName">...</ac:structured-macro>
    const macroPattern = new RegExp(
      `<ac:structured-macro[^>]*ac:name=["']${macroName}["'][^>]*>([\\s\\S]*?)</ac:structured-macro>`,
      'gi'
    )
    
    let match
    while ((match = macroPattern.exec(storageContent)) !== null) {
      const fullMatch = match[0]
      const innerContent = match[1]
      
      const macro: ParsedMacro = {
        name: macroName,
        parameters: this.extractParameters(innerContent),
        rawXml: fullMatch,
      }
      
      // Extract body content
      const plainBody = this.extractPlainTextBody(innerContent)
      if (plainBody !== null) {
        macro.body = plainBody
        macro.bodyType = 'plain'
      } else {
        const richBody = this.extractRichTextBody(innerContent)
        if (richBody !== null) {
          macro.body = richBody
          macro.bodyType = 'rich'
        }
      }
      
      macros.push(macro)
    }
    
    return macros
  }

  /**
   * Extract parameters from macro inner content
   */
  private extractParameters(content: string): MacroParameter[] {
    const params: MacroParameter[] = []
    
    // Pattern: <ac:parameter ac:name="paramName">value</ac:parameter>
    const paramPattern = /<ac:parameter[^>]*ac:name=["']([^"']+)["'][^>]*>([^<]*)<\/ac:parameter>/gi
    
    let match
    while ((match = paramPattern.exec(content)) !== null) {
      params.push({
        name: match[1],
        value: match[2].trim(),
      })
    }
    
    return params
  }

  /**
   * Extract plain text body from macro
   */
  private extractPlainTextBody(content: string): string | null {
    // Pattern: <ac:plain-text-body><![CDATA[...]]></ac:plain-text-body>
    const cdataPattern = /<ac:plain-text-body>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/ac:plain-text-body>/i
    const match = content.match(cdataPattern)
    
    if (match) {
      return match[1]
    }
    
    // Also try without CDATA
    const plainPattern = /<ac:plain-text-body>([\s\S]*?)<\/ac:plain-text-body>/i
    const plainMatch = content.match(plainPattern)
    
    if (plainMatch) {
      return plainMatch[1]
    }
    
    return null
  }

  /**
   * Extract rich text body from macro
   */
  private extractRichTextBody(content: string): string | null {
    // Pattern: <ac:rich-text-body>...</ac:rich-text-body>
    const richPattern = /<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/i
    const match = content.match(richPattern)
    
    return match ? match[1] : null
  }

  /**
   * Get parameter value by name
   */
  getMacroParameter(macro: ParsedMacro, paramName: string): string | undefined {
    const param = macro.parameters.find(p => p.name === paramName)
    return param?.value
  }

  /**
   * Check if macro has plain text body
   */
  hasPlainTextBody(macro: ParsedMacro): boolean {
    return macro.bodyType === 'plain' && !!macro.body
  }

  /**
   * Get attachment reference from macro parameters
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
   * Find all Mermaid macros (various plugin variants)
   */
  findMermaidMacros(storageContent: string): ParsedMacro[] {
    const names = ['mermaid', 'mermaid-cloud', 'mermaid-macro']
    return names.flatMap(name => this.findMacrosByName(storageContent, name))
  }

  /**
   * Find all code/preformatted macros
   */
  findCodeMacros(storageContent: string): ParsedMacro[] {
    const names = ['code', 'noformat', 'preformatted', 'html', 'xml', 'sql']
    return names.flatMap(name => this.findMacrosByName(storageContent, name))
  }

  /**
   * Find all panel macros
   */
  findPanelMacros(storageContent: string): ParsedMacro[] {
    const names = ['info', 'warning', 'note', 'tip', 'expand']
    return names.flatMap(name => this.findMacrosByName(storageContent, name))
  }

  /**
   * Find all diagram macros
   */
  findDiagramMacros(storageContent: string): ParsedMacro[] {
    const names = ['drawio', 'gliffy', 'lucidchart', 'plantuml']
    return names.flatMap(name => this.findMacrosByName(storageContent, name))
  }

  /**
   * Find TOC macros
   */
  findTocMacros(storageContent: string): ParsedMacro[] {
    const names = ['toc', 'toc-zone', 'children', 'pagetree']
    return names.flatMap(name => this.findMacrosByName(storageContent, name))
  }
}
