import { describe, it, expect } from 'vitest'
import { ConfluenceExporter } from '../src/exporter.js'

describe('ConfluenceExporter', () => {
  describe('constructor', () => {
    it('should create an instance with valid options', () => {
      const exporter = new ConfluenceExporter({
        baseUrl: 'https://example.atlassian.net',
      })

      expect(exporter).toBeInstanceOf(ConfluenceExporter)
    })

    it('should throw error if baseUrl is missing', () => {
      expect(() => {
        new ConfluenceExporter({
          baseUrl: '',
        })
      }).toThrow('baseUrl is required')
    })

    it('should throw error if baseUrl is invalid', () => {
      expect(() => {
        new ConfluenceExporter({
          baseUrl: 'not-a-valid-url',
        })
      }).toThrow('baseUrl must be a valid URL')
    })

    it('should use default format if not provided', () => {
      const exporter = new ConfluenceExporter({
        baseUrl: 'https://example.atlassian.net',
      })

      expect(exporter.getFormat()).toBe('markdown')
    })

    it('should accept custom format', () => {
      const exporter = new ConfluenceExporter({
        baseUrl: 'https://example.atlassian.net',
        format: 'html',
      })

      expect(exporter.getFormat()).toBe('html')
    })
  })

  describe('exportSpace', () => {
    it('should export a space successfully', async () => {
      const exporter = new ConfluenceExporter({
        baseUrl: 'https://example.atlassian.net',
      })

      const result = await exporter.exportSpace('TEST')

      expect(result.success).toBe(true)
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].spaceKey).toBe('TEST')
    })

    it('should throw error if spaceKey is empty', async () => {
      const exporter = new ConfluenceExporter({
        baseUrl: 'https://example.atlassian.net',
      })

      await expect(exporter.exportSpace('')).rejects.toThrow('spaceKey is required')
    })
  })

  describe('exportPage', () => {
    it('should export a single page', async () => {
      const exporter = new ConfluenceExporter({
        baseUrl: 'https://example.atlassian.net',
      })

      const page = await exporter.exportPage('12345')

      expect(page.id).toBe('12345')
      expect(page.title).toBeTruthy()
    })

    it('should throw error if pageId is empty', async () => {
      const exporter = new ConfluenceExporter({
        baseUrl: 'https://example.atlassian.net',
      })

      await expect(exporter.exportPage('')).rejects.toThrow('pageId is required')
    })
  })
})
