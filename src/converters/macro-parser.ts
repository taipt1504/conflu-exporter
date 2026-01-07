import { JSDOM } from 'jsdom'
import { getLogger } from '../cli/ui/logger.js'

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

export class MacroParser {
  private logger = getLogger()

  /**
   * Parse Confluence storage format and extract all macros
   * Uses HTML parsing mode for more lenient handling of XHTML content
   */
  parseMacros(storageContent: string): ParsedMacro[] {
    const macros: ParsedMacro[] = []

    if (!storageContent || typeof storageContent !== 'string') {
      return macros
    }

    try {
      // Use text/html for more lenient parsing of Confluence XHTML content
      const dom = new JSDOM(storageContent, { contentType: 'text/html' })
      const doc = dom.window.document

      // Find all structured macros using multiple selector strategies
      // In HTML mode, namespaced elements become regular elements with colon in name
      let macroElements: NodeListOf<Element> | Element[] = doc.querySelectorAll(
        'ac\\:structured-macro, structured-macro',
      )

      // If no results, try alternative approaches
      if (macroElements.length === 0) {
        // Try looking for elements with ac:name attribute (common in macros)
        macroElements = doc.querySelectorAll('[ac\\:name]')
      }

      // Convert to array for safe iteration
      const macroArray = Array.from(macroElements)

      for (const element of macroArray) {
        const macro = this.parseMacroElement(element)
        if (macro) {
          macros.push(macro)
        }
      }

      this.logger.debug(`Parsed ${macros.length} macros from storage format`)
    } catch (error) {
      // Log but don't fail - return what we have
      this.logger.warn('Macro parsing encountered an issue, continuing with partial results')
      this.logger.debug('Macro parsing error details:', error)
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

    // Check for plain text body (e.g., Mermaid, code blocks)
    const plainTextBody = element.querySelector('ac\\:plain-text-body, plain-text-body')
    if (plainTextBody) {
      body = plainTextBody.textContent || ''
      bodyType = 'plain'
    } else {
      // Check for rich text body (e.g., info panels, expand)
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
   * Extract images from storage format
   */
  parseImages(storageContent: string): ParsedImage[] {
    const images: ParsedImage[] = []

    if (!storageContent || typeof storageContent !== 'string') {
      return images
    }

    try {
      // Use text/html for more lenient parsing
      const dom = new JSDOM(storageContent, { contentType: 'text/html' })
      const doc = dom.window.document

      // Find all image elements
      const imageElements = doc.querySelectorAll('ac\\:image, image')

      // Convert to array for safe iteration
      const imageArray = Array.from(imageElements)

      for (const element of imageArray) {
        const image = this.parseImageElement(element)
        if (image) {
          images.push(image)
        }
      }

      this.logger.debug(`Parsed ${images.length} images from storage format`)
    } catch (error) {
      this.logger.warn('Image parsing encountered an issue, continuing with partial results')
      this.logger.debug('Image parsing error details:', error)
    }

    return images
  }

  /**
   * Parse a single image element
   */
  private parseImageElement(element: Element): ParsedImage | null {
    // Find attachment reference
    const attachment = element.querySelector('ri\\:attachment, attachment')
    const filename = attachment?.getAttribute('ri:filename') || attachment?.getAttribute('filename')

    if (!filename) {
      return null
    }

    // Extract image attributes
    const width = element.getAttribute('ac:width') || element.getAttribute('width')
    const height = element.getAttribute('ac:height') || element.getAttribute('height')
    const alt = element.getAttribute('ac:alt') || element.getAttribute('alt')

    // Extract caption
    const captionElement = element.querySelector('ac\\:caption, caption')
    const caption = captionElement?.textContent?.trim()

    return {
      filename,
      alt: alt || undefined,
      caption,
      width: width ? parseInt(width, 10) : undefined,
      height: height ? parseInt(height, 10) : undefined,
      rawXml: element.outerHTML,
    }
  }

  /**
   * Extract links from storage format
   */
  parseLinks(storageContent: string): ParsedLink[] {
    const links: ParsedLink[] = []

    if (!storageContent || typeof storageContent !== 'string') {
      return links
    }

    try {
      // Use text/html for more lenient parsing
      const dom = new JSDOM(storageContent, { contentType: 'text/html' })
      const doc = dom.window.document

      // Find all link elements
      const linkElements = doc.querySelectorAll('ac\\:link, link')

      // Convert to array for safe iteration
      const linkArray = Array.from(linkElements)

      for (const element of linkArray) {
        const link = this.parseLinkElement(element)
        if (link) {
          links.push(link)
        }
      }

      this.logger.debug(`Parsed ${links.length} links from storage format`)
    } catch (error) {
      this.logger.warn('Link parsing encountered an issue, continuing with partial results')
      this.logger.debug('Link parsing error details:', error)
    }

    return links
  }

  /**
   * Parse a single link element
   */
  private parseLinkElement(element: Element): ParsedLink | null {
    // Get link text
    const linkBody =
      element.querySelector('ac\\:plain-text-link-body, plain-text-link-body') ||
      element.querySelector('ac\\:link-body, link-body')
    const text = linkBody?.textContent?.trim() || ''

    // Check for page link
    const pageRef = element.querySelector('ri\\:page, page')
    if (pageRef) {
      const pageTitle =
        pageRef.getAttribute('ri:content-title') || pageRef.getAttribute('content-title')
      const spaceKey = pageRef.getAttribute('ri:space-key') || pageRef.getAttribute('space-key')

      return {
        type: 'page',
        text,
        pageTitle: pageTitle || undefined,
        spaceKey: spaceKey || undefined,
        rawXml: element.outerHTML,
      }
    }

    // Check for attachment link
    const attachmentRef = element.querySelector('ri\\:attachment, attachment')
    if (attachmentRef) {
      const filename =
        attachmentRef.getAttribute('ri:filename') || attachmentRef.getAttribute('filename')

      return {
        type: 'attachment',
        text,
        attachmentFilename: filename || undefined,
        rawXml: element.outerHTML,
      }
    }

    // Check for external link
    const href = element.getAttribute('ac:href') || element.getAttribute('href')
    if (href) {
      return {
        type: 'external',
        text,
        href,
        rawXml: element.outerHTML,
      }
    }

    return null
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
   * Check if macro has rich text body
   */
  hasRichTextBody(macro: ParsedMacro): boolean {
    return macro.bodyType === 'rich' && !!macro.body
  }

  /**
   * Check if macro references an attachment
   * Returns attachment filename if found, undefined otherwise
   */
  getMacroAttachmentReference(macro: ParsedMacro): string | undefined {
    // Check common parameter names for attachment references
    const attachmentParamNames = ['attachment', 'name', 'file', 'filename', 'src']

    for (const paramName of attachmentParamNames) {
      const value = this.getMacroParameter(macro, paramName)
      if (value) {
        return value
      }
    }

    return undefined
  }

  /**
   * Get all attachment references from macros in storage content
   * Returns array of attachment filenames
   */
  getAllAttachmentReferences(storageContent: string, macroName?: string): string[] {
    const macros = macroName
      ? this.findMacrosByName(storageContent, macroName)
      : this.parseMacros(storageContent)

    const attachments = new Set<string>()

    for (const macro of macros) {
      const attachment = this.getMacroAttachmentReference(macro)
      if (attachment) {
        attachments.add(attachment)
      }
    }

    return Array.from(attachments)
  }

  /**
   * Get all Mermaid attachment references (.mmd files)
   * Returns array of .mmd filenames referenced by mermaid macros
   */
  getMermaidAttachmentReferences(storageContent: string): string[] {
    const attachments = this.getAllAttachmentReferences(storageContent, 'mermaid')
    return attachments.filter((filename) => filename.endsWith('.mmd') || filename.endsWith('.mermaid'))
  }

  /**
   * Validate macro structure and parameters
   * Returns validation result with issues if any
   */
  validateMacro(macro: ParsedMacro): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    // Check for required name
    if (!macro.name || macro.name.trim() === '') {
      issues.push('Macro missing name attribute')
    }

    // Check for body XOR attachment (some macros should have one or the other)
    const hasBody = !!(macro.body && macro.body.trim())
    const hasAttachment = !!this.getMacroAttachmentReference(macro)

    // For macros that typically need content
    const contentMacros = ['mermaid', 'code', 'html', 'sql', 'xml']
    if (contentMacros.includes(macro.name) && !hasBody && !hasAttachment) {
      issues.push(`${macro.name} macro has no body content or attachment reference`)
    }

    // Check for attachment without valid filename
    if (hasAttachment) {
      const attachment = this.getMacroAttachmentReference(macro)!
      if (attachment.trim() === '') {
        issues.push('Attachment reference is empty')
      }
      // Validate filename characters
      if (attachment.includes('<') || attachment.includes('>') || attachment.includes('"')) {
        issues.push('Attachment filename contains invalid characters')
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    }
  }

  /**
   * Validate macro style and parameters for specific macro types
   * Provides detailed validation for common Confluence macros
   */
  validateMacroStyle(macro: ParsedMacro): { valid: boolean; issues: string[]; warnings: string[] } {
    const issues: string[] = []
    const warnings: string[] = []

    // Base validation
    const baseValidation = this.validateMacro(macro)
    issues.push(...baseValidation.issues)

    // Macro-specific validation
    switch (macro.name) {
      case 'mermaid':
        this.validateMermaidMacro(macro, issues, warnings)
        break
      case 'code':
        this.validateCodeMacro(macro, issues, warnings)
        break
      case 'drawio':
      case 'gliffy':
      case 'lucidchart':
        this.validateDiagramMacro(macro, issues, warnings)
        break
      case 'info':
      case 'warning':
      case 'note':
      case 'tip':
        this.validatePanelMacro(macro, issues, warnings)
        break
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    }
  }

  /**
   * Validate Mermaid macro style
   */
  private validateMermaidMacro(macro: ParsedMacro, issues: string[], warnings: string[]): void {
    const hasBody = this.hasPlainTextBody(macro)
    const attachment = this.getMacroAttachmentReference(macro)

    if (!hasBody && !attachment) {
      issues.push('Mermaid macro requires either plain text body or attachment reference')
    }

    if (attachment && !attachment.endsWith('.mmd') && !attachment.endsWith('.mermaid')) {
      warnings.push(`Mermaid attachment "${attachment}" doesn't use standard .mmd extension`)
    }

    // Check for valid theme parameter
    const theme = this.getMacroParameter(macro, 'theme')
    if (theme) {
      const validThemes = ['default', 'forest', 'dark', 'neutral']
      if (!validThemes.includes(theme)) {
        warnings.push(`Unknown Mermaid theme: "${theme}"`)
      }
    }
  }

  /**
   * Validate code macro style
   */
  private validateCodeMacro(macro: ParsedMacro, issues: string[], warnings: string[]): void {
    if (!this.hasPlainTextBody(macro)) {
      issues.push('Code macro requires plain text body')
    }

    const language = this.getMacroParameter(macro, 'language')
    if (!language) {
      warnings.push('Code macro missing language parameter for syntax highlighting')
    }
  }

  /**
   * Validate diagram macro style
   */
  private validateDiagramMacro(macro: ParsedMacro, issues: string[], _warnings: string[]): void {
    const attachment = this.getMacroAttachmentReference(macro)
    if (!attachment) {
      issues.push(`${macro.name} macro requires attachment reference`)
    }
  }

  /**
   * Validate panel macro style
   */
  private validatePanelMacro(macro: ParsedMacro, _issues: string[], warnings: string[]): void {
    if (!this.hasRichTextBody(macro)) {
      warnings.push(`${macro.name} panel has no body content`)
    }
  }
}

export function createMacroParser(): MacroParser {
  return new MacroParser()
}
