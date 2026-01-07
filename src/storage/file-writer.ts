import { writeFile, readFile } from 'fs/promises'
import { getLogger } from '../cli/ui/logger.js'
import { FileWriteError } from '../errors/index.js'

export interface WriteResult {
  path: string
  size: number
  success: boolean
}

/**
 * File Writer
 * Handles writing exported content to disk
 */
export class FileWriter {
  private logger = getLogger()

  /**
   * Write text content to file
   */
  async writeText(filePath: string, content: string): Promise<WriteResult> {
    this.logger.debug(`Writing text file: ${filePath}`)

    try {
      await writeFile(filePath, content, 'utf-8')

      const size = Buffer.byteLength(content, 'utf-8')

      this.logger.info(`Wrote file: ${filePath} (${size} bytes)`)

      return {
        path: filePath,
        size,
        success: true,
      }
    } catch (error) {
      this.logger.error(`Failed to write file: ${filePath}`, error)
      throw new FileWriteError(`Failed to write file: ${filePath}`, filePath, error)
    }
  }

  /**
   * Write binary content (Buffer) to file
   */
  async writeBinary(filePath: string, content: Buffer): Promise<WriteResult> {
    this.logger.debug(`Writing binary file: ${filePath}`)

    try {
      await writeFile(filePath, content)

      const size = content.length

      this.logger.info(`Wrote binary file: ${filePath} (${size} bytes)`)

      return {
        path: filePath,
        size,
        success: true,
      }
    } catch (error) {
      this.logger.error(`Failed to write binary file: ${filePath}`, error)
      throw new FileWriteError(`Failed to write binary file: ${filePath}`, filePath, error)
    }
  }

  /**
   * Write JSON to file
   */
  async writeJson(filePath: string, data: any, pretty: boolean = true): Promise<WriteResult> {
    this.logger.debug(`Writing JSON file: ${filePath}`)

    try {
      const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)

      return await this.writeText(filePath, content)
    } catch (error) {
      this.logger.error(`Failed to write JSON file: ${filePath}`, error)
      throw new FileWriteError(`Failed to write JSON file: ${filePath}`, filePath, error)
    }
  }

  /**
   * Read text file
   */
  async readText(filePath: string): Promise<string> {
    this.logger.debug(`Reading text file: ${filePath}`)

    try {
      const content = await readFile(filePath, 'utf-8')
      this.logger.debug(`Read file: ${filePath} (${content.length} chars)`)
      return content
    } catch (error) {
      this.logger.error(`Failed to read file: ${filePath}`, error)
      throw new Error(`Failed to read file: ${filePath}`)
    }
  }

  /**
   * Read JSON file
   */
  async readJson<T = any>(filePath: string): Promise<T> {
    this.logger.debug(`Reading JSON file: ${filePath}`)

    try {
      const content = await this.readText(filePath)
      return JSON.parse(content)
    } catch (error) {
      this.logger.error(`Failed to read JSON file: ${filePath}`, error)
      throw new Error(`Failed to read JSON file: ${filePath}`)
    }
  }

  /**
   * Append content to file
   */
  async appendText(filePath: string, content: string): Promise<void> {
    this.logger.debug(`Appending to file: ${filePath}`)

    try {
      let existing = ''
      try {
        existing = await this.readText(filePath)
      } catch {
        // File doesn't exist, that's ok
      }

      const newContent = existing + content
      await this.writeText(filePath, newContent)
    } catch (error) {
      this.logger.error(`Failed to append to file: ${filePath}`, error)
      throw new FileWriteError(`Failed to append to file: ${filePath}`, filePath, error)
    }
  }

  /**
   * Write multiple files in batch
   */
  async writeBatch(
    files: Array<{ path: string; content: string | Buffer }>,
  ): Promise<WriteResult[]> {
    this.logger.info(`Writing ${files.length} files in batch...`)

    const results: WriteResult[] = []

    for (const file of files) {
      try {
        const result =
          typeof file.content === 'string'
            ? await this.writeText(file.path, file.content)
            : await this.writeBinary(file.path, file.content)

        results.push(result)
      } catch (error) {
        this.logger.error(`Failed to write file in batch: ${file.path}`, error)
        results.push({
          path: file.path,
          size: 0,
          success: false,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    this.logger.info(`Batch write complete: ${successCount}/${files.length} succeeded`)

    return results
  }
}

export function createFileWriter(): FileWriter {
  return new FileWriter()
}
