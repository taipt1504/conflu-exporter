/**
 * Configuration for Mermaid macro variants
 * Add new variants here to automatically support them
 */
export interface MermaidVariantConfig {
  /**
   * Macro name in Confluence storage format
   */
  macroName: string

  /**
   * Type of variant
   */
  type: 'builtin' | 'plugin'

  /**
   * Description for documentation
   */
  description: string

  /**
   * Expected attachment file extensions (if any)
   */
  attachmentExtensions?: string[]

  /**
   * Whether this variant uses text/plain attachments without extension
   */
  usesPlainTextAttachments?: boolean
}

/**
 * Registry of all known Mermaid macro variants
 * To add support for a new variant, simply add it to this array
 */
export const MERMAID_VARIANTS: MermaidVariantConfig[] = [
  {
    macroName: 'mermaid',
    type: 'builtin',
    description: 'Built-in Confluence mermaid macro with plain text body or .mmd attachments',
    attachmentExtensions: ['.mmd', '.mermaid'],
  },
  {
    macroName: 'mermaid-cloud',
    type: 'plugin',
    description: 'Mermaid for Confluence plugin (newer version) with text/plain attachments',
    usesPlainTextAttachments: true,
  },
  {
    macroName: 'mermaid-macro',
    type: 'plugin',
    description: 'Mermaid for Confluence plugin (older version) with text/plain attachments',
    usesPlainTextAttachments: true,
  },
  // Add new variants here:
  // {
  //   macroName: 'mermaid-pro',
  //   type: 'plugin',
  //   description: 'Mermaid Pro plugin with advanced features',
  //   usesPlainTextAttachments: true,
  // },
]

/**
 * Get all macro names that use built-in handler
 */
export function getBuiltinMacroNames(): string[] {
  return MERMAID_VARIANTS.filter((v) => v.type === 'builtin').map((v) => v.macroName)
}

/**
 * Get all macro names that use plugin handler
 */
export function getPluginMacroNames(): string[] {
  return MERMAID_VARIANTS.filter((v) => v.type === 'plugin').map((v) => v.macroName)
}

/**
 * Get all supported macro names
 */
export function getAllMacroNames(): string[] {
  return MERMAID_VARIANTS.map((v) => v.macroName)
}

/**
 * Check if a macro uses text/plain attachments
 */
export function usesPlainTextAttachments(macroName: string): boolean {
  const variant = MERMAID_VARIANTS.find((v) => v.macroName === macroName)
  return variant?.usesPlainTextAttachments || false
}

/**
 * Get attachment extensions for a macro
 */
export function getAttachmentExtensions(macroName: string): string[] {
  const variant = MERMAID_VARIANTS.find((v) => v.macroName === macroName)
  return variant?.attachmentExtensions || []
}
