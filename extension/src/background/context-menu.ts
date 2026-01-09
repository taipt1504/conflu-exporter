/**
 * Context menu configuration
 * Adds "Export to Markdown" option to right-click menu on Confluence pages
 *
 * Architecture:
 * - Registers context menu on extension install/update
 * - Only appears on Confluence pages (filtered by URL patterns)
 * - Triggers export via service worker
 */

export function setupContextMenus(): void {
  // Remove existing menus first to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'export-current-page',
      title: 'Export to Markdown',
      contexts: ['page'],
      documentUrlPatterns: [
        // Confluence Cloud patterns
        '*://*.atlassian.net/wiki/*',
        '*://*.atlassian.net/pages/*',
        // Self-hosted Confluence patterns
        '*://*/wiki/*',
        '*://*/pages/*',
      ],
    })
  })
}
