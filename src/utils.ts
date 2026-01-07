/**
 * Utility functions for the Confluence exporter
 */

/**
 * Format a date to ISO string
 * @param date - Date to format
 * @returns ISO formatted date string
 */
export function formatDate(date: Date): string {
  return date.toISOString()
}

/**
 * Sanitize a filename by removing invalid characters
 * @param filename - Filename to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9_\-\.]/gi, '_')
}

/**
 * Extract space key from a Confluence URL
 * @param url - Confluence page URL
 * @returns Space key or null if not found
 */
export function extractSpaceKey(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const match = urlObj.pathname.match(/\/spaces\/([^/]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}
