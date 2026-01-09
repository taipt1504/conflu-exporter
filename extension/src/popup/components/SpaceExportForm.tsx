/**
 * Form for exporting entire Confluence space
 * Allows user to input space key and export options
 */
import React, { useState, useEffect } from 'react'

interface SpaceExportFormProps {
  onSubmit: (spaceKey: string, includeAttachments: boolean) => void
  disabled: boolean
}

export const SpaceExportForm: React.FC<SpaceExportFormProps> = ({
  onSubmit,
  disabled,
}) => {
  const [spaceKey, setSpaceKey] = useState('')
  const [includeAttachments, setIncludeAttachments] = useState(true)
  const [detectedSpaceKey, setDetectedSpaceKey] = useState<string | null>(null)

  // Auto-detect space key from current URL
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url
      if (url) {
        const key = extractSpaceKeyFromUrl(url)
        if (key) {
          setDetectedSpaceKey(key)
          setSpaceKey(key)
        }
      }
    })
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (spaceKey.trim()) {
      onSubmit(spaceKey.trim().toUpperCase(), includeAttachments)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Auto-detected Space */}
      {detectedSpaceKey && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <p className="text-sm text-green-800">
            ✓ Current space detected: <strong>{detectedSpaceKey}</strong>
          </p>
        </div>
      )}

      {/* Space Key Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Space Key
        </label>
        <input
          type="text"
          value={spaceKey}
          onChange={(e) => setSpaceKey(e.target.value.toUpperCase())}
          placeholder="e.g., DOCS, TEAM, PROJECT"
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:bg-gray-100 disabled:cursor-not-allowed
                     uppercase"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          The space key is visible in the URL: /wiki/spaces/<strong>KEY</strong>/...
        </p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={includeAttachments}
            onChange={(e) => setIncludeAttachments(e.target.checked)}
            disabled={disabled}
            className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded
                       focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Include attachments and images
          </span>
        </label>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded p-3">
        <p className="text-sm text-amber-800">
          ⚠️ Exporting an entire space may take several minutes depending on the
          number of pages.
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={disabled || !spaceKey.trim()}
        className="w-full py-2 px-4 bg-green-600 text-white font-medium rounded-md
                   hover:bg-green-700 focus:outline-none focus:ring-2
                   focus:ring-green-500 focus:ring-offset-2
                   disabled:bg-gray-400 disabled:cursor-not-allowed
                   transition-colors"
      >
        {disabled ? 'Exporting...' : 'Export Entire Space'}
      </button>
    </form>
  )
}

/**
 * Extract space key from Confluence URL
 * Handles: /wiki/spaces/SPACEKEY/...
 */
function extractSpaceKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const match = urlObj.pathname.match(/\/wiki\/spaces\/([A-Za-z0-9_-]+)/)
    return match ? match[1].toUpperCase() : null
  } catch {
    return null
  }
}
