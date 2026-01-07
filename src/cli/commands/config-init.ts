import { writeFile, access } from 'fs/promises'
import { resolve } from 'path'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'
import { getLogger } from '../ui/logger.js'
import chalk from 'chalk'

interface InitConfigOptions {
  force: boolean
}

interface ConfigAnswers {
  baseUrl: string
  email: string
  token: string
  format: string
  output: string
  includeAttachments: boolean
}

/**
 * Initialize configuration file with interactive prompts
 */
export async function initConfig(options: InitConfigOptions): Promise<void> {
  const logger = getLogger()

  logger.info(chalk.bold('🚀 Confluence Exporter Configuration Setup'))
  logger.info(chalk.gray('This wizard will help you set up your configuration file.\n'))

  // Check if config file already exists
  const configPath = resolve(process.cwd(), '.conflurc')
  const configExists = await fileExists(configPath)

  if (configExists && !options.force) {
    logger.warn(
      chalk.yellow('⚠️  Configuration file already exists at: ') + chalk.cyan(configPath),
    )
    logger.info(chalk.gray('Use --force flag to overwrite the existing file.'))
    logger.info(chalk.gray('Example: conflu config init --force\n'))
    return
  }

  if (configExists && options.force) {
    logger.warn(chalk.yellow('⚠️  Overwriting existing configuration file...'))
  }

  // Create readline interface for interactive prompts
  const rl = readline.createInterface({ input, output })

  try {
    // Collect configuration from user
    const answers = await collectAnswers(rl)

    // Build configuration object
    const config = {
      baseUrl: answers.baseUrl,
      email: answers.email,
      format: answers.format,
      output: answers.output,
      includeAttachments: answers.includeAttachments,
      includeChildren: false,
      flat: false,
      api: {
        timeout: 30000,
        retries: 3,
        concurrency: 5,
      },
      conversion: {
        markdown: {
          frontmatter: true,
          preserveHtml: false,
          gfm: true,
        },
      },
    }

    // Don't save token in config file for security reasons
    if (answers.token) {
      logger.info(
        chalk.yellow(
          '\n🔐 For security, the API token will NOT be saved to the config file.',
        ),
      )
      logger.info(chalk.gray('   Instead, set it as an environment variable:'))
      logger.info(chalk.cyan(`   export CONFLUENCE_TOKEN="${answers.token}"`))
      logger.info(
        chalk.gray(
          '   Or add it to your ~/.bashrc or ~/.zshrc for permanent storage.\n',
        ),
      )
    }

    // Write configuration to file
    const configJson = JSON.stringify(config, null, 2)
    await writeFile(configPath, configJson, 'utf-8')

    logger.info(
      chalk.green('✅ Configuration file created successfully at: ') + chalk.cyan(configPath),
    )
    logger.info(chalk.gray('\n📝 Configuration saved:'))
    logger.info(chalk.gray(configJson))

    logger.info(chalk.bold('\n🎉 Setup complete!'))
    logger.info(chalk.gray('\nNext steps:'))
    logger.info(chalk.gray('1. Export your API token as an environment variable (see above)'))
    logger.info(chalk.gray('2. Test your configuration: ') + chalk.cyan('conflu config test'))
    logger.info(
      chalk.gray('3. Start exporting: ') +
        chalk.cyan('conflu export page <pageId>') +
        chalk.gray(' or ') +
        chalk.cyan('conflu export space <spaceKey>'),
    )
    logger.info(chalk.gray('\n📚 For more help, visit: docs/QUICK_START.md\n'))
  } catch (error) {
    logger.error('Failed to initialize configuration:', error)
    throw error
  } finally {
    rl.close()
  }
}

/**
 * Collect configuration answers from user
 */
async function collectAnswers(rl: readline.Interface): Promise<ConfigAnswers> {
  const logger = getLogger()

  // 1. Confluence Base URL
  logger.info(chalk.bold('\n1️⃣  Confluence Instance'))
  logger.info(chalk.gray('   Enter your Confluence base URL'))
  logger.info(chalk.gray('   Example: https://your-domain.atlassian.net'))
  const baseUrl = await rl.question(chalk.cyan('   URL: '))
  if (!baseUrl || !isValidUrl(baseUrl)) {
    throw new Error('Invalid URL. Please enter a valid Confluence URL.')
  }

  // 2. Email
  logger.info(chalk.bold('\n2️⃣  Authentication'))
  logger.info(chalk.gray('   Enter your Confluence account email'))
  const email = await rl.question(chalk.cyan('   Email: '))
  if (!email || !isValidEmail(email)) {
    throw new Error('Invalid email address.')
  }

  // 3. API Token
  logger.info(chalk.gray('\n   Enter your Confluence API token'))
  logger.info(
    chalk.gray(
      '   Create one at: https://id.atlassian.com/manage-profile/security/api-tokens',
    ),
  )
  const token = await rl.question(chalk.cyan('   Token: '))
  if (!token || token.length < 10) {
    throw new Error('Invalid API token. Token must be at least 10 characters.')
  }

  // 4. Export Format
  logger.info(chalk.bold('\n3️⃣  Export Format'))
  logger.info(chalk.gray('   Choose export format (markdown/pdf/docx)'))
  const formatInput = await rl.question(chalk.cyan('   Format [markdown]: '))
  const format = formatInput.trim().toLowerCase() || 'markdown'
  if (!['markdown', 'pdf', 'docx'].includes(format)) {
    throw new Error('Invalid format. Must be markdown, pdf, or docx.')
  }

  // 5. Output Directory
  logger.info(chalk.bold('\n4️⃣  Output Directory'))
  logger.info(chalk.gray('   Where should exported files be saved?'))
  const outputInput = await rl.question(chalk.cyan('   Directory [./exports]: '))
  const output = outputInput.trim() || './exports'

  // 6. Include Attachments
  logger.info(chalk.bold('\n5️⃣  Attachments'))
  logger.info(chalk.gray('   Download and include attachments (images, files)?'))
  const attachmentsInput = await rl.question(chalk.cyan('   Include attachments? (y/N): '))
  const includeAttachments =
    attachmentsInput.trim().toLowerCase() === 'y' ||
    attachmentsInput.trim().toLowerCase() === 'yes'

  return {
    baseUrl: baseUrl.trim(),
    email: email.trim(),
    token: token.trim(),
    format: format as 'markdown' | 'pdf' | 'docx',
    output: output.trim(),
    includeAttachments,
  }
}

/**
 * Check if file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

