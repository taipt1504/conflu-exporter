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
import chalk from 'chalk'

export interface ExportPageOptions {
  pageId: string
  format: string
  output: string
  email?: string
  token?: string
  baseUrl?: string
  includeAttachments: boolean
  dryRun: boolean
  verbose: boolean
}

/**
 * Export a single Confluence page
 */
export async function exportPage(options: ExportPageOptions): Promise<void> {
  const logger = getLogger()

  try {
    logger.info(chalk.cyan(`Starting export of page ${options.pageId}...`))

    // Step 1: Load configuration
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

    // Step 2: Initialize components
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

    // Step 3: Test connection
    logger.info('Testing API connection...')
    const connected = await apiClient.testConnection()

    if (!connected) {
      logger.error(chalk.red('Failed to connect to Confluence API'))
      logger.info('Please check your baseUrl, email, and token')
      process.exit(1)
    }

    logger.info(chalk.green('✓ Connected to Confluence API'))

    // Step 4: Fetch page
    logger.info(`Fetching page ${options.pageId}...`)
    const page = await contentFetcher.fetchPage(options.pageId)

    logger.info(chalk.green(`✓ Fetched page: "${page.title}"`))
    logger.debug(
      `Page details: space=${page.spaceKey}, version=${page.version}`,
    )

    if (options.dryRun) {
      logger.info(chalk.yellow('\n--- DRY RUN MODE ---'))
      logger.info(`Would export page: ${page.title}`)
      logger.info(`Format: ${config.format}`)
      logger.info(`Output: ${config.output}`)
      logger.info(`Space: ${page.spaceKey}`)
      logger.info(`Include attachments: ${config.includeAttachments}`)
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

    // Step 6: Download Mermaid attachments (.mmd files) for diagram macros
    // These must be downloaded BEFORE converting to preserve diagram source code
    logger.debug('Checking for Mermaid diagram attachments...')
    const mermaidAttachments = await attachmentHandler.downloadMermaidAttachments(page.id)

    if (mermaidAttachments.size > 0) {
      logger.info(
        chalk.green(`✓ Downloaded ${mermaidAttachments.size} Mermaid diagram file(s)`),
      )
    }

    // Step 7: Convert page based on format
    logger.info(`Converting page to ${config.format}...`)

    let converted: { content: string; metadata: any }
    let fileExtension: string

    if (config.format === 'markdown') {
      const converter = createMarkdownConverter(config.conversion?.markdown)

      // CRITICAL: Set mermaid attachments BEFORE converting
      // This allows the converter to extract diagram source code from .mmd files
      if (mermaidAttachments.size > 0) {
        converter['setMermaidAttachments'](mermaidAttachments)
        logger.debug('Cached mermaid attachments in converter')
      }

      converted = await converter.convert(page)
      fileExtension = converter.getFileExtension()
    } else {
      logger.error(chalk.red(`Format ${config.format} not yet implemented`))
      logger.info('Currently only markdown format is supported')
      process.exit(1)
    }

    logger.info(chalk.green(`✓ Converted to ${config.format} (${converted.content.length} chars)`))

    // Step 8: Download images BEFORE saving markdown
    // This ensures images are available when markdown is written
    logger.info('Downloading page images...')

    const imageResults = await assetDownloader.downloadPageImages(
      page.id,
      page.spaceKey,
    )

    const imageSuccessCount = imageResults.filter((r) => r.success).length

    if (imageSuccessCount > 0) {
      logger.info(chalk.green(`✓ Downloaded ${imageSuccessCount} images`))

      // Log downloaded images for debugging
      for (const result of imageResults.filter((r) => r.success)) {
        logger.debug(`  - ${result.originalFilename} -> ${result.relativePath}`)
      }
    } else if (imageResults.length === 0) {
      logger.debug('No images found in page')
    } else {
      logger.warn(
        chalk.yellow(`⚠ Downloaded ${imageSuccessCount}/${imageResults.length} images`),
      )

      // Log failed downloads
      for (const result of imageResults.filter((r) => !r.success)) {
        logger.warn(`  - Failed: ${result.originalFilename}: ${result.error}`)
      }
    }

    // Step 9: Save page content
    const pagePath = await directoryManager.getPageFilePath(
      page.spaceKey,
      page.title,
      fileExtension,
    )

    await fileWriter.writeText(pagePath, converted.content)

    logger.info(chalk.green(`✓ Saved page: ${pagePath}`))

    // Step 10: Download additional attachments if requested (non-image files)
    if (config.includeAttachments) {
      logger.info('Downloading additional attachments...')

      // Download all attachments (this will include images again, but that's OK - they'll be overwritten)
      const downloadResults = await assetDownloader.downloadPageAssets(
        page.id,
        page.spaceKey,
        true, // Include all attachments
        true, // Use flat directory structure
      )

      // Filter to show only non-image results for logging
      const nonImageResults = downloadResults.filter(
        (r) => !r.filename.match(/\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i),
      )
      const successCount = nonImageResults.filter((r) => r.success).length

      if (successCount > 0) {
        logger.info(chalk.green(`✓ Downloaded ${successCount} additional attachments`))
      } else if (nonImageResults.length === 0) {
        logger.debug('No additional attachments found')
      } else {
        logger.warn(
          chalk.yellow(`⚠ Downloaded ${successCount}/${nonImageResults.length} additional attachments`),
        )
      }
    }

    // Step 11: Save manifest
    const manifest = {
      exportedAt: new Date().toISOString(),
      tool: 'conflu-exporter',
      version: '0.1.0',
      format: config.format,
      pages: [
        {
          id: page.id,
          title: page.title,
          spaceKey: page.spaceKey,
          path: directoryManager.getRelativePath(pagePath),
          metadata: converted.metadata,
        },
      ],
    }

    const manifestPath = directoryManager.getManifestPath()
    await fileWriter.writeJson(manifestPath, manifest)

    logger.info(chalk.green(`✓ Saved manifest: ${manifestPath}`))

    // Step 12: Success summary
    logger.info(chalk.green.bold('\n✓ Export complete!'))
    logger.info(`\nExported files:`)
    logger.info(`  Page: ${chalk.cyan(pagePath)}`)

    // Always show assets directory if images were downloaded
    if (imageResults.length > 0 || config.includeAttachments) {
      const assetsDir = await directoryManager.getAssetsDirectory(page.spaceKey)
      logger.info(`  Assets: ${chalk.cyan(assetsDir)}`)
    }

    logger.info(`  Manifest: ${chalk.cyan(manifestPath)}`)
  } catch (error) {
    logger.error(chalk.red('Export failed:'), error)

    if (error instanceof Error) {
      logger.error(chalk.red(error.message))

      if (options.verbose) {
        logger.error(chalk.gray(error.stack || ''))
      }
    }

    process.exit(1)
  }
}
