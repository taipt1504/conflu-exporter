import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, rm, access } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  DirectoryManager,
  createDirectoryManager,
  AssetDownloader,
  createAssetDownloader,
  createFileWriter,
} from '../src/storage/index.js'
import type { AttachmentHandler, Attachment } from '../src/core/attachment-handler.js'

describe('DirectoryManager', () => {
  let testDir: string
  let directoryManager: DirectoryManager

  beforeEach(async () => {
    testDir = join(tmpdir(), `conflu-test-${Date.now()}`)
    directoryManager = createDirectoryManager(testDir)
    await directoryManager.initialize()
  })

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('initialize', () => {
    it('should create root directory', async () => {
      await expect(access(testDir)).resolves.not.toThrow()
    })
  })

  describe('getSpaceDirectory', () => {
    it('should create space directory', async () => {
      const spaceDir = await directoryManager.getSpaceDirectory('MSN')

      expect(spaceDir).toBe(join(testDir, 'MSN'))
      await expect(access(spaceDir)).resolves.not.toThrow()
    })

    it('should return cached directory on second call', async () => {
      const first = await directoryManager.getSpaceDirectory('MSN')
      const second = await directoryManager.getSpaceDirectory('MSN')

      expect(first).toBe(second)
    })
  })

  describe('getAssetsDirectory', () => {
    it('should create flat assets directory by default', async () => {
      const assetsDir = await directoryManager.getAssetsDirectory('MSN')

      expect(assetsDir).toBe(join(testDir, 'MSN', 'assets'))
      await expect(access(assetsDir)).resolves.not.toThrow()
    })

    it('should create nested assets directory when flat=false', async () => {
      const assetsDir = await directoryManager.getAssetsDirectory('MSN', '123456', false)

      expect(assetsDir).toBe(join(testDir, 'MSN', 'assets', '123456'))
      await expect(access(assetsDir)).resolves.not.toThrow()
    })

    it('should cache flat assets directory by space key', async () => {
      const first = await directoryManager.getAssetsDirectory('MSN')
      const second = await directoryManager.getAssetsDirectory('MSN')

      expect(first).toBe(second)
    })
  })

  describe('getRelativeAssetsPath', () => {
    it('should return relative path for markdown', () => {
      const relativePath = directoryManager.getRelativeAssetsPath()

      expect(relativePath).toBe('./assets')
    })
  })

  describe('getPageFilePath', () => {
    it('should create page file path in space directory', async () => {
      const filePath = await directoryManager.getPageFilePath('MSN', 'My Page Title', '.md')

      expect(filePath).toBe(join(testDir, 'MSN', 'my-page-title.md'))
    })

    it('should sanitize special characters in title', async () => {
      const filePath = await directoryManager.getPageFilePath('MSN', '2.1.1 Pay by Facepay', '.md')

      // Dots are preserved, spaces become dashes
      expect(filePath).toBe(join(testDir, 'MSN', '2.1.1-pay-by-facepay.md'))
    })
  })
})

describe('AssetDownloader', () => {
  let testDir: string
  let directoryManager: DirectoryManager
  let mockAttachmentHandler: AttachmentHandler
  let assetDownloader: AssetDownloader

  beforeEach(async () => {
    testDir = join(tmpdir(), `conflu-test-${Date.now()}`)
    directoryManager = createDirectoryManager(testDir)
    await directoryManager.initialize()

    // Create mock attachment handler
    mockAttachmentHandler = {
      fetchPageAttachments: vi.fn(),
      fetchPageImages: vi.fn(),
      downloadAttachment: vi.fn(),
      downloadAttachmentByFilename: vi.fn(),
      downloadMermaidAttachments: vi.fn(),
      downloadPageAttachments: vi.fn(),
      downloadTextAttachment: vi.fn(),
      getRateLimiter: vi.fn(),
    } as unknown as AttachmentHandler

    assetDownloader = createAssetDownloader({
      attachmentHandler: mockAttachmentHandler,
      fileWriter: createFileWriter(),
      directoryManager,
    })
  })

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('downloadPageImages', () => {
    it('should return empty array when no images found', async () => {
      vi.mocked(mockAttachmentHandler.fetchPageImages).mockResolvedValue([])

      const results = await assetDownloader.downloadPageImages('123', 'MSN')

      expect(results).toEqual([])
      expect(mockAttachmentHandler.fetchPageImages).toHaveBeenCalledWith('123')
    })

    it('should download images and return results with correct paths', async () => {
      const mockImages: Attachment[] = [
        {
          id: '1',
          title: 'test-image.png',
          filename: 'test-image.png',
          mediaType: 'image/png',
          fileSize: 1024,
          downloadUrl: 'https://example.com/download/test-image.png',
        },
      ]

      vi.mocked(mockAttachmentHandler.fetchPageImages).mockResolvedValue(mockImages)
      vi.mocked(mockAttachmentHandler.downloadAttachment).mockResolvedValue(
        Buffer.from('fake-image-data'),
      )

      const results = await assetDownloader.downloadPageImages('123', 'MSN')

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
      expect(results[0].originalFilename).toBe('test-image.png')
      expect(results[0].relativePath).toBe('./assets/test-image.png')
    })

    it('should handle images with special characters in filename', async () => {
      const mockImages: Attachment[] = [
        {
          id: '1',
          title: 'VM-PaymentV1.1.drawio (2).png',
          filename: 'VM-PaymentV1.1.drawio (2).png',
          mediaType: 'image/png',
          fileSize: 2048,
          downloadUrl: 'https://example.com/download/VM-PaymentV1.1.drawio%20(2).png',
        },
      ]

      vi.mocked(mockAttachmentHandler.fetchPageImages).mockResolvedValue(mockImages)
      vi.mocked(mockAttachmentHandler.downloadAttachment).mockResolvedValue(
        Buffer.from('fake-image-data'),
      )

      const results = await assetDownloader.downloadPageImages('123', 'MSN')

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
      expect(results[0].originalFilename).toBe('VM-PaymentV1.1.drawio (2).png')
      expect(results[0].relativePath).toBe('./assets/VM-PaymentV1.1.drawio (2).png')
    })

    it('should handle download failures gracefully', async () => {
      const mockImages: Attachment[] = [
        {
          id: '1',
          title: 'failing-image.png',
          filename: 'failing-image.png',
          mediaType: 'image/png',
          fileSize: 1024,
          downloadUrl: 'https://example.com/download/failing-image.png',
        },
      ]

      vi.mocked(mockAttachmentHandler.fetchPageImages).mockResolvedValue(mockImages)
      vi.mocked(mockAttachmentHandler.downloadAttachment).mockRejectedValue(
        new Error('Download failed'),
      )

      const results = await assetDownloader.downloadPageImages('123', 'MSN')

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Download failed')
    })
  })

  describe('downloadPageAssets', () => {
    it('should use flat directory structure by default', async () => {
      const mockAttachments: Attachment[] = [
        {
          id: '1',
          title: 'document.pdf',
          filename: 'document.pdf',
          mediaType: 'application/pdf',
          fileSize: 4096,
          downloadUrl: 'https://example.com/download/document.pdf',
        },
      ]

      vi.mocked(mockAttachmentHandler.fetchPageAttachments).mockResolvedValue(mockAttachments)
      vi.mocked(mockAttachmentHandler.downloadAttachment).mockResolvedValue(
        Buffer.from('fake-pdf-data'),
      )

      const results = await assetDownloader.downloadPageAssets('123', 'MSN', true, true)

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
      // Verify the file was saved in flat structure
      expect(results[0].path).toContain(join('MSN', 'assets', 'document.pdf'))
    })
  })
})
