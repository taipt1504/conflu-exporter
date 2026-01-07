import { describe, it, expect } from 'vitest'
import { formatDate, sanitizeFilename, extractSpaceKey } from '../src/utils.js'

describe('utils', () => {
  describe('formatDate', () => {
    it('should format date to ISO string', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = formatDate(date)

      expect(result).toBe('2024-01-15T10:30:00.000Z')
    })
  })

  describe('sanitizeFilename', () => {
    it('should remove invalid characters from filename', () => {
      const result = sanitizeFilename('My File: Name (2024)!')

      expect(result).toBe('My_File__Name__2024__')
    })

    it('should preserve valid characters', () => {
      const result = sanitizeFilename('valid_file-name.txt')

      expect(result).toBe('valid_file-name.txt')
    })

    it('should handle empty string', () => {
      const result = sanitizeFilename('')

      expect(result).toBe('')
    })
  })

  describe('extractSpaceKey', () => {
    it('should extract space key from Confluence URL', () => {
      const url = 'https://example.atlassian.net/wiki/spaces/MYSPACE/pages/123456'
      const result = extractSpaceKey(url)

      expect(result).toBe('MYSPACE')
    })

    it('should return null for invalid URL', () => {
      const result = extractSpaceKey('not-a-url')

      expect(result).toBeNull()
    })

    it('should return null if space key not found', () => {
      const url = 'https://example.atlassian.net/wiki/pages/123456'
      const result = extractSpaceKey(url)

      expect(result).toBeNull()
    })
  })
})
