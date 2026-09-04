import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZodSchema } from 'zod'
import { AuthenticationError, CacheError, NetworkError, RateLimitError, ValidationError } from '../../errors'
import type { CacheClient, ClientConfig } from '../../models'
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
        entity: 'golfers_search',
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
        entity: 'golfers_search',
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
        entity: 'golfers_search',
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
        entity: 'golfers_search',
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
        entity: 'golfers_search',
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
        entity: 'golfers_search',
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
        requestClient.fetch({ entity: 'golfers_search', schema }),
        requestClient.fetch({ entity: 'golfers_search', schema }),
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
        entity: 'golfers_search',
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
        entity: 'golfers_search',
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
        entity: 'golfers_search',
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
        entity: 'golfers_search',
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
        entity: 'golfers_search',
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
        entity: 'golfers_search',
        schema,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Helpers for the suites below. Kept local so the suites above are untouched.
  // ---------------------------------------------------------------------------

  const validExp = () => ({ exp: Math.floor(Date.now() / 1000) + 3600 })

  const jsonOk = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response

  const httpError = (status: number, statusText: string, headers = new Headers()) =>
    ({
      ok: false,
      status,
      statusText,
      headers,
      json: async () => ({ error: statusText }),
    }) as unknown as Response

  const sessionOk = () => jsonOk({ authToken: { token: 'session-token', expiresIn: '3600s' } })

  const loginOk = (token = 'access-token') => jsonOk({ golfer_user: { golfer_user_token: token } })

  const okSchema = (data: unknown) =>
    ({ safeParse: vi.fn().mockReturnValue({ success: true, data }) }) as unknown as ZodSchema

  const noopSchema = () => ({ safeParse: vi.fn() }) as unknown as ZodSchema

  // A plain-object cache with vi.fn methods, for asserting on calls. The config
  // schema passes the cache through by reference (#79), so class instances work
  // too — see StatefulCache below for the `this`-bound variant.
  const makeCache = (overrides: Partial<CacheClient> = {}): CacheClient => ({
    read: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
    ...overrides,
  })

  // A class-based cache whose state lives on `this` — the shape issue #79 broke:
  // Zod's function wrappers used to detach these methods from their instance.
  class StatefulCache implements CacheClient {
    private store: string | undefined

    constructor(seed?: string) {
      this.store = seed
    }

    async read(): Promise<string | undefined> {
      return this.store
    }

    async write(value: string): Promise<void> {
      this.store = value
    }
  }

  const clientWith = (cache: CacheClient, apiAccess = false) =>
    new RequestClient({ username: 'testuser', password: 'testpass', cache, apiAccess })

  const urlsFetched = () => vi.mocked(fetch).mock.calls.map((call) => String(call[0]))

  describe('constructor cache default', () => {
    it('should fall back to an in-memory cache when the config supplies none', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      const cachelessClient = new RequestClient({ username: 'testuser', password: 'testpass' })

      vi.mocked(fetch)
        .mockResolvedValueOnce(sessionOk())
        .mockResolvedValueOnce(loginOk())
        .mockResolvedValueOnce(jsonOk({ data: 'test-data' }))

      const result = await cachelessClient.fetch({
        entity: 'golfers_search',
        schema: okSchema({ data: 'test-data' }),
      })

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({ data: 'test-data' })
      expect(fetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('token cache', () => {
    it('should reuse a valid cached token instead of logging in again', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      const cache = makeCache({ read: vi.fn(async () => 'cached-access-token') })
      const client = clientWith(cache)

      vi.mocked(fetch).mockResolvedValueOnce(jsonOk({ data: 'test-data' }))

      const result = await client.fetch({
        entity: 'golfers_search',
        schema: okSchema({ data: 'test-data' }),
      })

      expect(result.isOk()).toBe(true)
      // no session + login round trip: the cached token was taken at face value
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({
        Authorization: 'Bearer cached-access-token',
      })
    })

    it('should treat an undecodable cached token as invalid and log in again', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockImplementation(() => {
        throw new Error('Invalid token specified')
      })

      const cache = makeCache({ read: vi.fn(async () => 'not-a-jwt') })
      const client = clientWith(cache)

      vi.mocked(fetch)
        .mockResolvedValueOnce(sessionOk())
        .mockResolvedValueOnce(loginOk())
        .mockResolvedValueOnce(jsonOk({ data: 'test-data' }))

      const result = await client.fetch({
        entity: 'golfers_search',
        schema: okSchema({ data: 'test-data' }),
      })

      expect(result.isOk()).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(3)
      expect(cache.write).toHaveBeenCalledWith('access-token')
    })

    it('should surface a failing cache read as a CacheError without attempting a login', async () => {
      const cache = makeCache({
        read: vi.fn(async () => {
          throw new Error('redis unreachable')
        }),
      })
      const client = clientWith(cache)

      const result = await client.fetch({ entity: 'golfers_search', schema: noopSchema() })

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error).toBeInstanceOf(CacheError)
      expect(error.message).toBe('Failed to read from cache: redis unreachable')
      expect(error.cause).toBeInstanceOf(Error)
      // a broken cache must not silently fall through to a login
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should surface a failing cache write as a CacheError after a successful login', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      const cache = makeCache({
        write: vi.fn(async () => {
          throw new Error('disk full')
        }),
      })
      const client = clientWith(cache)

      vi.mocked(fetch).mockResolvedValueOnce(sessionOk()).mockResolvedValueOnce(loginOk())

      const result = await client.fetch({ entity: 'golfers_search', schema: noopSchema() })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(CacheError)
      expect(result._unsafeUnwrapErr().message).toBe('Failed to write to cache: disk full')
      // session + login only; the request itself was never issued
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should stringify a non-Error cache failure and leave the cause unset', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      const readClient = clientWith(makeCache({ read: vi.fn(() => Promise.reject('read exploded')) }))

      const readResult = await readClient.fetch({ entity: 'golfers_search', schema: noopSchema() })

      expect(readResult.isErr()).toBe(true)
      expect(readResult._unsafeUnwrapErr()).toBeInstanceOf(CacheError)
      expect(readResult._unsafeUnwrapErr().message).toBe('Failed to read from cache: read exploded')
      expect(readResult._unsafeUnwrapErr().cause).toBeUndefined()

      const writeClient = clientWith(makeCache({ write: vi.fn(() => Promise.reject('write exploded')) }))
      vi.mocked(fetch).mockResolvedValueOnce(sessionOk()).mockResolvedValueOnce(loginOk())

      const writeResult = await writeClient.fetch({ entity: 'golfers_search', schema: noopSchema() })

      expect(writeResult.isErr()).toBe(true)
      expect(writeResult._unsafeUnwrapErr()).toBeInstanceOf(CacheError)
      expect(writeResult._unsafeUnwrapErr().message).toBe('Failed to write to cache: write exploded')
      expect(writeResult._unsafeUnwrapErr().cause).toBeUndefined()
    })

    it('should not persist a token when the login itself fails', async () => {
      const cache = makeCache()
      const client = clientWith(cache)

      vi.mocked(fetch).mockResolvedValueOnce(httpError(500, 'Internal Server Error'))

      const result = await client.fetch({ entity: 'golfers_search', schema: noopSchema() })

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      // the session-token failure is passed back unchanged, not remapped
      expect(error).toBeInstanceOf(NetworkError)
      expect(error.statusCode).toBe(500)
      expect(error.message).toContain('Server error: 500 Internal Server Error')
      expect(cache.write).not.toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('user-supplied cache identity (#79)', () => {
    it('should keep the exact cache instance the caller passed in', () => {
      const cache = new StatefulCache()
      const client = clientWith(cache)

      expect((client as unknown as { config: ClientConfig }).config.cache).toBe(cache)
    })

    it('should let a second client reuse the token a first client wrote to a shared stateful cache', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      const cache = new StatefulCache()

      const first = clientWith(cache)
      vi.mocked(fetch)
        .mockResolvedValueOnce(sessionOk())
        .mockResolvedValueOnce(loginOk('shared-token'))
        .mockResolvedValueOnce(jsonOk({ data: 'first' }))

      const firstResult = await first.fetch({ entity: 'golfers_search', schema: okSchema({ data: 'first' }) })
      expect(firstResult.isOk()).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(3)

      vi.mocked(fetch).mockClear()

      const second = clientWith(cache)
      vi.mocked(fetch).mockResolvedValueOnce(jsonOk({ data: 'second' }))

      const secondResult = await second.fetch({ entity: 'golfers_search', schema: okSchema({ data: 'second' }) })

      expect(secondResult.isOk()).toBe(true)
      // the cached token was reused: one API fetch, no session/login round trip
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(urlsFetched().filter((url) => url.includes('login'))).toHaveLength(0)
      expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({
        Authorization: 'Bearer shared-token',
      })
    })

    it('should read a pre-seeded token from a stateful cache on first use', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      const client = clientWith(new StatefulCache('pre-seeded-token'))
      vi.mocked(fetch).mockResolvedValueOnce(jsonOk({ data: 'test-data' }))

      const result = await client.fetch({ entity: 'golfers_search', schema: okSchema({ data: 'test-data' }) })

      expect(result.isOk()).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(urlsFetched().filter((url) => url.includes('login'))).toHaveLength(0)
      expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({
        Authorization: 'Bearer pre-seeded-token',
      })
    })
  })

  describe('_fetch error shapes', () => {
    it('should wrap a non-Error rejection as an unknown network error', async () => {
      // the session request is not retried, so this stays off the backoff path
      vi.mocked(fetch).mockRejectedValueOnce('kaboom')

      const result = await requestClient.fetch({ entity: 'golfers_search', schema: noopSchema() })

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error).toBeInstanceOf(NetworkError)
      expect(error.message).toBe('Unknown network error: kaboom')
      expect(error.cause).toBeUndefined()
    })

    it('should leave retryAfter undefined when a 429 carries no Retry-After header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(httpError(429, 'Too Many Requests'))

      const result = await requestClient.fetch({ entity: 'golfers_search', schema: noopSchema() })

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error).toBeInstanceOf(RateLimitError)
      expect((error as RateLimitError).retryAfter).toBeUndefined()
    })
  })

  describe('401 forced re-login failure', () => {
    it('should return the re-login failure with its status code and attempt exactly one re-login', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      vi.mocked(fetch)
        // initial auth
        .mockResolvedValueOnce(sessionOk())
        .mockResolvedValueOnce(loginOk())
        // API attempt -> 401, triggering the forced re-login
        .mockResolvedValueOnce(httpError(401, 'Unauthorized'))
        // the forced re-login: session succeeds, login is rejected outright
        .mockResolvedValueOnce(sessionOk())
        .mockResolvedValueOnce(httpError(401, 'Unauthorized'))
        // anything past here would mean the client looped
        .mockResolvedValue(httpError(401, 'Unauthorized'))

      const result = await requestClient.fetch({ entity: 'golfers_search', schema: noopSchema() })

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error).toBeInstanceOf(AuthenticationError)
      expect(error.statusCode).toBe(401)
      expect(error.message).toContain('Authentication failed: 401 Unauthorized')

      // the invariant: one re-login, never a login storm on bad credentials
      expect(fetch).toHaveBeenCalledTimes(5)
      expect(urlsFetched().filter((url) => url.endsWith('/golfer_login.json'))).toHaveLength(2)
      expect(urlsFetched().filter((url) => url.endsWith('/golfers/search.json'))).toHaveLength(1)
    })
  })

  describe('fetch / fetchCustomPath entry points', () => {
    it('should resolve a named entity to its versioned API pathname', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      const client = clientWith(makeCache({ read: vi.fn(async () => 'cached-access-token') }))
      vi.mocked(fetch).mockResolvedValueOnce(jsonOk({ data: 'ok' }))

      const result = await client.fetch({ entity: 'course_handicaps', schema: okSchema({ data: 'ok' }) })

      expect(result.isOk()).toBe(true)
      expect(urlsFetched()[0]).toBe('https://api2.ghin.com/api/v1/playing_handicaps.json')
    })

    it('should join a custom path onto the versioned base url', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      const client = clientWith(makeCache({ read: vi.fn(async () => 'cached-access-token') }))
      vi.mocked(fetch).mockResolvedValueOnce(jsonOk({ data: 'ok' }))

      const result = await client.fetchCustomPath({
        path: '/golfers/12345/scores.json',
        schema: okSchema({ data: 'ok' }),
      })

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({ data: 'ok' })
      expect(urlsFetched()[0]).toBe('https://api2.ghin.com/api/v1/golfers/12345/scores.json')
      expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({
        Authorization: 'Bearer cached-access-token',
      })
    })

    it('should encode spaces in custom-path search params as %20 rather than +', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      const client = clientWith(makeCache({ read: vi.fn(async () => 'cached-access-token') }))
      vi.mocked(fetch).mockResolvedValueOnce(jsonOk({ data: 'ok' }))

      await client.fetchCustomPath({
        path: '/facilities/search.json',
        schema: okSchema({ data: 'ok' }),
        options: { searchParams: new URLSearchParams([['name', 'Pebble Beach']]) },
      })

      expect(urlsFetched()[0]).toBe('https://api2.ghin.com/api/v1/facilities/search.json?name=Pebble%20Beach')
    })

    it('should pass an error from a custom path back to the caller unwrapped', async () => {
      const { jwtDecode } = await import('jwt-decode')
      vi.mocked(jwtDecode).mockReturnValue(validExp())

      const client = clientWith(makeCache({ read: vi.fn(async () => 'cached-access-token') }))
      // 404 is not retryable, so this returns after a single attempt
      vi.mocked(fetch).mockResolvedValueOnce(httpError(404, 'Not Found'))

      const result = await client.fetchCustomPath({
        path: '/golfers/12345/scores.json',
        schema: noopSchema(),
      })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NetworkError)
      expect(result._unsafeUnwrapErr().statusCode).toBe(404)
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })
})
