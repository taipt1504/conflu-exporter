import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios'
import { getLogger } from '../cli/ui/logger.js'
import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ServerError,
  InvalidResponseError,
} from '../errors/index.js'

export interface ApiClientConfig {
  baseUrl: string
  email?: string
  token?: string
  timeout?: number
  retries?: number
}

export class ConfluenceApiClient {
  private axiosInstance: AxiosInstance
  private config: ApiClientConfig
  private retryCount: Map<string, number> = new Map()

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config,
    }

    this.axiosInstance = axios.create({
      baseURL: `${this.config.baseUrl}/wiki/rest/api`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor - Add authentication
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.config.email && this.config.token) {
          const auth = Buffer.from(`${this.config.email}:${this.config.token}`).toString(
            'base64',
          )
          config.headers.Authorization = `Basic ${auth}`
        }

        const logger = getLogger()
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`)

        return config
      },
      (error) => {
        return Promise.reject(error)
      },
    )

    // Response interceptor - Handle errors and retries
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const logger = getLogger()
        logger.debug(`API Response: ${response.status} ${response.config.url}`)
        return response
      },
      async (error: AxiosError) => {
        return this.handleError(error)
      },
    )
  }

  private async handleError(error: AxiosError): Promise<never> {
    const logger = getLogger()
    const config = error.config as AxiosRequestConfig & { _retryCount?: number }

    // Handle rate limiting with retry
    if (error.response?.status === 429) {
      const retryAfter = this.getRetryAfter(error.response)
      const requestKey = `${config.method}:${config.url}`
      const currentRetry = this.retryCount.get(requestKey) || 0

      if (currentRetry < (this.config.retries || 3)) {
        this.retryCount.set(requestKey, currentRetry + 1)
        logger.warn(
          `Rate limited. Retrying after ${retryAfter}ms (attempt ${currentRetry + 1}/${this.config.retries})`,
        )

        await this.delay(retryAfter)
        return this.axiosInstance.request(config)
      }

      this.retryCount.delete(requestKey)
      throw new RateLimitError('Rate limit exceeded', retryAfter, {
        url: config.url,
        attempts: currentRetry + 1,
      })
    }

    // Handle other errors
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response

      logger.error(`API Error ${status}: ${config.url}`, data)

      switch (status) {
        case 401:
          throw new AuthenticationError('Invalid credentials or token expired', {
            url: config.url,
            response: data,
          })
        case 403:
          throw new AuthorizationError('Access denied to this resource', {
            url: config.url,
            response: data,
          })
        case 404:
          throw new NotFoundError('Resource not found', {
            url: config.url,
            response: data,
          })
        case 408:
          throw new TimeoutError('Request timed out', {
            url: config.url,
          })
        case 500:
        case 502:
        case 503:
        case 504:
          throw new ServerError('Server error', status, {
            url: config.url,
            response: data,
          })
        default:
          throw new ApiError('API request failed', 'API_ERROR', status, {
            url: config.url,
            response: data,
          })
      }
    } else if (error.request) {
      // Request was made but no response received
      logger.error(`Network Error: ${config.url}`, error.message)
      throw new NetworkError('No response received from server', {
        url: config.url,
        error: error.message,
      })
    } else {
      // Error in request configuration
      logger.error(`Request Error: ${error.message}`)
      throw new InvalidResponseError('Failed to make request', {
        error: error.message,
      })
    }
  }

  private getRetryAfter(response: AxiosResponse): number {
    const retryAfter = response.headers['retry-after']
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10)
      if (!isNaN(seconds)) {
        return seconds * 1000
      }
    }
    // Default exponential backoff: 1s, 2s, 4s, 8s...
    return Math.min(1000 * Math.pow(2, this.retryCount.size), 10000)
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Make a GET request to Confluence API
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.get<T>(url, config)
    return response.data
  }

  /**
   * Make a POST request to Confluence API
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.post<T>(url, data, config)
    return response.data
  }

  /**
   * Make a PUT request to Confluence API
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, data, config)
    return response.data
  }

  /**
   * Make a DELETE request to Confluence API
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url, config)
    return response.data
  }

  /**
   * Download a file (for attachments)
   */
  async download(url: string, config?: AxiosRequestConfig): Promise<Buffer> {
    const response = await this.axiosInstance.get<ArrayBuffer>(url, {
      ...config,
      responseType: 'arraybuffer',
    })
    return Buffer.from(response.data)
  }

  /**
   * Test the connection to Confluence
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.get('/space')
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl
  }
}

export function createApiClient(config: ApiClientConfig): ConfluenceApiClient {
  return new ConfluenceApiClient(config)
}
