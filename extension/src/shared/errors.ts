/**
 * Browser-compatible error classes
 * Self-contained error hierarchy for extension
 */

export class ApiError extends Error {
  public readonly code: string
  public readonly statusCode?: number

  constructor(message: string, code: string, statusCode?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Not authorized to access this resource') {
    super(message, 'AUTHORIZATION_ERROR', 403)
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND_ERROR', 404)
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfter?: number

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export class NetworkError extends ApiError {
  constructor(message: string = 'Network request failed') {
    super(message, 'NETWORK_ERROR')
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends ApiError {
  constructor(message: string = 'Request timed out') {
    super(message, 'TIMEOUT_ERROR', 408)
    this.name = 'TimeoutError'
  }
}

export class ServerError extends ApiError {
  constructor(message: string = 'Server error', statusCode: number = 500) {
    super(message, 'SERVER_ERROR', statusCode)
    this.name = 'ServerError'
  }
}
