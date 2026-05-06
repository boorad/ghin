import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZodSchema } from 'zod'
import { AuthenticationError, NetworkError, ValidationError } from '../../errors'
import { InMemoryCacheClient } from '../in-memory-cache-client'
import { RequestClient } from './index'

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
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      // Mock successful responses
      const mockSessionResponse = {
        authToken: {
          token: 'session-token',
          expiresIn: '3600s',
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

      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: mockApiResponse }),
      } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
        options: {
          searchParams: new URLSearchParams([['ghin', '1234567']]),
        },
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual(mockApiResponse)
      }
      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('should use cached token if valid', async () => {
      // Mock JWT decode to return valid token
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      // Set cached token
      await mockCache.write('cached-access-token')

      const mockApiResponse = { data: 'test-data' }

      // Mock session fetch to avoid Zod error if called
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            authToken: { token: 'session-token', expiresIn: '3600s' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            golfer_user: { golfer_user_token: 'access-token' },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockApiResponse,
        } as Response)

      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: mockApiResponse }),
      } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual(mockApiResponse)
      }
      expect(fetch).toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      // Mock JWT decode to return valid token
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

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

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NetworkError)
        expect(result.error.message).toContain('Request failed: 404 Not Found')
      }
    })

    it('should handle schema validation errors', async () => {
      // Mock JWT decode to return valid token
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

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
          error: { message: 'Validation failed' },
        }),
      } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError)
        expect(result.error.message).toContain('Response validation failed')
      }
    })

    it('should handle 401 authentication errors after a retry', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      const mockSessionResponse = {
        authToken: { token: 'session-token', expiresIn: '3600s' },
      }
      const mockLoginResponse = {
        golfer_user: { golfer_user_token: 'access-token' },
      }
      const unauthorizedResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Unauthorized' }),
      } as Response

      vi.mocked(fetch)
        // initial auth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoginResponse,
        } as Response)
        // first API attempt → 401
        .mockResolvedValueOnce(unauthorizedResponse)
        // forced re-login
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoginResponse,
        } as Response)
        // retry API attempt → still 401
        .mockResolvedValueOnce(unauthorizedResponse)

      const schema = { safeParse: vi.fn() } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(AuthenticationError)
        expect(result.error.message).toContain('Authentication failed')
      }
      // exactly one re-login was attempted, not a loop
      expect(fetch).toHaveBeenCalledTimes(6)
    })

    it('should auto re-login on 401 and retry successfully', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      const mockSessionResponse = {
        authToken: { token: 'session-token', expiresIn: '3600s' },
      }
      const mockLoginResponse = {
        golfer_user: { golfer_user_token: 'access-token' },
      }
      const mockApiResponse = { data: 'ok-after-relogin' }

      vi.mocked(fetch)
        // initial auth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoginResponse,
        } as Response)
        // first API attempt → 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ error: 'Unauthorized' }),
        } as Response)
        // forced re-login
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoginResponse,
        } as Response)
        // retry API attempt → success
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockApiResponse,
        } as Response)

      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: mockApiResponse }),
      } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual(mockApiResponse)
      }
      expect(fetch).toHaveBeenCalledTimes(6)
    })

    it('should auto re-login on 403 and retry successfully', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      const mockSessionResponse = {
        authToken: { token: 'session-token', expiresIn: '3600s' },
      }
      const mockLoginResponse = {
        golfer_user: { golfer_user_token: 'access-token' },
      }
      const mockApiResponse = { data: 'ok-after-relogin' }

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
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({ error: 'Forbidden' }),
        } as Response)
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

      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: mockApiResponse }),
      } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isOk()).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(6)
    })

    it('should only re-login once when concurrent requests both 401', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      const mockSessionResponse = {
        authToken: { token: 'session-token', expiresIn: '3600s' },
      }
      const firstLoginResponse = {
        golfer_user: { golfer_user_token: 'access-token-v1' },
      }
      const secondLoginResponse = {
        golfer_user: { golfer_user_token: 'access-token-v2' },
      }
      const mockApiResponse = { data: 'ok' }
      const unauthorizedResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Unauthorized' }),
      } as Response
      const okResponse = {
        ok: true,
        json: async () => mockApiResponse,
      } as Response

      // Sequence:
      //   initial auth: session, login (v1)
      //   request A → 401, request B → 401
      //   exactly ONE forced re-login (session, login v2) — not two
      //   request A retry → ok, request B retry → ok
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => firstLoginResponse,
        } as Response)
        .mockResolvedValueOnce(unauthorizedResponse)
        .mockResolvedValueOnce(unauthorizedResponse)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => secondLoginResponse,
        } as Response)
        .mockResolvedValueOnce(okResponse)
        .mockResolvedValueOnce(okResponse)

      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: mockApiResponse }),
      } as unknown as ZodSchema

      const [resultA, resultB] = await Promise.all([
        requestClient.fetch({ entity: 'golfer', schema }),
        requestClient.fetch({ entity: 'golfer', schema }),
      ])

      expect(resultA.isOk()).toBe(true)
      expect(resultB.isOk()).toBe(true)
      // 2 (initial auth) + 2 (first attempts) + 2 (single re-login) + 2 (retries)
      expect(fetch).toHaveBeenCalledTimes(8)
    })

    it('should handle 429 rate limit errors', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      const mockSessionResponse = {
        authToken: { token: 'session-token', expiresIn: '3600s' },
      }
      const mockLoginResponse = {
        golfer_user: { golfer_user_token: 'access-token' },
      }

      const errorResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '60' }),
        json: async () => ({ error: 'Rate limit exceeded' }),
      } as Response

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoginResponse,
        } as Response)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)

      const schema = { safeParse: vi.fn() } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toContain('Rate limit exceeded')
      }
    }, 15000)

    it('should handle 500 server errors', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      const mockSessionResponse = {
        authToken: { token: 'session-token', expiresIn: '3600s' },
      }
      const mockLoginResponse = {
        golfer_user: { golfer_user_token: 'access-token' },
      }

      const errorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      } as Response

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoginResponse,
        } as Response)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)

      const schema = { safeParse: vi.fn() } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toContain('Server error')
      }
    }, 15000)

    it('should handle network errors', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

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
        .mockRejectedValueOnce(new Error('Network failure'))

      const schema = { safeParse: vi.fn() } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toContain('Network request failed')
      }
    })

    it('should handle non-JSON error responses', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

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
          status: 400,
          statusText: 'Bad Request',
          headers: new Headers(),
          json: async () => {
            throw new Error('Invalid JSON')
          },
          text: async () => 'Plain text error',
        } as unknown as Response)

      const schema = { safeParse: vi.fn() } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NetworkError)
      }
    })

    it('should use API login when apiAccess is true', async () => {
      const apiClient = new RequestClient({
        username: 'testuser',
        password: 'testpass',
        cache: mockCache,
        apiAccess: true,
      })

      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      const mockLoginResponse = {
        user: {
          id: '123',
          email: 'test@example.com',
        },
        token: 'api-access-token',
      }
      const mockApiResponse = { data: 'test-data' }

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoginResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockApiResponse,
        } as Response)

      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: mockApiResponse }),
      } as unknown as ZodSchema

      const result = await apiClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual(mockApiResponse)
      }
    })

    it('should handle invalid JWT token', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const mockSessionResponse = {
        authToken: { token: 'session-token', expiresIn: '3600s' },
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

      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: mockApiResponse }),
      } as unknown as ZodSchema

      const result = await requestClient.fetch({
        entity: 'golfer',
        schema,
      })

      expect(result.isOk()).toBe(true)
    })
  })
})
