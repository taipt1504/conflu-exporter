import { MacroHandler, MacroConversionContext } from './base-macro-handler.js'
import { ParsedMacro } from '../macro-parser.js'
import { getLogger } from '../../cli/ui/logger.js'

/**
 * Registry for macro handlers
 * Automatically routes macros to appropriate handlers based on macro name and conditions
 */
export class MacroHandlerRegistry {
  private logger = getLogger()
  private handlers: Map<string, MacroHandler[]> = new Map()
  private fallbackHandlers: MacroHandler[] = []

  /**
   * Register a handler for a specific macro name
   */
  register(handler: MacroHandler): void {
    const macroName = handler.getMacroName()

    if (macroName === '*') {
      // Wildcard handler - applies to all macros
      this.fallbackHandlers.push(handler)
      this.logger.debug(`Registered fallback handler: ${handler.constructor.name}`)
    } else {
      if (!this.handlers.has(macroName)) {
        this.handlers.set(macroName, [])
      }
      this.handlers.get(macroName)!.push(handler)
      this.logger.debug(`Registered handler for macro '${macroName}': ${handler.constructor.name}`)
    }
  }

  /**
   * Find the appropriate handler for a macro
   * Returns the first handler that can handle the macro
   */
  findHandler(macro: ParsedMacro): MacroHandler | null {
    // First, try handlers registered for this specific macro name
    const specificHandlers = this.handlers.get(macro.name) || []
    for (const handler of specificHandlers) {
      if (handler.canHandle(macro)) {
        return handler
      }
    }

    // Fallback to wildcard handlers
    for (const handler of this.fallbackHandlers) {
      if (handler.canHandle(macro)) {
        return handler
      }
    }

    return null
  }

  /**
   * Convert a macro using the appropriate handler
   */
  async convert(macro: ParsedMacro, context: MacroConversionContext): Promise<string | null> {
    const handler = this.findHandler(macro)

    if (!handler) {
      this.logger.debug(`No handler found for macro '${macro.name}'`)
      return null
    }

    try {
      return await handler.convert(macro, context)
    } catch (error) {
      this.logger.error(`Handler ${handler.constructor.name} failed for macro '${macro.name}':`, error)
      return null
    }
  }

  /**
   * Get all macro names supported by registered handlers
   */
  getSupportedMacroNames(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Check if a macro type is supported
   */
  isSupported(macroName: string): boolean {
    return this.handlers.has(macroName) || this.fallbackHandlers.length > 0
  }

  /**
   * Clear all registered handlers
   */
  clear(): void {
    this.handlers.clear()
    this.fallbackHandlers = []
  }
}

/**
 * Global registry instance
 */
export const globalMacroHandlerRegistry = new MacroHandlerRegistry()
