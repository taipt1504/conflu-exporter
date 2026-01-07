import { getLogger } from '../ui/logger.js'
import chalk from 'chalk'
import { exportPage } from './export-page.js'
import { exportSpace } from './export-space.js'

export interface ExportUrlOptions {
  url: string
  format: string
  output: string
  email?: string
  token?: string
  includeAttachments: boolean
  includeChildren: boolean
  dryRun: boolean
  verbose: boolean
}

interface ParsedUrl {
  type: 'page' | 'space'
  baseUrl: string
  pageId?: string
  spaceKey?: string
}

/**
 * Parse Confluence URL to extract type, base URL, and identifiers
 *
 * Supported URL formats:
 * - https://domain.atlassian.net/wiki/spaces/SPACEKEY/pages/123456/Page+Title
 * - https://domain.atlassian.net/wiki/spaces/SPACEKEY/overview
 * - https://domain.atlassian.net/wiki/spaces/SPACEKEY
 */
function parseConfluenceUrl(url: string): ParsedUrl {
  const logger = getLogger()

  try {
    const urlObj = new URL(url)
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`

    // Extract path segments
    const pathSegments = urlObj.pathname.split('/').filter((s) => s)

    // Check for /wiki/spaces pattern
    if (pathSegments[0] === 'wiki' && pathSegments[1] === 'spaces') {
      const spaceKey = pathSegments[2]

      if (!spaceKey) {
        throw new Error('Invalid URL: Missing space key')
      }

      // Check if it's a page URL
      if (pathSegments[3] === 'pages' && pathSegments[4]) {
        const pageId = pathSegments[4]

        return {
          type: 'page',
          baseUrl,
          pageId,
          spaceKey,
        }
      }

      // Otherwise, it's a space URL
      return {
        type: 'space',
        baseUrl,
        spaceKey,
      }
    }

    throw new Error('Invalid Confluence URL format')
  } catch (error) {
    logger.error(chalk.red('Failed to parse Confluence URL'))
    if (error instanceof Error) {
      logger.error(chalk.red(error.message))
    }
    throw new Error(
      'URL must be in format: https://domain.atlassian.net/wiki/spaces/SPACEKEY/pages/PAGEID',
    )
  }
}

/**
 * Export from Confluence URL (auto-detect page or space)
 */
export async function exportUrl(options: ExportUrlOptions): Promise<void> {
  const logger = getLogger()

  try {
    logger.info(chalk.cyan(`Parsing Confluence URL...`))

    // Parse the URL
    const parsed = parseConfluenceUrl(options.url)

    logger.info(
      chalk.green(`✓ Detected ${parsed.type} export from ${parsed.baseUrl}`),
    )

    // Determine base URL priority: CLI flag > parsed from URL
    const baseUrl = options.email && options.token ? undefined : parsed.baseUrl

    if (parsed.type === 'page' && parsed.pageId) {
      logger.info(chalk.cyan(`Exporting page ${parsed.pageId}...`))

      await exportPage({
        pageId: parsed.pageId,
        format: options.format,
        output: options.output,
        email: options.email,
        token: options.token,
        baseUrl: baseUrl,
        includeAttachments: options.includeAttachments,
        dryRun: options.dryRun,
        verbose: options.verbose,
      })
    } else if (parsed.type === 'space' && parsed.spaceKey) {
      logger.info(chalk.cyan(`Exporting space ${parsed.spaceKey}...`))

      await exportSpace({
        spaceKey: parsed.spaceKey,
        format: options.format,
        output: options.output,
        email: options.email,
        token: options.token,
        baseUrl: baseUrl,
        includeAttachments: options.includeAttachments,
        includeChildren: options.includeChildren,
        flat: false,
        dryRun: options.dryRun,
        verbose: options.verbose,
      })
    } else {
      throw new Error('Could not determine export type from URL')
    }
  } catch (error) {
    logger.error(chalk.red('URL export failed:'), error)

    if (error instanceof Error) {
      logger.error(chalk.red(error.message))

      if (options.verbose) {
        logger.error(chalk.gray(error.stack || ''))
      }
    }

    process.exit(1)
  }
}
