/**
 * Browser DOM parser adapter
 * Replaces JSDOM with native DOMParser
 *
 * Architecture:
 * - Uses browser's native DOMParser API
 * - Drop-in replacement for JSDOM in browser environment
 * - No external dependencies needed
 */
export class BrowserDomParser {
  private parser = new DOMParser()

  /**
   * Parse HTML string to Document
   * Compatible with JSDOM's API
   */
  parse(html: string): Document {
    return this.parser.parseFromString(html, 'text/html')
  }

  /**
   * Extract text content from HTML
   */
  extractText(html: string): string {
    const doc = this.parse(html)
    return doc.body.textContent || ''
  }

  /**
   * Query elements from HTML string
   */
  queryAll(html: string, selector: string): Element[] {
    const doc = this.parse(html)
    return Array.from(doc.querySelectorAll(selector))
  }

  /**
   * Query single element from HTML string
   */
  query(html: string, selector: string): Element | null {
    const doc = this.parse(html)
    return doc.querySelector(selector)
  }
}
