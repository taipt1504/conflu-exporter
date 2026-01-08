import { ParsedMacro } from '../macro-parser.js'

/**
 * Base interface for all macro handlers
 * Each handler is responsible for converting a specific macro type to markdown
 */
export interface MacroHandler {
  /**
   * Name of the macro this handler supports (e.g., 'mermaid', 'mermaid-cloud')
   */
  getMacroName(): string

  /**
   * Check if this handler can process the given macro
   * Useful for handlers that support multiple macro names or conditional processing
   */
  canHandle(macro: ParsedMacro): boolean

  /**
   * Convert the macro to HTML placeholder or markdown
   * Returns null if macro cannot be converted
   */
  convert(macro: ParsedMacro, context: MacroConversionContext): Promise<string | null>
}

/**
 * Context provided to macro handlers during conversion
 */
export interface MacroConversionContext {
  /**
   * Storage content being processed
   */
  storageContent: string

  /**
   * Attachment content cache (filename -> content)
   */
  attachmentCache: Map<string, string>

  /**
   * Page metadata
   */
  pageId?: string
  spaceKey?: string
}

/**
 * Result of macro conversion
 */
export interface MacroConversionResult {
  /**
   * Converted HTML or placeholder
   */
  html: string

  /**
   * Whether to replace the original macro XML
   */
  shouldReplace: boolean

  /**
   * Optional metadata for post-processing
   */
  metadata?: Record<string, any>
}
