/**
 * Form for single page export
 * Auto-detects current Confluence page ID
 */
import React, { useState, useEffect } from 'react'

interface ExportFormProps {
  onSubmit: (
    pageId: string,
    options: ExportOptions
  ) => void
  disabled: boolean
}

interface ExportOptions {
  includeAttachments: boolean
  includeChildren: boolean
}

export const ExportForm: React.FC<ExportFormProps> = ({
  onSubmit,
  disabled,
}) => {
  const [pageId, setPageId] = useState('')
  const [options, setOptions] = useState<ExportOptions>({
    includeAttachments: true,
    includeChildren: false,
  })
  const [currentPageId, setCurrentPageId] = useState<string | null>(null)

  // Auto-detect current page ID
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url
      if (url) {
        const id = extractPageIdFromUrl(url)
        if (id) {
          setCurrentPageId(id)
          setPageId(id)
        }
      }
    })
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pageId.trim()) {
      onSubmit(pageId.trim(), options)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Current Page Detection */}
      {currentPageId && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-sm text-blue-800">
            ✓ Current page detected: <strong>{currentPageId}</strong>
          </p>
        </div>
      )}

      {/* Page ID Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Page ID or URL
        </label>
        <input
          type="text"
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          placeholder="e.g., 123456 or paste Confluence URL"
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:bg-gray-100 disabled:cursor-not-allowed"
          required
        />
      </div>

      {/* Options */}
      <div className="space-y-2">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={options.includeAttachments}
            onChange={(e) =>
              setOptions({ ...options, includeAttachments: e.target.checked })
            }
            disabled={disabled}
            className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded
                       focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Include attachments and images
          </span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={options.includeChildren}
            onChange={(e) =>
              setOptions({ ...options, includeChildren: e.target.checked })
            }
            disabled={disabled}
            className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded
                       focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Include child pages</span>
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={disabled || !pageId.trim()}
        className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md
                   hover:bg-blue-700 focus:outline-none focus:ring-2
                   focus:ring-blue-500 focus:ring-offset-2
                   disabled:bg-gray-400 disabled:cursor-not-allowed
                   transition-colors"
      >
        {disabled ? 'Exporting...' : 'Export Page'}
      </button>
    </form>
  )
}

/**
 * Extract page ID from Confluence URL
 */
function extractPageIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)

    const pathMatch = urlObj.pathname.match(/\/pages\/(\d+)/)
    if (pathMatch) return pathMatch[1]

    const pageIdParam = urlObj.searchParams.get('pageId')
    if (pageIdParam) return pageIdParam

    return null
  } catch {
    return null
  }
}
