import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { GhinError, NetworkError, RateLimitError, toGhinError } from '../errors'

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableStatusCodes: number[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}

export function isRetryableError(error: Error): boolean {
  if (error instanceof NetworkError) {
    return error.statusCode ? DEFAULT_RETRY_CONFIG.retryableStatusCodes.includes(error.statusCode) : true
  }
  if (error instanceof RateLimitError) {
    return true
  }
  return false
}

export function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * config.backoffMultiplier ** (attempt - 1)
  return Math.min(delay, config.maxDelay)
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  operation: () => Promise<Result<T, GhinError>>,
  config: Partial<RetryConfig> = {},
): Promise<Result<T, GhinError>> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    const result = await operation()

    if (result.isOk()) {
      return result
    }

    const error = result.error

    // Don't retry on the last attempt
    if (attempt === finalConfig.maxAttempts) {
      return result
    }

    // Only retry if it's a retryable error
    if (!isRetryableError(error)) {
      return result
    }

    // Calculate delay with jitter to avoid thundering herd
    const delay = calculateDelay(attempt, finalConfig)
    const jitter = Math.random() * 0.1 * delay // 10% jitter
    const totalDelay = delay + jitter

    await sleep(totalDelay)
  }

  // This should never be reached, but TypeScript requires it
  return err(new NetworkError('Retry exhausted'))
}

export async function withRetryAsync<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<Result<T, GhinError>> {
  return withRetry(async () => {
    try {
      const result = await operation()
      return ok(result)
    } catch (error) {
      // A thrown `GhinError` keeps its class, and with it its retryability.
      // Anything else must not gain any: `toGhinError` would wrap it in a
      // `NetworkError`, and a `NetworkError` without a status code is
      // retryable, so an arbitrary throw would burn every attempt where it
      // used to come straight back after one. Re-home it on the base
      // `GhinError` — which `isRetryableError` refuses — keeping the message
      // and `cause` `toGhinError` produces.
      if (error instanceof GhinError) {
        return err(error)
      }

      const wrapped = toGhinError(error)

      return err(new GhinError(wrapped.message, wrapped.code, wrapped.statusCode, wrapped.cause))
    }
  }, config)
}
