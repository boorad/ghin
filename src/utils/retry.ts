import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { NetworkError, RateLimitError } from '../errors'

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
  operation: () => Promise<Result<T, Error>>,
  config: Partial<RetryConfig> = {}
): Promise<Result<T, Error>> {
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
  return err(new Error('Retry exhausted'))
}

export async function withRetryAsync<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<Result<T, Error>> {
  return withRetry(async () => {
    try {
      const result = await operation()
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)))
    }
  }, config)
}
