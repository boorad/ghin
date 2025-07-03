import { describe, it, expect } from 'vitest'
import { schemaCacheClient, type CacheClient } from './cache-client'

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
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1)
        expect(result.error.issues[0]?.path).toEqual(['read'])
      }
    })

    it('should reject cache client without write method', () => {
      const invalidCacheClient = {
        read: async () => 'cached-token',
      }

      const result = schemaCacheClient.safeParse(invalidCacheClient)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1)
        expect(result.error.issues[0]?.path).toEqual(['write'])
      }
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
  })
}) 