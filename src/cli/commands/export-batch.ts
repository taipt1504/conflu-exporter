import { getLogger } from '../ui/logger.js'
import { loadConfig } from '../../config/index.js'
import type { PartialConfig } from '../../config/config-schema.js'
import {
  createApiClient,
  createContentFetcher,
  createAttachmentHandler,
} from '../../core/index.js'
import { createMarkdownConverter } from '../../converters/markdown-converter.js'
import {
  createDirectoryManager,
  createFileWriter,
  createAssetDownloader,
} from '../../storage/index.js'
import { readFile } from 'fs/promises'
import chalk from 'chalk'

export interface ExportBatchOptions {
  file: string
  format: string
  output: string
  email?: string
  token?: string
  baseUrl?: string
  includeAttachments: boolean
  dryRun: boolean
  verbose: boolean
}

interface BatchItem {
  pageId: string
  title?: string
}

/**
 * Parse batch file (JSON or CSV)
 */
async function parseBatchFile(filePath: string): Promise<BatchItem[]> {
  const content = await readFile(filePath, 'utf-8')

  if (filePath.endsWith('.json')) {
    // JSON format: array of objects with pageId
    // Example: [{"pageId": "123456", "title": "Optional Title"}, ...]
    const data = JSON.parse(content)

    if (!Array.isArray(data)) {
      throw new Error('JSON file must contain an array of page items')
    }

    return data.map((item, index) => {
      if (!item.pageId) {
        throw new Error(`Item at index ${index} is missing 'pageId' field`)
      }
      return {
        pageId: String(item.pageId),
        title: item.title,
      }
    })
  } else if (filePath.endsWith('.csv')) {
    // CSV format: pageId,title (title is optional)
    // Example:
    // pageId,title
    // 123456,Page Title
    // 789012
    const lines = content.split('\n').filter((line) => line.trim())

    // Skip header if it exists
    const startIndex = lines[0].toLowerCase().includes('pageid') ? 1 : 0

    return lines.slice(startIndex).map((line, index) => {
      const parts = line.split(',').map((p) => p.trim())
      const pageId = parts[0]

      if (!pageId) {
        throw new Error(`Line ${index + startIndex + 1} is missing pageId`)
      }

      return {
        pageId,
        title: parts[1],
      }
    })
  } else {
    throw new Error('Batch file must be .json or .csv format')
  }
}

/**
 * Export multiple pages from a batch file
 */
export async function exportBatch(options: ExportBatchOptions): Promise<void> {
  const logger = getLogger()

  try {
    logger.info(chalk.cyan(`Starting batch export from ${options.file}...`))

    // Step 1: Parse batch file
    logger.info(`Reading batch file...`)
    const items = await parseBatchFile(options.file)

    if (items.length === 0) {
      logger.warn(chalk.yellow('No items found in batch file'))
      return
    }

    logger.info(chalk.green(`✓ Found ${items.length} pages to export`))

    // Step 2: Load configuration
    const cliConfig: PartialConfig = {
      baseUrl: options.baseUrl,
      email: options.email,
      token: options.token,
      format: options.format as 'markdown' | 'pdf' | 'docx',
      output: options.output,
      includeAttachments: options.includeAttachments,
    }

    const config = await loadConfig(cliConfig)

    if (!config.baseUrl || !config.email || !config.token) {
      logger.error(
        chalk.red(
          'Missing required configuration: baseUrl, email, and token are required',
        ),
      )
      logger.info('Set them via CLI flags, environment variables, or config file')
      process.exit(1)
    }

    logger.debug(`Configuration loaded: ${config.baseUrl}`)

    // Step 3: Initialize components
    const apiClient = createApiClient({
      baseUrl: config.baseUrl,
      email: config.email,
      token: config.token,
      timeout: config.api?.timeout,
      retries: config.api?.retries,
    })

    const contentFetcher = createContentFetcher({ apiClient })
    const attachmentHandler = createAttachmentHandler({ apiClient })

    logger.debug('API client initialized')

    // Step 4: Test connection
    logger.info('Testing API connection...')
    const connected = await apiClient.testConnection()

    if (!connected) {
      logger.error(chalk.red('Failed to connect to Confluence API'))
      logger.info('Please check your baseUrl, email, and token')
      process.exit(1)
    }

    logger.info(chalk.green('✓ Connected to Confluence API'))

    if (options.dryRun) {
      logger.info(chalk.yellow('\n--- DRY RUN MODE ---'))
      logger.info(`Would export ${items.length} pages`)
      logger.info(`Format: ${config.format}`)
      logger.info(`Output: ${config.output}`)
      logger.info(`Include attachments: ${config.includeAttachments}`)
      logger.info('\nPages to export:')
      for (const item of items.slice(0, 10)) {
        logger.info(`  - ${item.pageId}${item.title ? ` (${item.title})` : ''}`)
      }
      if (items.length > 10) {
        logger.info(`  ... and ${items.length - 10} more`)
      }
      return
    }

    // Step 5: Initialize storage
    const directoryManager = createDirectoryManager(config.output)
    await directoryManager.initialize()

    const fileWriter = createFileWriter()
    const assetDownloader = createAssetDownloader({
      attachmentHandler,
      fileWriter,
      directoryManager,
    })

    logger.info(chalk.green(`✓ Initialized output directory: ${config.output}`))

    // Step 6: Export pages
    logger.info(`Exporting ${items.length} pages...`)

    const converter = createMarkdownConverter(config.conversion?.markdown)
    const fileExtension = converter.getFileExtension()

    const manifestPages = []
    let successCount = 0
    let errorCount = 0
    const errors: Array<{ pageId: string; error: string }> = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const progress = `[${i + 1}/${items.length}]`

      try {
        logger.info(`${progress} Fetching page ${item.pageId}...`)

        // Fetch page
        const page = await contentFetcher.fetchPage(item.pageId)

        logger.info(`${progress} Processing: ${chalk.cyan(page.title)}`)

        // Convert page
        const converted = await converter.convert(page)

        // Save page content
        const pagePath = await directoryManager.getPageFilePath(
          page.spaceKey,
          page.title,
          fileExtension,
        )

        await fileWriter.writeText(pagePath, converted.content)

        // Download attachments if requested
        let attachmentCount = 0
        if (config.includeAttachments) {
          const downloadResults = await assetDownloader.downloadPageAssets(
            page.id,
            page.spaceKey,
            true,
          )
          attachmentCount = downloadResults.filter((r) => r.success).length
        }

        // Add to manifest
        manifestPages.push({
          id: page.id,
          title: page.title,
          spaceKey: page.spaceKey,
          path: directoryManager.getRelativePath(pagePath),
          metadata: converted.metadata,
          attachments: attachmentCount,
        })

        successCount++
        logger.info(
          chalk.green(
            `  ✓ Saved: ${page.title}${attachmentCount > 0 ? ` (${attachmentCount} attachments)` : ''}`,
          ),
        )
      } catch (error) {
        errorCount++
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        errors.push({ pageId: item.pageId, error: errorMessage })
        logger.error(
          chalk.red(`  ✗ Failed to export ${item.pageId}:`),
          errorMessage,
        )
      }
    }

    // Step 7: Save manifest
    const manifest = {
      exportedAt: new Date().toISOString(),
      tool: 'conflu-exporter',
      version: '0.1.0',
      format: config.format,
      batch: {
        file: options.file,
        totalItems: items.length,
      },
      options: {
        includeAttachments: config.includeAttachments,
      },
      pages: manifestPages,
      summary: {
        total: items.length,
        successful: successCount,
        failed: errorCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    }

    const manifestPath = directoryManager.getManifestPath()
    await fileWriter.writeJson(manifestPath, manifest)

    logger.info(chalk.green(`✓ Saved manifest: ${manifestPath}`))

    // Step 8: Success summary
    logger.info(chalk.green.bold('\n✓ Batch export complete!'))
    logger.info(`\nExport summary:`)
    logger.info(`  Total pages: ${items.length}`)
    logger.info(`  Successful: ${chalk.green(successCount)}`)
    if (errorCount > 0) {
      logger.info(`  Failed: ${chalk.red(errorCount)}`)
    }
    logger.info(`  Output: ${chalk.cyan(config.output)}`)
    logger.info(`  Manifest: ${chalk.cyan(manifestPath)}`)

    if (errorCount > 0) {
      logger.warn(
        chalk.yellow(
          `\n⚠ Some pages failed to export. Check logs for details.`,
        ),
      )
      logger.info(`\nFailed pages:`)
      for (const err of errors.slice(0, 5)) {
        logger.info(`  - ${err.pageId}: ${err.error}`)
      }
      if (errors.length > 5) {
        logger.info(`  ... and ${errors.length - 5} more errors`)
      }
      process.exit(1)
    }
  } catch (error) {
    logger.error(chalk.red('Batch export failed:'), error)

    if (error instanceof Error) {
      logger.error(chalk.red(error.message))

      if (options.verbose) {
        logger.error(chalk.gray(error.stack || ''))
      }
    }

    process.exit(1)
  }
}
