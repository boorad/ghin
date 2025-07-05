import { describe, expect, it } from 'vitest'
import { type ClientConfig, schemaClientConfig } from './client-config'

describe('ClientConfig', () => {
  describe('schemaClientConfig', () => {
    it('should validate a valid config', () => {
      const validConfig: ClientConfig = {
        username: 'testuser',
        password: 'testpass',
      }

      const result = schemaClientConfig.safeParse(validConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validConfig)
      }
    })

    it('should validate a config with optional cache', () => {
      const validConfig: ClientConfig = {
        username: 'testuser',
        password: 'testpass',
        cache: {
          read: async () => 'cached-token',
          write: async (token: string) => {
            // Mock implementation
          },
        },
      }

      const result = schemaClientConfig.safeParse(validConfig)
      expect(result.success).toBe(true)
    })

    it('should reject config without username', () => {
      const invalidConfig = {
        password: 'testpass',
      }

      const result = schemaClientConfig.safeParse(invalidConfig)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1)
        expect(result.error.issues[0]?.path).toEqual(['username'])
      }
    })

    it('should reject config without password', () => {
      const invalidConfig = {
        username: 'testuser',
      }

      const result = schemaClientConfig.safeParse(invalidConfig)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1)
        expect(result.error.issues[0]?.path).toEqual(['password'])
      }
    })

    it('should reject config with empty username', () => {
      const invalidConfig = {
        username: '',
        password: 'testpass',
      }

      const result = schemaClientConfig.safeParse(invalidConfig)
      expect(result.success).toBe(false)
    })

    it('should reject config with empty password', () => {
      const invalidConfig = {
        username: 'testuser',
        password: '',
      }

      const result = schemaClientConfig.safeParse(invalidConfig)
      expect(result.success).toBe(false)
    })

    it('should reject config with non-string username', () => {
      const invalidConfig = {
        username: 123,
        password: 'testpass',
      }

      const result = schemaClientConfig.safeParse(invalidConfig)
      expect(result.success).toBe(false)
    })

    it('should reject config with non-string password', () => {
      const invalidConfig = {
        username: 'testuser',
        password: 123,
      }

      const result = schemaClientConfig.safeParse(invalidConfig)
      expect(result.success).toBe(false)
    })
  })
})
