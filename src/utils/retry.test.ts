import { err, ok } from 'neverthrow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkError, RateLimitError } from '../errors'
import * as retryUtils from './retry'
import { DEFAULT_RETRY_CONFIG, calculateDelay, isRetryableError, withRetry, withRetryAsync } from './retry'

// Mock sleep to resolve instantly for all tests
beforeEach(() => {
  vi.spyOn(retryUtils, 'sleep').mockImplementation(() => Promise.resolve())
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('retry utilities', () => {
  describe('calculateDelay', () => {
    it('should calculate exponential backoff delay', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, baseDelay: 1000, backoffMultiplier: 2 }

      expect(calculateDelay(1, config)).toBe(1000)
      expect(calculateDelay(2, config)).toBe(2000)
      expect(calculateDelay(3, config)).toBe(4000)
    })

    it('should respect max delay', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, baseDelay: 1000, maxDelay: 2000, backoffMultiplier: 2 }

      expect(calculateDelay(1, config)).toBe(1000)
      expect(calculateDelay(2, config)).toBe(2000) // Capped at maxDelay
      expect(calculateDelay(3, config)).toBe(2000) // Capped at maxDelay
    })
  })

  describe('isRetryableError', () => {
    it('should identify retryable network errors', () => {
      const retryableError = new NetworkError('Server error', 500)
      const nonRetryableError = new NetworkError('Bad request', 400)

      expect(isRetryableError(retryableError)).toBe(true)
      expect(isRetryableError(nonRetryableError)).toBe(false)
    })

    it('should identify rate limit errors as retryable', () => {
      const rateLimitError = new RateLimitError('Rate limited', 60)
      expect(isRetryableError(rateLimitError)).toBe(true)
    })

    it('should identify network errors without status code as retryable', () => {
      const networkError = new NetworkError('Connection failed')
      expect(isRetryableError(networkError)).toBe(true)
    })
  })

  describe('withRetry', () => {
    it('should return success on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue(ok('success'))

      const result = await withRetry(operation)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe('success')
      }
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors and eventually succeed', async () => {
      const operation = vi
        .fn()
        .mockResolvedValueOnce(err(new NetworkError('Server error', 500)))
        .mockResolvedValueOnce(err(new NetworkError('Server error', 500)))
        .mockResolvedValueOnce(ok('success'))

      const result = await withRetry(operation, { maxAttempts: 3 })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe('success')
      }
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable errors', async () => {
      const operation = vi.fn().mockResolvedValue(err(new NetworkError('Bad request', 400)))

      const result = await withRetry(operation, { maxAttempts: 3 })

      expect(result.isErr()).toBe(true)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should stop retrying after max attempts', async () => {
      const operation = vi.fn().mockResolvedValue(err(new NetworkError('Server error', 500)))

      const result = await withRetry(operation, { maxAttempts: 2 })

      expect(result.isErr()).toBe(true)
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('withRetryAsync', () => {
    it('should handle async operations that throw', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError('Network error', 500))
        .mockResolvedValueOnce('success')

      const result = await withRetryAsync(operation, { maxAttempts: 2 })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe('success')
      }
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should convert thrown errors to Result', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await withRetryAsync(operation, { maxAttempts: 1 })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toBe('Network error')
      }
    })
  })
})
