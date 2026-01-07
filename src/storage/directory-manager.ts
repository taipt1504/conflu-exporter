import { mkdir, access, constants } from 'fs/promises'
import { dirname, join } from 'path'
import { getLogger } from '../cli/ui/logger.js'

export interface DirectoryStructure {
  root: string
  spaces: Map<string, string>
  assets: Map<string, string>
}

/**
 * Directory Manager
 * Manages output directory structure for exported content
 *
 * Structure:
 * output/
 * ├── SPACE-KEY/
 * │   ├── page-title.md
 * │   ├── child-page/
 * │   │   ├── index.md
 * │   │   └── grandchild.md
 * │   └── assets/
 * │       ├── page-id-1/
 * │       │   └── image.png
 * │       └── page-id-2/
 * │           └── diagram.png
 * ├── manifest.json
 * └── export-log.txt
 */
export class DirectoryManager {
  private logger = getLogger()
  private rootDir: string
  private structure: DirectoryStructure

  constructor(rootDir: string) {
    this.rootDir = rootDir
    this.structure = {
      root: rootDir,
      spaces: new Map(),
      assets: new Map(),
    }
  }

  /**
   * Initialize root directory structure
   */
  async initialize(): Promise<void> {
    this.logger.info(`Initializing output directory: ${this.rootDir}`)

    await this.ensureDirectoryExists(this.rootDir)

    this.logger.debug(`Output directory initialized: ${this.rootDir}`)
  }

  /**
   * Get or create space directory
   */
  async getSpaceDirectory(spaceKey: string): Promise<string> {
    if (this.structure.spaces.has(spaceKey)) {
      return this.structure.spaces.get(spaceKey)!
    }

    const spaceDir = join(this.rootDir, spaceKey)
    await this.ensureDirectoryExists(spaceDir)

    this.structure.spaces.set(spaceKey, spaceDir)
    this.logger.debug(`Created space directory: ${spaceDir}`)

    return spaceDir
  }

  /**
   * Get or create assets directory for a page
   */
  async getAssetsDirectory(spaceKey: string, pageId: string): Promise<string> {
    const cacheKey = `${spaceKey}/${pageId}`

    if (this.structure.assets.has(cacheKey)) {
      return this.structure.assets.get(cacheKey)!
    }

    const spaceDir = await this.getSpaceDirectory(spaceKey)
    const assetsDir = join(spaceDir, 'assets', pageId)

    await this.ensureDirectoryExists(assetsDir)

    this.structure.assets.set(cacheKey, assetsDir)
    this.logger.debug(`Created assets directory: ${assetsDir}`)

    return assetsDir
  }

  /**
   * Get page file path (creates parent directories if needed)
   */
  async getPageFilePath(
    spaceKey: string,
    pageTitle: string,
    fileExtension: string,
    hierarchyPath?: string[],
  ): Promise<string> {
    const spaceDir = await this.getSpaceDirectory(spaceKey)
    const sanitizedTitle = this.sanitizeFilename(pageTitle)

    let filePath: string

    if (hierarchyPath && hierarchyPath.length > 0) {
      // Hierarchical structure: create subdirectories for parent pages
      const hierarchyDir = join(spaceDir, ...hierarchyPath.map((p) => this.sanitizeFilename(p)))
      await this.ensureDirectoryExists(hierarchyDir)

      // Use index.md for parent pages to allow child subdirectories
      filePath = join(hierarchyDir, `${sanitizedTitle}${fileExtension}`)
    } else {
      // Flat structure: all files in space directory
      filePath = join(spaceDir, `${sanitizedTitle}${fileExtension}`)
    }

    // Ensure parent directory exists
    const parentDir = dirname(filePath)
    await this.ensureDirectoryExists(parentDir)

    return filePath
  }

  /**
   * Get manifest file path
   */
  getManifestPath(): string {
    return join(this.rootDir, 'manifest.json')
  }

  /**
   * Get export log file path
   */
  getLogPath(): string {
    return join(this.rootDir, 'export-log.txt')
  }

  /**
   * Get relative path from root to a file
   */
  getRelativePath(absolutePath: string): string {
    return absolutePath.replace(this.rootDir + '/', '')
  }

  /**
   * Check if directory exists
   */
  async directoryExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * Ensure directory exists (create if not)
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await access(dirPath, constants.F_OK)
    } catch {
      await mkdir(dirPath, { recursive: true })
      this.logger.debug(`Created directory: ${dirPath}`)
    }
  }

  /**
   * Sanitize filename for filesystem
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
  }

  /**
   * Get directory structure summary
   */
  getStructureSummary(): {
    root: string
    spaceCount: number
    assetDirectories: number
  } {
    return {
      root: this.rootDir,
      spaceCount: this.structure.spaces.size,
      assetDirectories: this.structure.assets.size,
    }
  }

  /**
   * Get root directory
   */
  getRootDirectory(): string {
    return this.rootDir
  }
}

export function createDirectoryManager(rootDir: string): DirectoryManager {
  return new DirectoryManager(rootDir)
}
