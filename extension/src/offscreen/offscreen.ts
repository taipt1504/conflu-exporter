/**
 * Offscreen Document for DOM-dependent operations
 *
 * Background service workers don't have DOM/document access.
 * This offscreen document provides a hidden DOM context for:
 * - Turndown (HTML to Markdown conversion)
 * - DOMParser operations
 * - Any DOM-dependent libraries
 *
 * Architecture:
 * - Service worker sends conversion tasks via chrome.runtime.sendMessage
 * - Offscreen document processes with full DOM access
 * - Returns results back to service worker
 */

import { BrowserMarkdownConverter, ConfluencePageData } from '../adapters/BrowserMarkdownConverter'

console.log('[Offscreen] Offscreen document initialized')

// Listen for requests from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] Received message:', message.type)

  if (message.type === 'CONVERT_TO_MARKDOWN') {
    handleConversion(message.payload)
      .then(result => {
        console.log('[Offscreen] Conversion successful')
        sendResponse({ success: true, result })
      })
      .catch(error => {
        console.error('[Offscreen] Conversion failed:', error)
        sendResponse({
          success: false,
          error: error.message,
          stack: error.stack
        })
      })

    return true // Keep channel open for async response
  }

  if (message.type === 'DOWNLOAD_FILE') {
    handleDownload(message.payload)
      .then(result => {
        console.log('[Offscreen] Blob URL created successfully')
        sendResponse({ success: true, blobUrl: result.blobUrl })
      })
      .catch(error => {
        console.error('[Offscreen] Blob creation failed:', error)
        sendResponse({
          success: false,
          error: error.message,
          stack: error.stack
        })
      })

    return true // Keep channel open for async response
  }

  // CREATE_BLOB_URL: Create blob URL from data array (for ZIP downloads)
  // CRITICAL: Data comes as number[] because ArrayBuffer can't be serialized
  if (message.type === 'CREATE_BLOB_URL') {
    try {
      const { data, mimeType } = message.payload
      
      // Convert number array back to Uint8Array
      const uint8Array = new Uint8Array(data)
      console.log(`[Offscreen] Received data: ${uint8Array.length} bytes`)
      
      const blob = new Blob([uint8Array], { type: mimeType || 'application/octet-stream' })
      const blobUrl = URL.createObjectURL(blob)
      console.log('[Offscreen] Created blob URL for ZIP:', blobUrl, `(${blob.size} bytes)`)
      sendResponse({ success: true, blobUrl })
    } catch (error: any) {
      console.error('[Offscreen] CREATE_BLOB_URL failed:', error)
      sendResponse({ success: false, error: error.message })
    }
    return true
  }

  // REVOKE_BLOB_URL: Clean up blob URL
  if (message.type === 'REVOKE_BLOB_URL') {
    try {
      const { blobUrl } = message.payload
      URL.revokeObjectURL(blobUrl)
      console.log('[Offscreen] Revoked blob URL:', blobUrl)
      sendResponse({ success: true })
    } catch (error: any) {
      console.error('[Offscreen] REVOKE_BLOB_URL failed:', error)
      sendResponse({ success: false, error: error.message })
    }
    return true
  }
})

/**
 * Convert Confluence page to Markdown using BrowserMarkdownConverter
 */
async function handleConversion(payload: {
  page: ConfluencePageData;
  mermaidAttachments?: Record<string, string>;
}): Promise<{ content: string; metadata: any }> {
  const { page, mermaidAttachments } = payload

  const converter = new BrowserMarkdownConverter({
    frontmatter: true,
    preserveHtml: false,
    gfm: true,
  })

  // Set Mermaid attachments if provided
  if (mermaidAttachments && Object.keys(mermaidAttachments).length > 0) {
    const attachmentMap = new Map(Object.entries(mermaidAttachments))
    converter.setMermaidAttachments(attachmentMap)
    console.log(`[Offscreen] Set ${attachmentMap.size} Mermaid attachments`)
  }

  const result = await converter.convert(page)

  return {
    content: result.content,
    metadata: result.metadata,
  }
}

/**
 * Create blob URL for download
 * Offscreen has DOM access for URL.createObjectURL but NOT chrome.downloads
 * Returns blob URL for service worker to download
 */
async function handleDownload(payload: {
  filename: string
  content: string | ArrayBuffer
  type: 'markdown' | 'attachment'
}): Promise<{ blobUrl: string }> {
  const { content, type } = payload

  let blob: Blob
  if (type === 'markdown') {
    blob = new Blob([content as string], { type: 'text/markdown;charset=utf-8' })
  } else {
    blob = new Blob([content as ArrayBuffer])
  }

  // Create blob URL (requires DOM context)
  const blobUrl = URL.createObjectURL(blob)

  console.log('[Offscreen] Created blob URL:', blobUrl)

  return { blobUrl }
}
