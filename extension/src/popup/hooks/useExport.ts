/**
 * React hook for export operations
 * Manages export state and communication with background worker
 *
 * Architecture:
 * - Listens for progress/complete/error messages from background
 * - Provides exportPage function to trigger exports
 * - Manages loading, progress, and error states
 */
import { useState, useEffect, useCallback } from 'react'
import { MessageType } from '../../shared/messages'

interface Progress {
  current: number
  total: number
  status: string
  percentage: number
}

export function useExport() {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Listen for messages from background worker
  useEffect(() => {
    const listener = (message: any) => {
      switch (message.type) {
        case MessageType.PROGRESS_UPDATE:
          setProgress(message.payload)
          setIsExporting(true)
          break

        case MessageType.EXPORT_COMPLETE:
          setProgress(null)
          setIsExporting(false)
          setError(null)
          break

        case MessageType.EXPORT_ERROR:
          setProgress(null)
          setIsExporting(false)
          setError(message.payload.error)
          break
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  /**
   * Export a single page
   */
  const exportPage = useCallback(
    async (
      pageId: string,
      options: { includeAttachments: boolean; includeChildren: boolean }
    ) => {
      setError(null)
      setProgress({
        current: 0,
        total: 1,
        status: 'Starting...',
        percentage: 0,
      })
      setIsExporting(true)

      try {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.EXPORT_PAGE,
          payload: { pageId, ...options },
        })

        if (!response?.success && response?.error) {
          setError(response.error)
          setIsExporting(false)
        }
      } catch (err: any) {
        setError(err.message)
        setIsExporting(false)
      }
    },
    []
  )

  /**
   * Export a space
   */
  const exportSpace = useCallback(
    async (spaceKey: string, includeAttachments: boolean) => {
      setError(null)
      setProgress({
        current: 0,
        total: 1,
        status: 'Starting...',
        percentage: 0,
      })
      setIsExporting(true)

      try {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.EXPORT_SPACE,
          payload: { spaceKey, includeAttachments },
        })

        if (!response?.success && response?.error) {
          setError(response.error)
          setIsExporting(false)
        }
      } catch (err: any) {
        setError(err.message)
        setIsExporting(false)
      }
    },
    []
  )

  /**
   * Export batch of pages
   */
  const exportBatch = useCallback(
    async (pageIds: string[], includeAttachments: boolean) => {
      setError(null)
      setProgress({
        current: 0,
        total: pageIds.length,
        status: 'Starting...',
        percentage: 0,
      })
      setIsExporting(true)

      try {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.EXPORT_BATCH,
          payload: { pageIds, includeAttachments },
        })

        if (!response?.success && response?.error) {
          setError(response.error)
          setIsExporting(false)
        }
      } catch (err: any) {
        setError(err.message)
        setIsExporting(false)
      }
    },
    []
  )

  return {
    progress,
    error,
    isExporting,
    exportPage,
    exportSpace,
    exportBatch,
  }
}
