import { ParsedMacro, MacroParser } from '../macro-parser.js'
import { getLogger } from '../../cli/ui/logger.js'

/**
 * Diagram Handler
 * Handles various diagram macros: DrawIO, Gliffy, Lucidchart, etc.
 *
 * Strategy:
 * - Extract diagram source/data if available (DrawIO XML, Gliffy data)
 * - Preserve macro metadata for sync compatibility
 * - Fallback to image reference with metadata comments
 */
export class DiagramHandler {
  private logger = getLogger()
  private macroParser: MacroParser

  constructor(macroParser: MacroParser) {
    this.macroParser = macroParser
  }

  /**
   * Process all diagram macros in storage content
   */
  process(storageContent: string): string {
    let processedContent = storageContent

    // Process DrawIO diagrams
    processedContent = this.processDrawIO(processedContent)

    // Process Gliffy diagrams
    processedContent = this.processGliffy(processedContent)

    // Process Lucidchart diagrams
    processedContent = this.processLucidchart(processedContent)

    return processedContent
  }

  /**
   * Process DrawIO diagrams
   * DrawIO stores diagram as base64-encoded XML in parameters
   */
  private processDrawIO(storageContent: string): string {
    const drawioMacros = this.macroParser.findMacrosByName(storageContent, 'drawio')

    if (drawioMacros.length === 0) {
      return storageContent
    }

    this.logger.info(`Processing ${drawioMacros.length} DrawIO diagrams...`)

    let processedContent = storageContent

    for (const macro of drawioMacros) {
      const markdown = this.convertDrawIOToMarkdown(macro)
      if (markdown) {
        processedContent = processedContent.replace(macro.rawXml, markdown)
      }
    }

    return processedContent
  }

  /**
   * Convert DrawIO macro to markdown
   * Includes XML source as HTML comment for sync compatibility
   */
  private convertDrawIOToMarkdown(macro: ParsedMacro): string | null {
    const diagramName = this.macroParser.getMacroParameter(macro, 'diagramName') || 'diagram'
    const pageId = this.macroParser.getMacroParameter(macro, 'pageId')
    const diagramData = this.macroParser.getMacroParameter(macro, 'diagramData')
    const width = this.macroParser.getMacroParameter(macro, 'width')
    const height = this.macroParser.getMacroParameter(macro, 'height')

    // Build markdown with metadata
    let markdown = `\n<!-- DrawIO Diagram: ${diagramName} -->\n`

    if (diagramData) {
      // Include diagram source as HTML comment for future sync
      markdown += `<!-- DrawIO Data (base64): ${diagramData.substring(0, 100)}... -->\n`
    }

    // Reference to image (will be exported separately)
    markdown += `![${diagramName}](./assets/drawio-${pageId || 'diagram'}.png)`

    if (width || height) {
      markdown += ` <!-- Size: ${width || 'auto'}x${height || 'auto'} -->`
    }

    markdown += '\n'

    return markdown
  }

  /**
   * Process Gliffy diagrams
   */
  private processGliffy(storageContent: string): string {
    const gliffyMacros = this.macroParser.findMacrosByName(storageContent, 'gliffy')

    if (gliffyMacros.length === 0) {
      return storageContent
    }

    this.logger.info(`Processing ${gliffyMacros.length} Gliffy diagrams...`)

    let processedContent = storageContent

    for (const macro of gliffyMacros) {
      const markdown = this.convertGliffyToMarkdown(macro)
      if (markdown) {
        processedContent = processedContent.replace(macro.rawXml, markdown)
      }
    }

    return processedContent
  }

  /**
   * Convert Gliffy macro to markdown
   */
  private convertGliffyToMarkdown(macro: ParsedMacro): string | null {
    const name = this.macroParser.getMacroParameter(macro, 'name') || 'gliffy-diagram'
    const displayName = this.macroParser.getMacroParameter(macro, 'displayName') || name
    const pageId = this.macroParser.getMacroParameter(macro, 'pagePin')

    let markdown = `\n<!-- Gliffy Diagram: ${displayName} -->\n`
    markdown += `![${displayName}](./assets/gliffy-${pageId || name}.png)\n`

    return markdown
  }

  /**
   * Process Lucidchart diagrams
   */
  private processLucidchart(storageContent: string): string {
    const lucidMacros = this.macroParser.findMacrosByName(storageContent, 'lucidchart')

    if (lucidMacros.length === 0) {
      return storageContent
    }

    this.logger.info(`Processing ${lucidMacros.length} Lucidchart diagrams...`)

    let processedContent = storageContent

    for (const macro of lucidMacros) {
      const markdown = this.convertLucidchartToMarkdown(macro)
      if (markdown) {
        processedContent = processedContent.replace(macro.rawXml, markdown)
      }
    }

    return processedContent
  }

  /**
   * Convert Lucidchart macro to markdown
   */
  private convertLucidchartToMarkdown(macro: ParsedMacro): string | null {
    const url = this.macroParser.getMacroParameter(macro, 'url')
    const title = this.macroParser.getMacroParameter(macro, 'title') || 'Lucidchart diagram'
    const width = this.macroParser.getMacroParameter(macro, 'width')
    const height = this.macroParser.getMacroParameter(macro, 'height')

    let markdown = `\n<!-- Lucidchart Diagram -->\n`

    if (url) {
      markdown += `<!-- Source URL: ${url} -->\n`
    }

    markdown += `![${title}](./assets/lucidchart-diagram.png)`

    if (width || height) {
      markdown += ` <!-- Size: ${width || 'auto'}x${height || 'auto'} -->`
    }

    markdown += '\n'

    return markdown
  }

  /**
   * Extract diagram metadata for export manifest
   */
  extractDiagramMetadata(
    storageContent: string,
  ): Array<{
    type: string
    name: string
    params: Record<string, string>
  }> {
    const metadata: Array<{
      type: string
      name: string
      params: Record<string, string>
    }> = []

    const diagramTypes = ['drawio', 'gliffy', 'lucidchart']

    for (const type of diagramTypes) {
      const macros = this.macroParser.findMacrosByName(storageContent, type)

      for (const macro of macros) {
        const params: Record<string, string> = {}
        for (const param of macro.parameters) {
          params[param.name] = param.value
        }

        metadata.push({
          type,
          name: params.name || params.diagramName || params.title || `${type}-diagram`,
          params,
        })
      }
    }

    return metadata
  }
}

export function createDiagramHandler(macroParser: MacroParser): DiagramHandler {
  return new DiagramHandler(macroParser)
}
