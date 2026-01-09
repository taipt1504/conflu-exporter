/**
 * Browser file downloader
 * Replaces Node.js fs operations with chrome.downloads API
 *
 * Architecture:
 * - Uses chrome.downloads API for file downloads
 * - Creates object URLs for blob data
 * - Handles filename sanitization for file system compatibility
 * - Automatic cleanup of object URLs
 * - Configurable download folder path
 */
export class BrowserDownloader {
  private downloadFolder: string = 'confluence-exports'

  /**
   * Set download folder path
   */
  setDownloadFolder(folder: string): void {
    this.downloadFolder = folder || 'confluence-exports'
  }

  /**
   * Download markdown file
   */
  async downloadMarkdown(filename: string, content: string): Promise<void> {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    await this.downloadBlob(filename, blob)
  }

  /**
   * Download binary attachment
   */
  async downloadAttachment(
    filename: string,
    buffer: ArrayBuffer
  ): Promise<void> {
    const blob = new Blob([buffer])
    await this.downloadBlob(filename, blob)
  }

  /**
   * Download JSON file
   */
  async downloadJson(filename: string, data: any): Promise<void> {
    const content = JSON.stringify(data, null, 2)
    const blob = new Blob([content], {
      type: 'application/json;charset=utf-8',
    })
    await this.downloadBlob(filename, blob)
  }

  /**
   * Download multiple files (creates individual downloads)
   * Note: Chrome doesn't allow multiple simultaneous downloads without user interaction
   * This method downloads files sequentially with a small delay
   */
  async downloadMultiple(
    files: Array<{ filename: string; content: string | ArrayBuffer }>
  ): Promise<void> {
    for (const file of files) {
      if (typeof file.content === 'string') {
        await this.downloadMarkdown(file.filename, file.content)
      } else {
        await this.downloadAttachment(file.filename, file.content)
      }

      // Small delay to avoid triggering Chrome's download blocking
      await this.delay(100)
    }
  }

  /**
   * Download blob using chrome.downloads API
   */
  private async downloadBlob(filename: string, blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob)

    try {
      await chrome.downloads.download({
        url,
        filename: `${this.downloadFolder}/${this.sanitizeFilename(filename)}`,
        saveAs: false,
        conflictAction: 'uniquify',
      })
    } catch (error: any) {
      console.error(`Failed to download ${filename}:`, error)
      throw new Error(`Download failed: ${error.message}`)
    } finally {
      // Clean up object URL after a short delay to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  /**
   * Sanitize filename for file system
   * Removes/replaces invalid characters and limits length
   */
  private sanitizeFilename(filename: string): string {
    return (
      filename
        // Replace invalid characters with underscore
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        // Replace multiple spaces with single underscore
        .replace(/\s+/g, '_')
        // Remove leading/trailing underscores
        .replace(/^_+|_+$/g, '')
        // Limit length (Chrome has a 255 character limit for filenames)
        .substring(0, 200)
    )
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
