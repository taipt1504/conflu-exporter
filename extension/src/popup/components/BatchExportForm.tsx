/**
 * Form for batch exporting multiple Confluence pages
 * Supports entering multiple page IDs or URLs
 */
import React, { useState } from 'react'

interface BatchExportFormProps {
  onSubmit: (pageIds: string[], includeAttachments: boolean) => void
  disabled: boolean
}

export const BatchExportForm: React.FC<BatchExportFormProps> = ({
  onSubmit,
  disabled,
}) => {
  const [pageIdsInput, setPageIdsInput] = useState('')
  const [includeAttachments, setIncludeAttachments] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const pageIds = parsePageIds(pageIdsInput)
    if (pageIds.length > 0) {
      onSubmit(pageIds, includeAttachments)
    }
  }

  const parsedIds = parsePageIds(pageIdsInput)
  const hasValidIds = parsedIds.length > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Page IDs Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Page IDs or URLs
        </label>
        <textarea
          value={pageIdsInput}
          onChange={(e) => setPageIdsInput(e.target.value)}
          placeholder={`Enter page IDs or URLs, one per line:

123456
789012
https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title`}
          disabled={disabled}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:bg-gray-100 disabled:cursor-not-allowed
                     text-sm font-mono"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Supports page IDs (numbers) or full Confluence URLs
        </p>
      </div>

      {/* Parsed Preview */}
      {hasValidIds && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-sm text-blue-800 font-medium mb-1">
            {parsedIds.length} page{parsedIds.length > 1 ? 's' : ''} detected:
          </p>
          <div className="flex flex-wrap gap-1">
            {parsedIds.slice(0, 10).map((id, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
              >
                {id}
              </span>
            ))}
            {parsedIds.length > 10 && (
              <span className="px-2 py-0.5 bg-blue-200 text-blue-700 text-xs rounded">
                +{parsedIds.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

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

      {/* Submit Button */}
      <button
        type="submit"
        disabled={disabled || !hasValidIds}
        className="w-full py-2 px-4 bg-purple-600 text-white font-medium rounded-md
                   hover:bg-purple-700 focus:outline-none focus:ring-2
                   focus:ring-purple-500 focus:ring-offset-2
                   disabled:bg-gray-400 disabled:cursor-not-allowed
                   transition-colors"
      >
        {disabled
          ? 'Exporting...'
          : hasValidIds
            ? `Export ${parsedIds.length} Page${parsedIds.length > 1 ? 's' : ''}`
            : 'Enter Page IDs'}
      </button>
    </form>
  )
}

/**
 * Parse input text into array of page IDs
 * Handles both raw IDs and Confluence URLs
 */
function parsePageIds(input: string): string[] {
  const lines = input
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const pageIds: string[] = []

  for (const line of lines) {
    // Check if it's a URL
    if (line.startsWith('http')) {
      const id = extractPageIdFromUrl(line)
      if (id) pageIds.push(id)
    }
    // Check if it's just a number (page ID)
    else if (/^\d+$/.test(line)) {
      pageIds.push(line)
    }
  }

  // Remove duplicates
  return [...new Set(pageIds)]
}

/**
 * Extract page ID from Confluence URL
 */
function extractPageIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)

    // Format: /pages/123456 or /wiki/spaces/SPACE/pages/123456/...
    const pathMatch = urlObj.pathname.match(/\/pages\/(\d+)/)
    if (pathMatch) return pathMatch[1]

    // Format: ?pageId=123456
    const pageIdParam = urlObj.searchParams.get('pageId')
    if (pageIdParam) return pageIdParam

    return null
  } catch {
    return null
  }
}
