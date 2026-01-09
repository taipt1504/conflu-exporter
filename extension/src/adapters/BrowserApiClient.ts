/**
 * Browser-compatible API client
 * Replaces axios with native fetch API
 * Implements same interface as ConfluenceApiClient for compatibility
 *
 * Architecture:
 * - Uses native fetch API instead of axios
 * - Implements retry logic with exponential backoff
 * - Comprehensive error handling with typed exceptions
 * - Compatible with CLI ConfluenceApiClient interface
 */
import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ServerError,
} from '../shared/errors'

export interface BrowserApiConfig {
  baseUrl: string
  email?: string
  token?: string
  timeout?: number
  retries?: number
}

export class BrowserApiClient {
  private config: Required<BrowserApiConfig>
  private retryCount = new Map<string, number>()

  constructor(config: BrowserApiConfig) {
    // Normalize baseUrl: remove trailing slashes and /wiki if present
    let baseUrl = config.baseUrl.replace(/\/+$/, '') // Remove trailing slashes
    if (baseUrl.endsWith('/wiki')) {
      baseUrl = baseUrl.slice(0, -5) // Remove /wiki suffix if present
    }

    this.config = {
      timeout: 30000,
      retries: 3,
      ...config,
      baseUrl,
    } as Required<BrowserApiConfig>
  }

  /**
   * GET request with retry logic
   */
  async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const url = this.buildUrl(path, params)
    const response = await this.fetchWithRetry(url, { method: 'GET' })
    return response.json()
  }

  /**
   * POST request
   */
  async post<T>(path: string, data?: any): Promise<T> {
    const url = this.buildUrl(path)
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  }

  /**
   * PUT request
   */
  async put<T>(path: string, data?: any): Promise<T> {
    const url = this.buildUrl(path)
    const response = await this.fetchWithRetry(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string): Promise<T> {
    const url = this.buildUrl(path)
    const response = await this.fetchWithRetry(url, { method: 'DELETE' })
    return response.json()
  }

  /**
   * Download binary data (attachments/images)
   * CRITICAL: Attachment URLs use /wiki/download/ NOT /wiki/rest/api/download/
   */
  async download(urlOrPath: string): Promise<ArrayBuffer> {
    const url = this.buildDownloadUrl(urlOrPath)
    const response = await this.fetchWithRetry(url, { method: 'GET' })
    return response.arrayBuffer()
  }

  /**
   * Download text content (for Mermaid diagrams, etc.)
   * Supports both relative paths and full URLs
   */
  async getText(urlOrPath: string): Promise<string> {
    const url = this.buildDownloadUrl(urlOrPath)
    const response = await this.fetchWithRetry(url, { method: 'GET' })
    return response.text()
  }

  /**
   * Test connection to Confluence API
   */
  async testConnection(): Promise<boolean> {
    try {
      const url = this.buildUrl('/space', { limit: 1 })
      console.log('[BrowserApiClient] Testing connection to:', url)
      await this.get('/space', { limit: 1 })
      console.log('[BrowserApiClient] Connection test successful')
      return true
    } catch (error) {
      console.error('[BrowserApiClient] Connection test failed:', error)
      return false
    }
  }

  /**
   * Fetch with timeout and retry logic
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt = 1
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers: this.buildHeaders(),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle errors
      if (!response.ok) {
        if (response.status === 429 && attempt < this.config.retries) {
          // Rate limit - retry with exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000)
          return this.fetchWithRetry(url, options, attempt + 1)
        }

        throw await this.handleError(response)
      }

      return response
    } catch (error: any) {
      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        throw new TimeoutError(`Request timeout after ${this.config.timeout}ms`)
      }

      // If it's already a typed error, rethrow it
      if (
        error instanceof ApiError ||
        error instanceof AuthenticationError ||
        error instanceof AuthorizationError ||
        error instanceof NotFoundError ||
        error instanceof RateLimitError ||
        error instanceof NetworkError ||
        error instanceof ServerError
      ) {
        throw error
      }

      // Network errors - retry
      if (attempt < this.config.retries) {
        await this.delay(1000 * attempt)
        return this.fetchWithRetry(url, options, attempt + 1)
      }

      throw new NetworkError(`Network error: ${error.message}`)
    }
  }

  /**
   * Build full URL with query params
   *
   * Important: new URL('/path', 'https://domain.com/wiki/rest/api')
   * will result in 'https://domain.com/path' (removes /wiki/rest/api)
   * So we need to concatenate manually instead
   */
  private buildUrl(path: string, params?: Record<string, any>): string {
    // Remove leading slash from path if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path

    // Build full URL by concatenation (not using URL constructor with path)
    const fullUrl = `${this.config.baseUrl}/wiki/rest/api/${cleanPath}`

    // Create URL object to add query params
    const url = new URL(fullUrl)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value))
      })
    }

    return url.toString()
  }

  /**
   * Build download URL for attachments
   * 
   * CRITICAL: Confluence attachment download URLs use format:
   * /wiki/download/attachments/{pageId}/{filename}
   * NOT /wiki/rest/api/download/...
   * 
   * The _links.download from API already starts with /download/...
   */
  private buildDownloadUrl(urlOrPath: string): string {
    // If already a full URL, use as-is
    if (urlOrPath.startsWith('http')) {
      return urlOrPath
    }

    // Path from API starts with /download/attachments/...
    // We need to prepend baseUrl + /wiki
    const cleanPath = urlOrPath.startsWith('/') ? urlOrPath : '/' + urlOrPath
    return `${this.config.baseUrl}/wiki${cleanPath}`
  }

  /**
   * Build headers with authentication
   */
  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    if (this.config.email && this.config.token) {
      // Basic auth: email:token in Base64
      const auth = btoa(`${this.config.email}:${this.config.token}`)
      headers['Authorization'] = `Basic ${auth}`
    }

    return headers
  }

  /**
   * Handle HTTP errors and throw appropriate exceptions
   */
  private async handleError(response: Response): Promise<Error> {
    const status = response.status
    const url = response.url

    // Try to get error message from response
    let errorMessage = response.statusText
    try {
      const body = await response.json()
      errorMessage = body.message || body.error || errorMessage
    } catch {
      // If parsing fails, use statusText
    }

    console.error(`[BrowserApiClient] HTTP ${status} error for ${url}:`, errorMessage)

    switch (status) {
      case 401:
        return new AuthenticationError(errorMessage || 'Invalid credentials')
      case 403:
        return new AuthorizationError(errorMessage || 'Access denied')
      case 404:
        return new NotFoundError(errorMessage || 'Resource not found')
      case 429:
        return new RateLimitError(errorMessage || 'Rate limit exceeded')
      case 500:
      case 502:
      case 503:
        return new ServerError(
          `Server error: ${status} - ${errorMessage}`,
          status
        )
      default:
        return new ApiError(
          `HTTP ${status}: ${errorMessage}`,
          'API_ERROR',
          status
        )
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
