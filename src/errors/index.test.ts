import { describe, expect, it } from 'vitest'
import {
  AuthenticationError,
  CacheError,
  ConfigurationError,
  ErrorCodes,
  GhinError,
  NetworkError,
  RateLimitError,
  ValidationError,
} from './index'

describe('GhinError', () => {
  it('should create a basic GhinError', () => {
    const error = new GhinError('Test error', 'TEST_ERROR', 400)

    expect(error.message).toBe('Test error')
    expect(error.code).toBe('TEST_ERROR')
    expect(error.statusCode).toBe(400)
    expect(error.name).toBe('GhinError')
    expect(error).toBeInstanceOf(Error)
  })

  it('should handle optional parameters', () => {
    const cause = new Error('Original error')
    const error = new GhinError('Test error', 'TEST_ERROR', undefined, cause)

    expect(error.statusCode).toBeUndefined()
    expect(error.cause).toBe(cause)
  })
})

describe('AuthenticationError', () => {
  it('should create an AuthenticationError', () => {
    const error = new AuthenticationError('Auth failed', 401)

    expect(error.message).toBe('Auth failed')
    expect(error.code).toBe(ErrorCodes.AUTHENTICATION_ERROR)
    expect(error.statusCode).toBe(401)
    expect(error.name).toBe('AuthenticationError')
    expect(error).toBeInstanceOf(GhinError)
  })
})

describe('NetworkError', () => {
  it('should create a NetworkError', () => {
    const error = new NetworkError('Network failed', 500)

    expect(error.message).toBe('Network failed')
    expect(error.code).toBe(ErrorCodes.NETWORK_ERROR)
    expect(error.statusCode).toBe(500)
    expect(error.name).toBe('NetworkError')
    expect(error).toBeInstanceOf(GhinError)
  })
})

describe('ValidationError', () => {
  it('should create a ValidationError', () => {
    const error = new ValidationError('Invalid input', 'email')

    expect(error.message).toBe('Invalid input')
    expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(error.field).toBe('email')
    expect(error.statusCode).toBeUndefined()
    expect(error.name).toBe('ValidationError')
    expect(error).toBeInstanceOf(GhinError)
  })
})

describe('RateLimitError', () => {
  it('should create a RateLimitError', () => {
    const error = new RateLimitError('Rate limited', 60)

    expect(error.message).toBe('Rate limited')
    expect(error.code).toBe(ErrorCodes.RATE_LIMIT_ERROR)
    expect(error.statusCode).toBe(429)
    expect(error.retryAfter).toBe(60)
    expect(error.name).toBe('RateLimitError')
    expect(error).toBeInstanceOf(GhinError)
  })
})

describe('ConfigurationError', () => {
  it('should create a ConfigurationError', () => {
    const error = new ConfigurationError('Invalid config')

    expect(error.message).toBe('Invalid config')
    expect(error.code).toBe(ErrorCodes.CONFIGURATION_ERROR)
    expect(error.statusCode).toBeUndefined()
    expect(error.name).toBe('ConfigurationError')
    expect(error).toBeInstanceOf(GhinError)
  })
})

describe('CacheError', () => {
  it('should create a CacheError', () => {
    const error = new CacheError('Cache failed')

    expect(error.message).toBe('Cache failed')
    expect(error.code).toBe(ErrorCodes.CACHE_ERROR)
    expect(error.statusCode).toBeUndefined()
    expect(error.name).toBe('CacheError')
    expect(error).toBeInstanceOf(GhinError)
  })
})

describe('ErrorCodes', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCodes.AUTHENTICATION_ERROR).toBe('AUTHENTICATION_ERROR')
    expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR')
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(ErrorCodes.RATE_LIMIT_ERROR).toBe('RATE_LIMIT_ERROR')
    expect(ErrorCodes.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR')
    expect(ErrorCodes.CACHE_ERROR).toBe('CACHE_ERROR')
  })
})
