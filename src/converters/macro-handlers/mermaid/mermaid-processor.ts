import { MacroParser } from '../../macro-parser.js'
import { MacroHandlerRegistry } from '../macro-handler-registry.js'
import { MacroConversionContext } from '../base-macro-handler.js'
import { BuiltinMermaidHandler } from './builtin-mermaid-handler.js'
import { PluginMermaidHandler } from './plugin-mermaid-handler.js'
import {
  getAllMacroNames,
  getBuiltinMacroNames,
  getPluginMacroNames,
} from './mermaid-variants.config.js'
import { getLogger } from '../../../cli/ui/logger.js'

/**
 * Mermaid Processor
 * Orchestrates mermaid diagram conversion using registry pattern
 * Automatically supports all variants defined in mermaid-variants.config.ts
 */
export class MermaidProcessor {
  private logger = getLogger()
  private registry: MacroHandlerRegistry
  private macroParser: MacroParser
  private attachmentContentCache: Map<string, string> = new Map()
  private builtinHandler: BuiltinMermaidHandler
  private pluginHandlers: PluginMermaidHandler[] = []

  constructor(macroParser: MacroParser) {
    this.macroParser = macroParser
    this.registry = new MacroHandlerRegistry()

    // Create handlers
    this.builtinHandler = new BuiltinMermaidHandler(macroParser)

    // Create individual handler instances for each plugin macro
    for (const macroName of getPluginMacroNames()) {
      this.pluginHandlers.push(new PluginMermaidHandler(macroParser, [macroName]))
    }

    // Register handlers
    this.setupHandlers()
  }

  /**
   * Setup handlers from configuration
   * This is where we register all handlers based on mermaid-variants.config.ts
   */
  private setupHandlers(): void {
    // Register built-in handler
    this.registry.register(this.builtinHandler)

    // Register each plugin handler
    for (const handler of this.pluginHandlers) {
      this.registry.register(handler)
    }

    this.logger.debug(
      `Registered mermaid handlers for: ${this.registry.getSupportedMacroNames().join(', ')}`,
    )
  }

  /**
   * Set mermaid attachment content
   */
  setAttachmentContent(filename: string, content: string): void {
    this.attachmentContentCache.set(filename, content)
    this.logger.debug(`Cached mermaid attachment: ${filename}`)
  }

  /**
   * Set multiple mermaid attachments
   */
  setMermaidAttachments(attachments: Map<string, string>): void {
    for (const [filename, content] of attachments) {
      this.setAttachmentContent(filename, content)
    }
    this.logger.info(`Cached ${attachments.size} mermaid attachment(s)`)
  }

  /**
   * Clear attachment cache
   */
  clearCache(): void {
    this.attachmentContentCache.clear()
  }

  /**
   * Process all mermaid macros in storage content
   */
  async process(storageContent: string, pageId?: string, spaceKey?: string): Promise<string> {
    // Find all mermaid macros (all variants)
    const allMacroNames = getAllMacroNames()
    const allMacros = allMacroNames.flatMap((name) =>
      this.macroParser.findMacrosByName(storageContent, name),
    )

    if (allMacros.length === 0) {
      this.logger.debug('No mermaid macros found')
      return storageContent
    }

    // Count by type
    const builtinCount = allMacros.filter((m) => getBuiltinMacroNames().includes(m.name)).length
    const pluginCount = allMacros.filter((m) => getPluginMacroNames().includes(m.name)).length

    this.logger.info(
      `Processing ${allMacros.length} Mermaid diagrams (${builtinCount} built-in, ${pluginCount} plugin)...`,
    )

    // Create conversion context
    const context: MacroConversionContext = {
      storageContent,
      attachmentCache: this.attachmentContentCache,
      pageId,
      spaceKey,
    }

    let processedContent = storageContent

    // Process each macro
    for (const macro of allMacros) {
      try {
        const html = await this.registry.convert(macro, context)
        if (html) {
          // Replace macro XML with placeholder HTML
          processedContent = this.replaceMacroInContent(processedContent, macro, html)
        }
      } catch (error) {
        this.logger.error(`Failed to process macro '${macro.name}':`, error)
      }
    }

    this.logger.debug(`After mermaid processing: ${processedContent.length} chars`)
    this.logger.debug(
      `Processed content contains data-mermaid-placeholder: ${processedContent.includes('data-mermaid-placeholder')}`,
    )
    this.logger.debug(
      `Count of data-mermaid-placeholder: ${(processedContent.match(/data-mermaid-placeholder/g) || []).length}`,
    )

    return processedContent
  }

  /**
   * Replace macro XML in content with placeholder HTML
   * Handles HTML entity encoding issues
   */
  private replaceMacroInContent(content: string, macro: any, html: string): string {
    // Try exact match first
    if (content.includes(macro.rawXml)) {
      this.logger.debug(`Successfully replaced macro XML (exact match)`)
      return content.replace(macro.rawXml, html)
    }

    // Fallback: Find and replace by unique macro-id
    const macroIdMatch = macro.rawXml.match(/ac:macro-id="([^"]+)"/)
    if (macroIdMatch) {
      const macroId = macroIdMatch[1]
      const macroStart = content.indexOf(`ac:macro-id="${macroId}"`)

      if (macroStart >= 0) {
        // Find the opening and closing tags
        const beforeMacroId = content.substring(0, macroStart)
        const tagStart = beforeMacroId.lastIndexOf('<ac:structured-macro')

        if (tagStart >= 0) {
          const afterTagStart = content.substring(tagStart)
          const tagEnd =
            afterTagStart.indexOf('</ac:structured-macro>') + '</ac:structured-macro>'.length

          if (tagEnd > 0) {
            const originalMacroXml = afterTagStart.substring(0, tagEnd)
            this.logger.debug(`Successfully replaced macro XML (by macro ID)`)
            return content.replace(originalMacroXml, html)
          }
        }
      }
    }

    this.logger.warn(`Macro XML not found in content! Macro ID: ${macroIdMatch?.[1]}`)
    return content
  }

  /**
   * Replace placeholders in markdown with actual mermaid code blocks
   */
  replacePlaceholders(markdown: string): string {
    // Replace placeholders from builtin handler
    let result = this.builtinHandler.replacePlaceholders(markdown)

    // Replace placeholders from all plugin handlers
    for (const handler of this.pluginHandlers) {
      result = handler.replacePlaceholders(result)
    }

    return result
  }

  /**
   * Clear placeholders
   */
  clearPlaceholders(): void {
    this.builtinHandler.clearPlaceholders()
    for (const handler of this.pluginHandlers) {
      handler.clearPlaceholders()
    }
  }
}
