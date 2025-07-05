export class GhinError extends Error {
  readonly code: string
  readonly statusCode?: number
  readonly cause?: Error

  constructor(message: string, code: string, statusCode?: number, cause?: Error) {
    super(message)
    this.name = 'GhinError'
    this.code = code
    this.statusCode = statusCode
    this.cause = cause
  }
}

export class AuthenticationError extends GhinError {
  constructor(message: string, statusCode?: number, cause?: Error) {
    super(message, 'AUTHENTICATION_ERROR', statusCode, cause)
    this.name = 'AuthenticationError'
  }
}

export class NetworkError extends GhinError {
  constructor(message: string, statusCode?: number, cause?: Error) {
    super(message, 'NETWORK_ERROR', statusCode, cause)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends GhinError {
  readonly field?: string

  constructor(message: string, field?: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', undefined, cause)
    this.name = 'ValidationError'
    this.field = field
  }
}

export class RateLimitError extends GhinError {
  readonly retryAfter?: number

  constructor(message: string, retryAfter?: number, cause?: Error) {
    super(message, 'RATE_LIMIT_ERROR', 429, cause)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export class ConfigurationError extends GhinError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIGURATION_ERROR', undefined, cause)
    this.name = 'ConfigurationError'
  }
}

export class CacheError extends GhinError {
  constructor(message: string, cause?: Error) {
    super(message, 'CACHE_ERROR', undefined, cause)
    this.name = 'CacheError'
  }
}

// Error codes for easy identification
export const ErrorCodes = {
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
