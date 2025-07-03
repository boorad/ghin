import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestClient } from './index'
import { InMemoryCacheClient } from '../in-memory-cache-client'
import type { ZodSchema } from 'zod'

// Mock fetch globally
global.fetch = vi.fn()

// Mock jwt-decode
vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}))

describe('RequestClient', () => {
  let requestClient: RequestClient
  let mockCache: InMemoryCacheClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockCache = new InMemoryCacheClient()
    
    requestClient = new RequestClient({
      username: 'testuser',
      password: 'testpass',
      cache: mockCache,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(requestClient).toBeInstanceOf(RequestClient)
    })

    it('should throw error with invalid config', () => {
      expect(() => {
        new RequestClient({
          username: '',
          password: 'testpass',
          cache: mockCache,
        } as unknown as { username: string; password: string; cache: typeof mockCache })
      }).toThrow('Invalid RequestClientConfig')
    })
  })

  describe('fetch', () => {
    it('should make authenticated request with valid token', async () => {
      // Mock JWT decode to return valid token
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 })

      // Mock successful responses
      const mockSessionResponse = {
        authToken: { 
          token: 'session-token',
          expiresIn: '3600s'
        },
      }
      const mockLoginResponse = {
        golfer_user: { golfer_user_token: 'access-token' },
      }
      const mockApiResponse = { data: 'test-data' }

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoginResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockApiResponse,
        } as Response)

      const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: mockApiResponse }) } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
        options: {
          searchParams: new URLSearchParams([['ghin', '1234567']]),
        },
      })

      expect(result).toEqual(mockApiResponse)
      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('should use cached token if valid', async () => {
      // Mock JWT decode to return valid token
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 })

      // Set cached token
      await mockCache.write('cached-access-token')

      const mockApiResponse = { data: 'test-data' }

      // Mock session fetch to avoid Zod error if called
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ authToken: { token: 'session-token', expiresIn: '3600s' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ golfer_user: { golfer_user_token: 'access-token' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockApiResponse,
        } as Response)

      const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: mockApiResponse }) } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result).toEqual(mockApiResponse)
      expect(fetch).toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      // Mock JWT decode to return valid token
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 })

      // Mock successful auth responses
      const mockSessionResponse = {
        authToken: { token: 'session-token', expiresIn: '3600s' },
      }
      const mockLoginResponse = {
        golfer_user: { golfer_user_token: 'access-token' },
      }

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoginResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ error: 'Not found' }),
        } as Response)

      const schema = { safeParse: vi.fn() } as unknown as ZodSchema

      await expect(
        requestClient.fetch({
          entity: 'golfer',
          schema,
        })
      ).rejects.toThrow('GET request failed: 404 Not Found')
    })

    it('should handle schema validation errors', async () => {
      // Mock JWT decode to return valid token
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 })

      // Mock successful auth responses
      const mockSessionResponse = {
        authToken: { token: 'session-token', expiresIn: '3600s' },
      }
      const mockLoginResponse = {
        golfer_user: { golfer_user_token: 'access-token' },
      }

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoginResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ invalid: 'data' }),
        } as Response)

      const schema = { 
        safeParse: vi.fn().mockReturnValue({ 
          success: false, 
          error: { message: 'Validation failed' } 
        }) 
      } as unknown as ZodSchema

      await expect(
        requestClient.fetch({
          entity: 'golfer',
          schema,
        })
      ).rejects.toThrow('GET response failed to parse')
    })
  })
}) 