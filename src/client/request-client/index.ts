import { Mutex } from 'async-mutex'
import { type JwtPayload, jwtDecode } from 'jwt-decode'
import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import type { ZodSchema } from 'zod'
import {
  AuthenticationError,
  CacheError,
  ConfigurationError,
  NetworkError,
  RateLimitError,
  ValidationError,
} from '../../errors'
import { type ClientConfig, schemaClientConfig } from '../../models'
import { withRetry } from '../../utils/retry'
import { InMemoryCacheClient } from '../in-memory-cache-client'
import {
  type AccessToken,
  type LoginResponse,
  type SessionResponse,
  schemaLoginAPIResponse,
  schemaLoginResponse,
  schemaSessionResponse,
} from './models'

const FIREBASE_SESSION_URL = new URL(
  'https://firebaseinstallations.googleapis.com/v1/projects/ghin-mobile-app/installations',
)

const GOOGLE_API_KEY = 'AIzaSyBxgTOAWxiud0HuaE5tN-5NTlzFnrtyz-I' as const

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36' as const

export const CLIENT_SOURCE = 'GHINcom'

const SESSION_DEFAULTS = {
  appId: '1:884417644529:web:47fb315bc6c70242f72650',
  authVersion: 'FIS_v2',
  fid: 'fg6JfS0U01YmrelthLX9Iz',
  sdkVersion: 'w:0.5.7',
} as const

const FETCH_HEADER_DEFAULTS: RequestInit['headers'] = {
  'Content-Type': 'application/json',
  'User-Agent': DEFAULT_USER_AGENT,
}

const apiPathnames = {
  course_countries: '/get_countries_and_states.json',
  course_details: '/crsCourseMethods.asmx/GetCourseDetails.json',
  course_handicaps: '/playing_handicaps.json',
  course_search: '/crsCourseMethods.asmx/SearchCourses.json',
  facility_search: '/facilities/search.json',
  golfer: '/search_golfer.json',
  golfers_search: '/golfers/search.json',
  golfers_global_search: '/golfers.json',
  login: '/golfer_login.json',
  scores: '/scores.json',
  users_login: '/users/login.json',
} as const

type Entity = Exclude<keyof typeof apiPathnames, 'login' | 'users_login'>

type FetchParameters = {
  entity: Entity
  schema: ZodSchema
  options?: RequestInit & {
    searchParams?: URLSearchParams
  }
}

const toFullApiUrl = (baseUrl: URL, pathname: keyof typeof apiPathnames): URL =>
  new URL(`${baseUrl.pathname}${apiPathnames[pathname]}`, baseUrl)

const makeAuthHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
})

export class RequestClient {
  private accessToken: string | undefined
  private baseUrl: URL
  private config: ClientConfig
  private lock: Mutex
  private sessionToken: AccessToken | undefined

  constructor(config: ClientConfig) {
    const results = schemaClientConfig.safeParse(config)
    if (!results.success) {
      throw new ConfigurationError(`Invalid RequestClientConfig: ${results.error.message}`)
    }

    // default values
    if (results.data.apiAccess === undefined) {
      results.data.apiAccess = false
    }

    if (results.data.apiVersion === undefined) {
      results.data.apiVersion = 'v1'
    }

    if (results.data.baseUrl === undefined) {
      results.data.baseUrl = 'https://api2.ghin.com/api'
    }

    if (!results.data.cache) {
      results.data.cache = new InMemoryCacheClient()
    }

    this.lock = new Mutex()
    this.config = schemaClientConfig.parse(results.data)
    this.baseUrl = new URL(`${this.config.baseUrl}/${this.config.apiVersion}`)
  }

  private async _fetch<T>({
    options,
    schema,
    url,
  }: {
    options: RequestInit
    schema: ZodSchema
    url: URL
  }): Promise<Result<T, Error>> {
    try {
      const response = await fetch(url.toString(), options)

      if (!response.ok || response.status >= 400) {
        let body: unknown
        try {
          body = await response.json()
        } catch {
          body = await response.text()
        }

        // Handle specific error types
        if (response.status === 401 || response.status === 403) {
          return err(
            new AuthenticationError(
              `Authentication failed: ${response.status} ${response.statusText}`,
              response.status,
              new Error(JSON.stringify(body)),
            ),
          )
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : undefined
          return err(
            new RateLimitError(
              `Rate limit exceeded: ${response.status} ${response.statusText}`,
              retryAfterSeconds,
              new Error(JSON.stringify(body)),
            ),
          )
        }

        if (response.status >= 500) {
          return err(
            new NetworkError(
              `Server error: ${response.status} ${response.statusText}`,
              response.status,
              new Error(JSON.stringify(body)),
            ),
          )
        }

        return err(
          new NetworkError(
            `Request failed: ${response.status} ${response.statusText}`,
            response.status,
            new Error(JSON.stringify(body)),
          ),
        )
      }

      const raw = await response.json()
      const parsed = schema.safeParse(raw)

      if (!parsed.success) {
        return err(
          new ValidationError(
            `Response validation failed: ${JSON.stringify(parsed.error)}`,
            undefined,
            new Error(`URL: ${url.toString()}`),
            raw,
          ),
        )
      }

      return ok(parsed.data)
    } catch (error) {
      if (error instanceof Error) {
        return err(new NetworkError(`Network request failed: ${error.message}`, undefined, error))
      }
      return err(new NetworkError(`Unknown network error: ${String(error)}`))
    }
  }

  private async refreshSessionToken(): Promise<Result<AccessToken, Error>> {
    const url = new URL(FIREBASE_SESSION_URL)
    const body = JSON.stringify(SESSION_DEFAULTS)

    const result = await this._fetch<SessionResponse>({
      options: {
        body,
        headers: {
          ...FETCH_HEADER_DEFAULTS,
          'x-goog-api-key': GOOGLE_API_KEY,
        },
        method: 'POST',
      },
      schema: schemaSessionResponse,
      url,
    })

    return result.map((response) => response.authToken)
  }

  private isAccessTokenValid(accessToken?: string): boolean {
    if (!accessToken) {
      return false
    }

    try {
      const decoded = jwtDecode<Pick<JwtPayload, 'exp'>>(accessToken)
      const expirationDate = new Date((decoded.exp as number) * 1_000)
      return expirationDate > new Date()
    } catch {
      return false
    }
  }

  private async getAccessToken(): Promise<Result<string, Error>> {
    const isAccessTokenValid = this.isAccessTokenValid(this.accessToken)

    if (isAccessTokenValid) {
      return ok(this.accessToken as string)
    }

    try {
      const cachedAccessToken = await this.config.cache?.read()
      const isCachedTokenValid = this.isAccessTokenValid(cachedAccessToken)

      if (isCachedTokenValid) {
        this.accessToken = cachedAccessToken
        return ok(cachedAccessToken as string)
      }
    } catch (error) {
      return err(
        new CacheError(
          `Failed to read from cache: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined,
        ),
      )
    }

    const refreshResult = await this.refreshAccessToken()
    if (refreshResult.isErr()) {
      return refreshResult
    }

    const accessToken = refreshResult.value
    this.accessToken = accessToken

    try {
      await this.config.cache?.write(accessToken)
    } catch (error) {
      return err(
        new CacheError(
          `Failed to write to cache: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined,
        ),
      )
    }

    return ok(accessToken)
  }

  private async apiLogin(): Promise<Result<string, Error>> {
    const url = toFullApiUrl(this.baseUrl, 'users_login')
    const body = JSON.stringify({
      user: {
        email: this.config.username,
        password: this.config.password,
        remember_me: true,
      },
    })

    const response = await this._fetch<LoginResponse>({
      options: {
        body,
        headers: FETCH_HEADER_DEFAULTS,
        method: 'POST',
      },
      schema: schemaLoginAPIResponse,
      url,
    })

    return response.andThen((resp) => {
      if (resp && 'token' in resp) {
        return ok(resp.token)
      }
      return err(new Error('Login response did not contain a token.'))
    })
  }

  private async refreshAccessToken(): Promise<Result<string, Error>> {
    if (this.config.apiAccess) {
      return this.apiLogin()
    }

    const sessionResult = await this.refreshSessionToken()
    if (sessionResult.isErr()) {
      return err(sessionResult.error)
    }

    this.sessionToken = sessionResult.value

    const url = toFullApiUrl(this.baseUrl, 'login')
    const body = JSON.stringify({
      token: this.sessionToken.token,
      user: {
        email_or_ghin: this.config.username,
        password: this.config.password,
      },
    })

    const response = await this._fetch<LoginResponse>({
      options: {
        body,
        headers: FETCH_HEADER_DEFAULTS,
        method: 'POST',
      },
      schema: schemaLoginResponse,
      url,
    })

    return response.map((resp) => {
      if ('golfer_user' in resp) {
        return resp.golfer_user.golfer_user_token
      }

      return resp.token
    })
  }

  async fetch<RequestReturnType>({
    entity,
    schema,
    options = {},
  }: FetchParameters): Promise<Result<RequestReturnType, Error>> {
    const accessTokenResult = await this.lock.runExclusive(async () => this.getAccessToken())
    if (accessTokenResult.isErr()) {
      return err(accessTokenResult.error)
    }

    const accessToken = accessTokenResult.value
    const url = toFullApiUrl(this.baseUrl, entity)
    const { headers, searchParams, ...requestInitOptions } = options

    const actualOptions = {
      ...requestInitOptions,
      headers: {
        ...FETCH_HEADER_DEFAULTS,
        source: CLIENT_SOURCE,
        ...makeAuthHeaders(accessToken),
        ...headers,
      },
    }

    if (searchParams) {
      url.search = searchParams.toString()
    }

    return withRetry(() => this._fetch<RequestReturnType>({ options: actualOptions, schema, url }))
  }

  async fetchCustomPath<RequestReturnType>({
    path,
    schema,
    options = {},
  }: {
    path: string
    schema: ZodSchema
    options?: RequestInit & {
      searchParams?: URLSearchParams
    }
  }): Promise<Result<RequestReturnType, Error>> {
    const accessTokenResult = await this.lock.runExclusive(async () => this.getAccessToken())
    if (accessTokenResult.isErr()) {
      return err(accessTokenResult.error)
    }

    const accessToken = accessTokenResult.value
    const url = new URL(`${this.baseUrl.pathname}${path}`, this.baseUrl)
    const { headers, searchParams, ...requestInitOptions } = options

    const actualOptions = {
      ...requestInitOptions,
      headers: {
        ...FETCH_HEADER_DEFAULTS,
        source: CLIENT_SOURCE,
        ...makeAuthHeaders(accessToken),
        ...headers,
      },
    }

    if (searchParams) {
      url.search = searchParams.toString()
    }

    return withRetry(() => this._fetch<RequestReturnType>({ options: actualOptions, schema, url }))
  }
}
