/**
 * Options page for configuration
 */
import React, { useState, useEffect } from 'react'
import { ConfigStorage } from '../shared/storage'
import type { ExtensionConfig } from '../shared/storage'

export const Options: React.FC = () => {
  const [config, setConfig] = useState<ExtensionConfig>({
    confluenceUrl: '',
    email: '',
    apiToken: '',
    exportSettings: {
      includeAttachments: true,
      includeChildren: false,
      format: 'markdown',
      downloadFolder: 'confluence-exports',
    },
  })
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(
    null
  )
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const storage = new ConfigStorage()

  // Load saved config on mount
  useEffect(() => {
    storage.getConfig().then((savedConfig) => {
      if (savedConfig) setConfig(savedConfig)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await storage.saveConfig(config)
      alert('✓ Settings saved successfully!')
    } catch (error: any) {
      alert(`✗ Failed to save: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const isConnected = await storage.testConnection()
      setTestResult(isConnected ? 'success' : 'error')
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Confluence Exporter Settings
          </h1>
          <p className="mt-2 text-gray-600">
            Configure your Confluence credentials and export preferences
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Confluence URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confluence URL *
            </label>
            <input
              type="url"
              value={config.confluenceUrl}
              onChange={(e) =>
                setConfig({ ...config, confluenceUrl: e.target.value })
              }
              placeholder="https://your-domain.atlassian.net"
              className="w-full px-4 py-2 border border-gray-300 rounded-md
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Your Confluence Cloud or self-hosted URL
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={config.email}
              onChange={(e) =>
                setConfig({ ...config, email: e.target.value })
              }
              placeholder="your-email@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-md
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* API Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Token *
            </label>
            <input
              type="password"
              value={config.apiToken}
              onChange={(e) =>
                setConfig({ ...config, apiToken: e.target.value })
              }
              placeholder="Enter your Confluence API token"
              className="w-full px-4 py-2 border border-gray-300 rounded-md
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Generate at:{' '}
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Atlassian Account Settings → Security → API tokens
              </a>
            </p>
          </div>

          <hr className="border-gray-200" />

          {/* Export Settings */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">
              Default Export Settings
            </h3>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.exportSettings.includeAttachments}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    exportSettings: {
                      ...config.exportSettings,
                      includeAttachments: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded
                           focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Include attachments and images by default
              </span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.exportSettings.includeChildren}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    exportSettings: {
                      ...config.exportSettings,
                      includeChildren: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded
                           focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Include child pages by default
              </span>
            </label>

            {/* Download Folder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Download Folder
              </label>
              <input
                type="text"
                value={config.exportSettings.downloadFolder}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    exportSettings: {
                      ...config.exportSettings,
                      downloadFolder: e.target.value,
                    },
                  })
                }
                placeholder="confluence-exports"
                className="w-full px-3 py-2 border border-gray-300 rounded-md
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Folder path where exported files will be saved (relative to Downloads folder)
              </p>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Test Connection */}
          <div>
            <button
              onClick={handleTest}
              disabled={
                testing ||
                !config.confluenceUrl ||
                !config.email ||
                !config.apiToken
              }
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md
                         hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors mr-3"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            {testResult === 'success' && (
              <span className="inline-flex items-center text-green-600 text-sm">
                <span className="text-lg mr-1">✓</span> Connected successfully
              </span>
            )}
            {testResult === 'error' && (
              <span className="inline-flex items-center text-red-600 text-sm">
                <span className="text-lg mr-1">✗</span> Connection failed.
                Check credentials.
              </span>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md
                         hover:bg-blue-700 focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:ring-offset-2
                         disabled:bg-blue-400 disabled:cursor-not-allowed
                         transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            Need Help?
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • API tokens can be created in your Atlassian account security
              settings
            </li>
            <li>• Use your email as username for Confluence Cloud</li>
            <li>
              • Ensure you have read access to the pages you want to export
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
