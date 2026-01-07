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
import type { ConfluencePage } from '../../types.js'

export interface ExportSpaceOptions {
  spaceKey: string
  format: string
  output: string
  email?: string
  token?: string
  baseUrl?: string
  includeAttachments: boolean
  includeChildren: boolean
  flat: boolean
  dryRun: boolean
  verbose: boolean
}

/**
 * Export an entire Confluence space
 */
export async function exportSpace(options: ExportSpaceOptions): Promise<void> {
  const logger = getLogger()

  try {
    logger.info(chalk.cyan(`Starting export of space ${options.spaceKey}...`))

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

    // Step 4: Fetch all pages in space
    logger.info(`Fetching pages from space ${options.spaceKey}...`)
    const pages = await contentFetcher.fetchSpace(options.spaceKey)

    if (pages.length === 0) {
      logger.warn(chalk.yellow(`No pages found in space ${options.spaceKey}`))
      return
    }

    logger.info(chalk.green(`✓ Found ${pages.length} pages in space`))

    // Step 5: Fetch hierarchical structure if needed
    let allPages = pages
    if (options.includeChildren) {
      logger.info('Fetching page hierarchies (including children)...')
      const pageMap = new Map<string, ConfluencePage>()

      // Add root pages
      for (const page of pages) {
        pageMap.set(page.id, page)
      }

      // Fetch children for each root page
      for (const page of pages) {
        try {
          const children = await contentFetcher.fetchPageHierarchy(page.id)
          for (const child of children) {
            if (!pageMap.has(child.id)) {
              pageMap.set(child.id, child)
            }
          }
        } catch (error) {
          logger.warn(
            chalk.yellow(`Failed to fetch children for page ${page.id}: ${error}`),
          )
        }
      }

      allPages = Array.from(pageMap.values())
      logger.info(
        chalk.green(`✓ Total pages with children: ${allPages.length}`),
      )
    }

    if (options.dryRun) {
      logger.info(chalk.yellow('\n--- DRY RUN MODE ---'))
      logger.info(`Would export ${allPages.length} pages from space: ${options.spaceKey}`)
      logger.info(`Format: ${config.format}`)
      logger.info(`Output: ${config.output}`)
      logger.info(`Include attachments: ${config.includeAttachments}`)
      logger.info(`Include children: ${options.includeChildren}`)
      logger.info(`Structure: ${options.flat ? 'flat' : 'hierarchical'}`)
      logger.info('\nPages to export:')
      for (const page of allPages.slice(0, 10)) {
        logger.info(`  - ${page.title} (${page.id})`)
      }
      if (allPages.length > 10) {
        logger.info(`  ... and ${allPages.length - 10} more`)
      }
      return
    }

    // Step 6: Initialize storage
    const directoryManager = createDirectoryManager(config.output)
    await directoryManager.initialize()

    const fileWriter = createFileWriter()
    const assetDownloader = createAssetDownloader({
      attachmentHandler,
      fileWriter,
      directoryManager,
    })

    logger.info(chalk.green(`✓ Initialized output directory: ${config.output}`))

    // Step 7: Convert and save pages
    logger.info(`Converting and saving ${allPages.length} pages...`)

    const converter = createMarkdownConverter(config.conversion?.markdown)
    const fileExtension = converter.getFileExtension()

    const manifestPages = []
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < allPages.length; i++) {
      const page = allPages[i]
      const progress = `[${i + 1}/${allPages.length}]`

      try {
        logger.info(
          `${progress} Processing: ${chalk.cyan(page.title)} (${page.id})`,
        )

        // Convert page
        const converted = await converter.convert(page)

        // Determine file path based on structure mode
        let hierarchyPath: string[] | undefined
        if (!options.flat && page.metadata?.parentId) {
          // Build hierarchy path (simplified - just use parent)
          hierarchyPath = []
        }

        const pagePath = await directoryManager.getPageFilePath(
          page.spaceKey,
          page.title,
          fileExtension,
          hierarchyPath,
        )

        // Save page content
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
        logger.error(
          chalk.red(`  ✗ Failed to export ${page.title}:`),
          error instanceof Error ? error.message : error,
        )
      }
    }

    // Step 8: Save manifest
    const manifest = {
      exportedAt: new Date().toISOString(),
      tool: 'conflu-exporter',
      version: '0.1.0',
      format: config.format,
      space: {
        key: options.spaceKey,
        pageCount: allPages.length,
      },
      options: {
        includeAttachments: config.includeAttachments,
        includeChildren: options.includeChildren,
        flat: options.flat,
      },
      pages: manifestPages,
      summary: {
        total: allPages.length,
        successful: successCount,
        failed: errorCount,
      },
    }

    const manifestPath = directoryManager.getManifestPath()
    await fileWriter.writeJson(manifestPath, manifest)

    logger.info(chalk.green(`✓ Saved manifest: ${manifestPath}`))

    // Step 9: Success summary
    logger.info(chalk.green.bold('\n✓ Space export complete!'))
    logger.info(`\nExport summary:`)
    logger.info(`  Space: ${chalk.cyan(options.spaceKey)}`)
    logger.info(`  Total pages: ${allPages.length}`)
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
      process.exit(1)
    }
  } catch (error) {
    logger.error(chalk.red('Space export failed:'), error)

    if (error instanceof Error) {
      logger.error(chalk.red(error.message))

      if (options.verbose) {
        logger.error(chalk.gray(error.stack || ''))
      }
    }

    process.exit(1)
  }
}
