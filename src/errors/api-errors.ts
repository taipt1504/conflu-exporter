import { ConfluenceExporterError } from './base-error.js'

export class ApiError extends ConfluenceExporterError {
  public readonly statusCode?: number

  constructor(message: string, code: string, statusCode?: number, details?: unknown) {
    super(message, code, details)
    this.statusCode = statusCode
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
    }
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed', details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', 401, details)
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Not authorized to access this resource', details?: unknown) {
    super(message, 'AUTHORIZATION_ERROR', 403, details)
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found', details?: unknown) {
    super(message, 'NOT_FOUND_ERROR', 404, details)
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfter?: number

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number, details?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', 429, details)
    this.retryAfter = retryAfter
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    }
  }
}

export class NetworkError extends ApiError {
  constructor(message: string = 'Network request failed', details?: unknown) {
    super(message, 'NETWORK_ERROR', undefined, details)
  }
}

export class TimeoutError extends ApiError {
  constructor(message: string = 'Request timed out', details?: unknown) {
    super(message, 'TIMEOUT_ERROR', 408, details)
  }
}

export class ServerError extends ApiError {
  constructor(message: string = 'Server error', statusCode: number = 500, details?: unknown) {
    super(message, 'SERVER_ERROR', statusCode, details)
  }
}

export class InvalidResponseError extends ApiError {
  constructor(message: string = 'Invalid response from server', details?: unknown) {
    super(message, 'INVALID_RESPONSE_ERROR', undefined, details)
  }
}
