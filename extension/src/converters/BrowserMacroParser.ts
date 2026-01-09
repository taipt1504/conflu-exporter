/**
 * Browser-compatible macro parser
 * Replaces JSDOM with native DOMParser for browser environment
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

/**
 * Browser-compatible MacroParser
 * Uses native DOMParser instead of JSDOM
 */
export class BrowserMacroParser {
  private parser = new DOMParser()

  /**
   * Parse Confluence storage format and extract all macros
   */
  parseMacros(storageContent: string): ParsedMacro[] {
    const macros: ParsedMacro[] = []

    if (!storageContent || typeof storageContent !== 'string') {
      return macros
    }

    try {
      // Use DOMParser with text/html for lenient parsing
      const doc = this.parser.parseFromString(storageContent, 'text/html')

      // Find all structured macros
      let macroElements: NodeListOf<Element> | Element[] = doc.querySelectorAll(
        'ac\\:structured-macro, structured-macro'
      )

      // If no results, try alternative selector
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

      console.log(`[BrowserMacroParser] Parsed ${macros.length} macros`)
    } catch (error) {
      console.warn('[BrowserMacroParser] Parsing error:', error)
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
      const paramValue = param.textContent?.trim() || ''

      if (paramName) {
        parameters.push({
          name: paramName,
          value: paramValue,
        })
      }
    })

    // Parse macro body
    const bodyElements = element.querySelectorAll('ac\\:plain-text-body, plain-text-body')
    const richBodyElements = element.querySelectorAll('ac\\:rich-text-body, rich-text-body')

    let body: string | undefined
    let bodyType: 'plain' | 'rich' | undefined

    if (bodyElements.length > 0) {
      body = bodyElements[0].textContent?.trim()
      bodyType = 'plain'
    } else if (richBodyElements.length > 0) {
      body = richBodyElements[0].innerHTML
      bodyType = 'rich'
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
    return allMacros.filter((m) => m.name === macroName)
  }

  /**
   * Get macro parameter value by name
   */
  getMacroParameter(macro: ParsedMacro, paramName: string): string | undefined {
    const param = macro.parameters.find((p) => p.name === paramName)
    return param?.value
  }

  /**
   * Get attachment reference from macro
   */
  getMacroAttachmentReference(macro: ParsedMacro): string | undefined {
    // Check common parameter names for attachments
    return (
      this.getMacroParameter(macro, 'name') ||
      this.getMacroParameter(macro, 'filename') ||
      this.getMacroParameter(macro, 'file') ||
      this.getMacroParameter(macro, 'attachment')
    )
  }

  /**
   * Parse images from storage format
   */
  parseImages(storageContent: string): ParsedImage[] {
    const images: ParsedImage[] = []

    try {
      const doc = this.parser.parseFromString(storageContent, 'text/html')
      const imageElements = doc.querySelectorAll('ac\\:image, image')

      imageElements.forEach((element) => {
        const filename =
          element.querySelector('ri\\:attachment, attachment')?.getAttribute('ri:filename') ||
          element.querySelector('ri\\:attachment, attachment')?.getAttribute('filename')

        if (filename) {
          images.push({
            filename,
            width: this.parseIntAttribute(element, 'ac:width') || this.parseIntAttribute(element, 'width'),
            height: this.parseIntAttribute(element, 'ac:height') || this.parseIntAttribute(element, 'height'),
            rawXml: element.outerHTML,
          })
        }
      })
    } catch (error) {
      console.warn('[BrowserMacroParser] Image parsing error:', error)
    }

    return images
  }

  /**
   * Parse links from storage format
   */
  parseLinks(storageContent: string): ParsedLink[] {
    const links: ParsedLink[] = []

    try {
      const doc = this.parser.parseFromString(storageContent, 'text/html')
      const linkElements = doc.querySelectorAll('ac\\:link, link')

      linkElements.forEach((element) => {
        const linkBody = element.querySelector('ac\\:link-body, link-body')
        const text = linkBody?.textContent?.trim() || ''

        // Page link
        const pageRef = element.querySelector('ri\\:page, page')
        if (pageRef) {
          const pageTitle = pageRef.getAttribute('ri:content-title') || pageRef.getAttribute('content-title')
          const spaceKey = pageRef.getAttribute('ri:space-key') || pageRef.getAttribute('space-key')

          links.push({
            type: 'page',
            text,
            pageTitle: pageTitle || undefined,
            spaceKey: spaceKey || undefined,
            rawXml: element.outerHTML,
          })
          return
        }

        // Attachment link
        const attachmentRef = element.querySelector('ri\\:attachment, attachment')
        if (attachmentRef) {
          const filename = attachmentRef.getAttribute('ri:filename') || attachmentRef.getAttribute('filename')

          links.push({
            type: 'attachment',
            text,
            attachmentFilename: filename || undefined,
            rawXml: element.outerHTML,
          })
          return
        }

        // External link
        const href = element.getAttribute('ac:href') || element.getAttribute('href')
        if (href) {
          links.push({
            type: 'external',
            text,
            href,
            rawXml: element.outerHTML,
          })
        }
      })
    } catch (error) {
      console.warn('[BrowserMacroParser] Link parsing error:', error)
    }

    return links
  }

  /**
   * Parse integer attribute
   */
  private parseIntAttribute(element: Element, attrName: string): number | undefined {
    const value = element.getAttribute(attrName)
    if (!value) return undefined

    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? undefined : parsed
  }
}
