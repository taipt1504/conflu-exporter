/**
 * Main popup component
 * Provides UI for single page, space, and batch export
 */
import React, { useState } from 'react'
import { ExportForm } from './components/ExportForm'
import { SpaceExportForm } from './components/SpaceExportForm'
import { BatchExportForm } from './components/BatchExportForm'
import { ProgressBar } from './components/ProgressBar'
import { ErrorDisplay } from './components/ErrorDisplay'
import { useExport } from './hooks/useExport'

export const Popup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'space' | 'batch'>(
    'single'
  )
  const { progress, error, isExporting, exportPage, exportSpace, exportBatch } = useExport()

  return (
    <div className="w-[420px] min-h-[500px] bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-md">
        <h1 className="text-xl font-bold">Confluence Exporter</h1>
        <p className="text-sm opacity-90 mt-1">Export pages to Markdown</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-300 bg-white">
        <TabButton
          active={activeTab === 'single'}
          onClick={() => setActiveTab('single')}
          disabled={isExporting}
        >
          Single Page
        </TabButton>
        <TabButton
          active={activeTab === 'space'}
          onClick={() => setActiveTab('space')}
          disabled={isExporting}
        >
          Space
        </TabButton>
        <TabButton
          active={activeTab === 'batch'}
          onClick={() => setActiveTab('batch')}
          disabled={isExporting}
        >
          Batch
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'single' && (
          <ExportForm onSubmit={exportPage} disabled={isExporting} />
        )}

        {activeTab === 'space' && (
          <SpaceExportForm onSubmit={exportSpace} disabled={isExporting} />
        )}

        {activeTab === 'batch' && (
          <BatchExportForm onSubmit={exportBatch} disabled={isExporting} />
        )}

        {/* Progress Display */}
        {progress && (
          <div className="mt-4">
            <ProgressBar {...progress} />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4">
            <ErrorDisplay error={error} />
          </div>
        )}

        {/* Ready Message */}
        {!progress && !error && !isExporting && (
          <div className="mt-4 text-center text-gray-500 text-sm">
            Ready to export
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-300 p-3 bg-white">
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="text-sm text-blue-600 hover:underline focus:outline-none"
        >
          ⚙️ Configure Settings
        </button>
      </div>
    </div>
  )
}

/**
 * Tab button component
 */
const TabButton: React.FC<{
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}> = ({ active, onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex-1 py-3 text-sm font-medium transition-colors
      ${
        active
          ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
          : 'text-gray-600 hover:bg-gray-50'
      }
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    {children}
  </button>
)
