#!/usr/bin/env node

import { Command } from 'commander'
import { createLogger } from './ui/logger.js'
import { exportPage } from './commands/export-page.js'
import { exportSpace } from './commands/export-space.js'
import { exportBatch } from './commands/export-batch.js'
import { exportUrl } from './commands/export-url.js'

const program = new Command()

program
  .name('conflu')
  .description('Export Confluence pages to multiple formats')
  .version('0.1.0')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Suppress all output except errors')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts()
    createLogger({
      verbose: opts.verbose,
      quiet: opts.quiet,
      pretty: true,
    })
  })

const exportCommand = program
  .command('export')
  .description('Export Confluence content')

exportCommand
  .command('page <pageId>')
  .description('Export a single page by ID')
  .option('-f, --format <type>', 'Export format: markdown|pdf|docx', 'markdown')
  .option('-o, --output <dir>', 'Output directory', './exports')
  .option('-e, --email <email>', 'Confluence account email')
  .option('-t, --token <token>', 'API token')
  .option('-u, --base-url <url>', 'Confluence base URL')
  .option('--include-attachments', 'Download and include attachments')
  .option('--include-children', 'Export child pages recursively')
  .option('--dry-run', 'Show what would be exported without doing it')
  .action(async (pageId: string, options: any) => {
    const parentOpts = exportCommand.parent?.opts() || {}

    await exportPage({
      pageId,
      format: options.format,
      output: options.output,
      email: options.email,
      token: options.token,
      baseUrl: options.baseUrl,
      includeAttachments: options.includeAttachments || false,
      dryRun: options.dryRun || false,
      verbose: parentOpts.verbose || false,
    })
  })

exportCommand
  .command('space <spaceKey>')
  .description('Export entire space')
  .option('-f, --format <type>', 'Export format: markdown|pdf|docx', 'markdown')
  .option('-o, --output <dir>', 'Output directory', './exports')
  .option('-e, --email <email>', 'Confluence account email')
  .option('-t, --token <token>', 'API token')
  .option('-u, --base-url <url>', 'Confluence base URL')
  .option('--include-attachments', 'Download and include attachments')
  .option('--include-children', 'Export child pages recursively')
  .option('--flat', 'Flat structure (no hierarchy)')
  .option('--dry-run', 'Show what would be exported without doing it')
  .action(async (spaceKey: string, options: any) => {
    const parentOpts = exportCommand.parent?.opts() || {}

    await exportSpace({
      spaceKey,
      format: options.format,
      output: options.output,
      email: options.email,
      token: options.token,
      baseUrl: options.baseUrl,
      includeAttachments: options.includeAttachments || false,
      includeChildren: options.includeChildren || false,
      flat: options.flat || false,
      dryRun: options.dryRun || false,
      verbose: parentOpts.verbose || false,
    })
  })

exportCommand
  .command('batch <file>')
  .description('Export multiple pages from JSON/CSV file')
  .option('-f, --format <type>', 'Export format: markdown|pdf|docx', 'markdown')
  .option('-o, --output <dir>', 'Output directory', './exports')
  .option('-e, --email <email>', 'Confluence account email')
  .option('-t, --token <token>', 'API token')
  .option('-u, --base-url <url>', 'Confluence base URL')
  .option('--include-attachments', 'Download and include attachments')
  .option('--dry-run', 'Show what would be exported without doing it')
  .action(async (file: string, options: any) => {
    const parentOpts = exportCommand.parent?.opts() || {}

    await exportBatch({
      file,
      format: options.format,
      output: options.output,
      email: options.email,
      token: options.token,
      baseUrl: options.baseUrl,
      includeAttachments: options.includeAttachments || false,
      dryRun: options.dryRun || false,
      verbose: parentOpts.verbose || false,
    })
  })

exportCommand
  .command('url <url>')
  .description('Export page from Confluence URL')
  .option('-f, --format <type>', 'Export format: markdown|pdf|docx', 'markdown')
  .option('-o, --output <dir>', 'Output directory', './exports')
  .option('-e, --email <email>', 'Confluence account email')
  .option('-t, --token <token>', 'API token')
  .option('--include-attachments', 'Download and include attachments')
  .option('--include-children', 'Export child pages recursively')
  .option('--dry-run', 'Show what would be exported without doing it')
  .action(async (url: string, options: any) => {
    const parentOpts = exportCommand.parent?.opts() || {}

    await exportUrl({
      url,
      format: options.format,
      output: options.output,
      email: options.email,
      token: options.token,
      includeAttachments: options.includeAttachments || false,
      includeChildren: options.includeChildren || false,
      dryRun: options.dryRun || false,
      verbose: parentOpts.verbose || false,
    })
  })

const configCommand = program.command('config').description('Manage configuration')

configCommand
  .command('init')
  .description('Initialize configuration file')
  .option('-f, --force', 'Overwrite existing configuration file')
  .action(async (options: any) => {
    const { initConfig } = await import('./commands/config-init.js')
    await initConfig({ force: options.force || false })
  })

configCommand
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    const logger = getLogger()
    logger.info('Showing current configuration...')
    logger.warn('Config show functionality not yet implemented')
  })

configCommand
  .command('test')
  .description('Test API connection')
  .option('-e, --email <email>', 'Confluence account email')
  .option('-t, --token <token>', 'API token')
  .option('-u, --base-url <url>', 'Confluence base URL')
  .action(async (_options: any) => {
    const logger = getLogger()
    logger.info('Testing API connection...')
    logger.warn('Config test functionality not yet implemented')
  })

export async function run(argv: string[] = process.argv): Promise<void> {
  try {
    await program.parseAsync(argv)
  } catch (error) {
    const logger = getLogger()
    logger.error('An error occurred:', error)
    process.exit(1)
  }
}

import { getLogger } from './ui/logger.js'

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
}
