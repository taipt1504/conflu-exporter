/**
 * Background service worker
 * Orchestrates export operations and context menu
 *
 * Architecture:
 * - Entry point for background tasks
 * - Handles context menu clicks
 * - Routes messages from popup/options
 * - Coordinates export operations
 */
import { setupContextMenus } from './context-menu'
import { MessageHandler } from './message-handler'

// Initialize on extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Confluence Exporter installed')
  setupContextMenus()
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'export-current-page' && tab?.url) {
    handleContextMenuExport(tab.url)
  }
})

// Handle messages from popup/options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = new MessageHandler()

  handler
    .handle(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        success: false,
        error: error.message,
        details: error.stack,
      })
    })

  return true // Async response
})

/**
 * Extract page ID from Confluence URL and trigger export
 */
async function handleContextMenuExport(url: string): Promise<void> {
  const pageId = extractPageIdFromUrl(url)
  if (!pageId) {
    console.error('Could not extract page ID from URL:', url)
    return
  }

  const { ExportManager } = await import('./export-manager')
  const manager = new ExportManager()

  await manager.exportPage({
    pageId,
    includeAttachments: true,
    includeChildren: false,
  })
}

/**
 * Extract Confluence page ID from URL
 * Handles multiple URL formats:
 * - /pages/123456
 * - /pages/viewpage.action?pageId=123456
 * - /wiki/spaces/SPACE/pages/123456/Page+Title
 */
function extractPageIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)

    // Format 1: /pages/123456 or /wiki/spaces/SPACE/pages/123456/...
    const pathMatch = urlObj.pathname.match(/\/pages\/(\d+)/)
    if (pathMatch) return pathMatch[1]

    // Format 2: /pages/viewpage.action?pageId=123456
    const pageIdParam = urlObj.searchParams.get('pageId')
    if (pageIdParam) return pageIdParam

    return null
  } catch (error) {
    console.error('Error parsing URL:', error)
    return null
  }
}
