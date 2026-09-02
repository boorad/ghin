import { describe, expect, it } from 'vitest'
import { type CacheClient, schemaCacheClient } from './cache-client'

describe('CacheClient', () => {
  describe('schemaCacheClient', () => {
    it('should validate a valid cache client', () => {
      const validCacheClient: CacheClient = {
        read: async () => 'cached-token',
        write: async (token: string) => {
          // Mock implementation
        },
      }

      const result = schemaCacheClient.safeParse(validCacheClient)
      expect(result.success).toBe(true)
    })

    it('should validate a cache client with synchronous methods', () => {
      const validCacheClient: CacheClient = {
        read: () => 'cached-token',
        write: (token: string) => {
          // Mock implementation
        },
      }

      const result = schemaCacheClient.safeParse(validCacheClient)
      expect(result.success).toBe(true)
    })

    it('should validate a cache client that returns undefined', () => {
      const validCacheClient: CacheClient = {
        read: async () => undefined,
        write: async (token: string) => {
          // Mock implementation
        },
      }

      const result = schemaCacheClient.safeParse(validCacheClient)
      expect(result.success).toBe(true)
    })

    it('should reject cache client without read method', () => {
      const invalidCacheClient = {
        write: async (token: string) => {
          // Mock implementation
        },
      }

      const result = schemaCacheClient.safeParse(invalidCacheClient)
      expect(result.success).toBe(false)
    })

    it('should reject cache client without write method', () => {
      const invalidCacheClient = {
        read: async () => 'cached-token',
      }

      const result = schemaCacheClient.safeParse(invalidCacheClient)
      expect(result.success).toBe(false)
    })

    it('should reject an empty object', () => {
      const result = schemaCacheClient.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject non-object values', () => {
      expect(schemaCacheClient.safeParse(undefined).success).toBe(false)
      expect(schemaCacheClient.safeParse(null).success).toBe(false)
      expect(schemaCacheClient.safeParse('cache').success).toBe(false)
    })

    it('should reject cache client with non-function read method', () => {
      const invalidCacheClient = {
        read: 'not-a-function',
        write: async (token: string) => {
          // Mock implementation
        },
      }

      const result = schemaCacheClient.safeParse(invalidCacheClient)
      expect(result.success).toBe(false)
    })

    it('should reject cache client with non-function write method', () => {
      const invalidCacheClient = {
        read: async () => 'cached-token',
        write: 'not-a-function',
      }

      const result = schemaCacheClient.safeParse(invalidCacheClient)
      expect(result.success).toBe(false)
    })

    it('should return the exact same reference for a plain object cache (issue #79)', () => {
      const cache: CacheClient = {
        read: () => 'cached-token',
        write: () => {
          // Mock implementation
        },
      }

      const parsed = schemaCacheClient.parse(cache)
      expect(parsed).toBe(cache)
      expect(parsed.read).toBe(cache.read)
      expect(parsed.write).toBe(cache.write)
    })

    it('should preserve a class instance with state on `this` (issue #79)', async () => {
      class StatefulCache implements CacheClient {
        private token: string | undefined

        read(): string | undefined {
          return this.token
        }

        write(value: string): void {
          this.token = value
        }
      }

      const cache = new StatefulCache()
      const parsed = schemaCacheClient.parse(cache)

      expect(parsed).toBe(cache)

      // Methods must remain bound to the original instance — state written
      // through the parsed reference must round-trip through `this`.
      await parsed.write('token-via-parsed')
      expect(await parsed.read()).toBe('token-via-parsed')
      expect(cache.read()).toBe('token-via-parsed')
    })
  })
})
