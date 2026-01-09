/**
 * Error message display
 */
import React from 'react'

interface ErrorDisplayProps {
  error: string
  details?: string
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  details,
}) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-red-600 text-xl">⚠️</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">Export Failed</h3>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          {details && (
            <details className="mt-2">
              <summary className="text-xs text-red-600 cursor-pointer">
                Show details
              </summary>
              <pre className="mt-1 text-xs text-red-600 bg-red-100 p-2 rounded overflow-x-auto">
                {details}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
