import { err, ok } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkError, ValidationError } from '../../errors'
import { InMemoryCacheClient } from '../in-memory-cache-client'
import { RequestClient } from '../request-client'
import { GhinClient } from './index'
import {
  getAccessesResponseFixture,
  requestAccessResponseFixture,
  revokeAccessResponseFixture,
  updateStatusResponseFixture,
} from './models/gpa/__fixtures__'
import { schemaUserAccessesResponse } from './models/gpa/access'

// Mock the RequestClient
const mockFetch = vi.fn()
const mockFetchCustomPath = vi.fn()
vi.mock('../request-client', () => ({
  RequestClient: vi.fn().mockImplementation(() => ({
    fetch: mockFetch,
    fetchCustomPath: mockFetchCustomPath,
  })),
  CLIENT_SOURCE: 'GHINcom',
}))

describe('GhinClient', () => {
  let ghinClient: GhinClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockFetchCustomPath.mockReset()

    ghinClient = new GhinClient({
      username: 'testuser',
      password: 'testpass',
      cache: new InMemoryCacheClient(),
    })
  })

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(ghinClient).toBeInstanceOf(GhinClient)
      expect(ghinClient.courses).toBeDefined()
      expect(ghinClient.golfers).toBeDefined()
      expect(ghinClient.handicaps).toBeDefined()
      expect(ghinClient.facilities).toBeDefined()
      expect(ghinClient.gpa).toBeDefined()
      expect(ghinClient.scores).toBeDefined()
      expect(ghinClient.webhooks).toBeDefined()
    })

    // Deliberate carve-out (#42, Decision 4): every *method* on GhinClient
    // returns a Result, but the constructor keeps throwing. A bad config is a
    // boot-time programmer error, not a runtime API failure. Do not "fix".
    it('should throw error with invalid config', () => {
      expect(() => {
        new GhinClient({
          username: '',
          password: 'testpass',
        } as unknown as { username: string; password: string })
      }).toThrow('Invalid GhinClientConfig')
    })

    it('should use default cache when not provided', () => {
      const client = new GhinClient({
        username: 'testuser',
        password: 'testpass',
      })
      expect(client).toBeInstanceOf(GhinClient)
    })

    // GhinClient is the public entry point, so this hop is the path every real
    // consumer's cache takes. Issue #79: the safeParse at construction used to
    // rebuild the config and detach a class-based cache from its instance.
    it('should hand a user-supplied cache to RequestClient by reference (#79)', () => {
      // State lives on `this` — the shape #79 broke via unbound Zod wrappers.
      class StatefulCache {
        private store: string | undefined

        async read(): Promise<string | undefined> {
          return this.store
        }

        async write(value: string): Promise<void> {
          this.store = value
        }
      }
      const cache = new StatefulCache()

      new GhinClient({ username: 'testuser', password: 'testpass', cache })

      const capturedConfig = vi.mocked(RequestClient).mock.calls.at(-1)?.[0]
      // The instance itself, not a validated clone — `toBe`, never `toEqual`.
      expect(capturedConfig?.cache).toBe(cache)
    })
  })

  describe('courses.getCountries', () => {
    it('should fetch and return countries', async () => {
      const mockCountries = {
        countries: [
          { code: 'USA', name: 'United States' },
          { code: 'CAN', name: 'Canada' },
        ],
      }
      mockFetch.mockResolvedValue(ok(mockCountries))

      const result = await ghinClient.courses.getCountries()

      expect(result._unsafeUnwrap()).toEqual(mockCountries.countries)
      expect(mockFetch).toHaveBeenCalledWith({
        entity: 'course_countries',
        options: expect.objectContaining({
          searchParams: expect.any(URLSearchParams),
        }),
        schema: expect.anything(),
      })
    })

    // Nothing on this surface rejects any more: the promise resolves to an Err.
    // Asserting only `isErr()` would still pass if a throw crept back in.
    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Network error')
      mockFetch.mockResolvedValue(err(failure))

      await expect(ghinClient.courses.getCountries()).resolves.toBeDefined()

      const result = await ghinClient.courses.getCountries()

      expect(result.isErr()).toBe(true)
      // The instance, not a copy — statusCode/retryAfter/field are the point.
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Network error')
    })
  })

  describe('courses.getDetails', () => {
    it('should fetch and return course details', async () => {
      // Mirrors what schemaCourseDetailsResponse actually produces: the client
      // reads TeeSets/invalidTeeSets to report degradation.
      const mockDetails = {
        course_id: 12345,
        name: 'Test Course',
        city: 'Test City',
        TeeSets: [],
        invalidTeeSets: [],
      }
      mockFetch.mockResolvedValue(ok(mockDetails))

      const result = await ghinClient.courses.getDetails({ course_id: 12345 })

      expect(result._unsafeUnwrap()).toEqual(mockDetails)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should skip a present-but-undefined parameter rather than throw', async () => {
      mockFetch.mockResolvedValue(ok({ course_id: 12345, name: 'Test Course', TeeSets: [], invalidTeeSets: [] }))

      const result = await ghinClient.courses.getDetails({ course_id: 12345, gender: undefined })

      expect(result.isOk()).toBe(true)
      expect(mockFetch.mock.calls[0]?.[0].options.searchParams.has('gender')).toBe(false)
    })

    it('should return a validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.courses.getDetails({ course_id: 'invalid' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('should return an error result when fetch fails', async () => {
      const failure = new NetworkError('Not found', 404)
      mockFetch.mockResolvedValue(err(failure))

      const result = await ghinClient.courses.getDetails({ course_id: 12345 })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Not found')
    })
  })

  describe('courses.search', () => {
    it('should search and return courses', async () => {
      const mockResponse = {
        courses: [
          { course_id: 1, name: 'Course 1' },
          { course_id: 2, name: 'Course 2' },
        ],
        invalid: [],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.courses.search({ name: 'Test' })

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalled()
    })

    // Representative of the same one-line hole in `courses.getDetails`,
    // `facilities.search` and `handicaps.getCourseHandicaps`: their loops called
    // `value.toString()` unguarded, and zod `.partial()`/`.optional()` keeps a
    // present-but-`undefined` key, so a caller spreading an optional field in got
    // a `TypeError` wrapped as an `Err`. All five now mirror `webhooksList` (#83).
    it('should skip a present-but-undefined parameter rather than throw', async () => {
      const mockResponse = { courses: [], invalid: [] }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.courses.search({ name: 'Test', facility_id: undefined })

      expect(result.isOk()).toBe(true)
      expect(mockFetch.mock.calls[0]?.[0].options.searchParams.has('facility_id')).toBe(false)
    })

    // Degradation must never be silent: a search that quietly returns 2 of 3
    // rows is indistinguishable from a search that found 2 rows, which is
    // exactly how a GHIN payload change hides until a user reports it.
    it('should report dropped rows through onDegraded', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      const rejected = { course_id: 3, busted: true }
      mockFetch.mockResolvedValue(ok({ courses: [{ course_id: 1, name: 'Course 1' }], invalid: [rejected] }))

      await client.courses.search({ name: 'Test' })

      expect(onDegraded).toHaveBeenCalledWith({
        entity: 'course_search',
        dropped: 1,
        total: 2,
        sample: [rejected],
      })
    })

    it('should not call onDegraded when nothing was dropped', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      mockFetch.mockResolvedValue(ok({ courses: [{ course_id: 1 }], invalid: [] }))

      await client.courses.search({ name: 'Test' })

      expect(onDegraded).not.toHaveBeenCalled()
    })

    // Telemetry is a side channel — a caller's broken reporter must not turn a
    // working GHIN response into a failed request.
    it('should survive an onDegraded callback that throws', async () => {
      const client = new GhinClient({
        password: 'p',
        username: 'u',
        onDegraded: () => {
          throw new Error('reporter exploded')
        },
      })
      mockFetch.mockResolvedValue(ok({ courses: [{ course_id: 1 }], invalid: [{ bad: true }] }))

      const result = await client.courses.search({ name: 'Test' })

      expect(result.isOk()).toBe(true)
    })

    it('should return an error result when fetch fails', async () => {
      const failure = new NetworkError('Search failed')
      mockFetch.mockResolvedValue(err(failure))

      const result = await ghinClient.courses.search({ name: 'Test' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Search failed')
    })
  })

  describe('courses.getTeeSetRatingsForScorePosting', () => {
    it('should fetch and return tee set ratings for score posting', async () => {
      // What the schema hands back: GHIN sends a bare array of PascalCase rows
      // (see `models/course/__fixtures__`), and the response schema partitions it
      // into `tee_set_ratings` / `invalid`.
      const mockResponse = {
        tee_set_ratings: [
          {
            TeeSetRatingId: 605066,
            TeeSetStatus: 'Active',
            DisplayName: 'Red',
            Gender: 'Male',
            TeeSetRatingName: 'Red',
            RatingType: 'Total',
            CourseRating: 67.3,
            SlopeRating: 124,
            BogeyRating: 90.3,
            TotalPar: 71,
          },
        ],
        invalid: [],
      }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.courses.getTeeSetRatingsForScorePosting({ course_id: 2539 })

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/Courses/2539/TeeSetRatingsForScorePosting.json',
        options: expect.objectContaining({
          searchParams: expect.any(URLSearchParams),
        }),
        schema: expect.anything(),
      })
    })

    // A course that quietly returns 44 of its 45 rating rows is indistinguishable
    // from a course with 44 — exactly how the #73-class payload change hides.
    it('should report dropped rows through onDegraded', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      const rejected = { TeeSetRatingId: 605067, CourseRating: null }
      mockFetchCustomPath.mockResolvedValue(
        ok({ tee_set_ratings: [{ TeeSetRatingId: 605066, RatingType: 'Total' }], invalid: [rejected] }),
      )

      await client.courses.getTeeSetRatingsForScorePosting({ course_id: 7817 })

      expect(onDegraded).toHaveBeenCalledWith({
        entity: 'tee_set_ratings_for_score_posting',
        dropped: 1,
        total: 2,
        sample: [rejected],
      })
    })

    it('should not call onDegraded when nothing was dropped', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      mockFetchCustomPath.mockResolvedValue(ok({ tee_set_ratings: [{ TeeSetRatingId: 605066 }], invalid: [] }))

      await client.courses.getTeeSetRatingsForScorePosting({ course_id: 7817 })

      expect(onDegraded).not.toHaveBeenCalled()
    })

    it('should survive an onDegraded callback that throws', async () => {
      const client = new GhinClient({
        password: 'p',
        username: 'u',
        onDegraded: () => {
          throw new Error('reporter exploded')
        },
      })
      mockFetchCustomPath.mockResolvedValue(
        ok({ tee_set_ratings: [{ TeeSetRatingId: 605066 }], invalid: [{ bad: true }] }),
      )

      const result = await client.courses.getTeeSetRatingsForScorePosting({ course_id: 7817 })

      expect(result.isOk()).toBe(true)
    })

    it('should return an error result when fetch fails', async () => {
      const failure = new NetworkError('Not found', 404)
      mockFetchCustomPath.mockResolvedValue(err(failure))

      const result = await ghinClient.courses.getTeeSetRatingsForScorePosting({ course_id: 2539 })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Not found')
    })

    it('should return a validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.courses.getTeeSetRatingsForScorePosting({ course_id: 'invalid' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      const result = await ghinClient.courses.getTeeSetRatingsForScorePosting({ course_id: 2539 })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().message).toBe('string error')
    })
  })

  describe('facilities.search', () => {
    it('should search and return facilities', async () => {
      const mockResponse = {
        facilities: [{ facility_id: 1, name: 'Facility 1' }],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.facilities.search({
        name: 'Test',
      })

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should skip a present-but-undefined parameter rather than throw', async () => {
      mockFetch.mockResolvedValue(ok({ facilities: [] }))

      const result = await ghinClient.facilities.search({ name: 'Test', state: undefined })

      expect(result.isOk()).toBe(true)
      expect(mockFetch.mock.calls[0]?.[0].options.searchParams.has('state')).toBe(false)
    })

    // Nothing on this surface rejects any more: the promise resolves to an Err.
    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Search failed')
      mockFetch.mockResolvedValue(err(failure))

      await expect(ghinClient.facilities.search({ name: 'Test' })).resolves.toBeDefined()

      const result = await ghinClient.facilities.search({ name: 'Test' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Search failed')
    })
  })

  describe('gpa.getAccesses', () => {
    it('should fetch and flatten the golfers branch of the UserAccesses response', async () => {
      // RequestClient parses through the schema before resolving the Result,
      // so the wrapper sees coerced numeric IDs. Mirror that here.
      mockFetch.mockResolvedValue(ok(schemaUserAccessesResponse.parse(getAccessesResponseFixture)))

      const result = await ghinClient.gpa.getAccesses()

      expect(result._unsafeUnwrap()).toEqual([
        {
          golferId: 13373246,
          userAccessId: 6863457,
          golferName: 'Test Golfer1019',
          gpaStatus: 'pending',
        },
      ])
      expect(mockFetch).toHaveBeenCalledWith({
        entity: 'gpa_accesses',
        schema: expect.anything(),
      })
    })

    it('should return an empty array when the response has no golfers', async () => {
      mockFetch.mockResolvedValue(
        ok(
          schemaUserAccessesResponse.parse({
            federations: [],
            associations: [],
            clubs: [],
            golfers: [],
            super_user: 'false',
            subtype: null,
          }),
        ),
      )

      const result = await ghinClient.gpa.getAccesses()

      expect(result._unsafeUnwrap()).toEqual([])
    })

    // Nothing on this surface rejects any more: the promise resolves to an Err.
    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Unauthorized')
      mockFetch.mockResolvedValue(err(failure))

      await expect(ghinClient.gpa.getAccesses()).resolves.toBeDefined()

      const result = await ghinClient.gpa.getAccesses()

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Unauthorized')
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      const result = await ghinClient.gpa.getAccesses()

      expect(result._unsafeUnwrapErr().message).toBe('string error')
    })
  })

  describe('gpa.requestAccess', () => {
    it('should POST email body and return the success envelope', async () => {
      mockFetchCustomPath.mockResolvedValue(ok(requestAccessResponseFixture))

      const result = await ghinClient.gpa.requestAccess(123, { email: 'golfer@example.com' })

      expect(result._unsafeUnwrap()).toEqual(requestAccessResponseFixture)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/users/golfers/123/request_golfer_product_access.json',
        schema: expect.anything(),
        options: {
          method: 'POST',
          body: JSON.stringify({ email: 'golfer@example.com' }),
        },
      })
    })

    it('should return validation error with invalid golfer ID', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.gpa.requestAccess('invalid', { email: 'a@b.com' })

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(result._unsafeUnwrapErr().message).toContain('Invalid GPA request access request:')
    })

    it('should return validation error when email is missing', async () => {
      // @ts-expect-error - Testing missing required input
      const result = await ghinClient.gpa.requestAccess(123, {})

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(result._unsafeUnwrapErr().message).toContain('Invalid GPA request access request:')
    })

    it('should return validation error when email is empty', async () => {
      const result = await ghinClient.gpa.requestAccess(123, { email: '' })

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Request failed')
      mockFetchCustomPath.mockResolvedValue(err(failure))

      await expect(ghinClient.gpa.requestAccess(123, { email: 'a@b.com' })).resolves.toBeDefined()

      const result = await ghinClient.gpa.requestAccess(123, { email: 'a@b.com' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Request failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      const result = await ghinClient.gpa.requestAccess(123, { email: 'a@b.com' })

      expect(result._unsafeUnwrapErr().message).toBe('string error')
    })
  })

  describe('gpa.updateStatus', () => {
    it('should POST gpa_status and return the success envelope', async () => {
      mockFetchCustomPath.mockResolvedValue(ok(updateStatusResponseFixture))

      const result = await ghinClient.gpa.updateStatus({
        user_id: 4695277,
        golfer_id: 13373246,
        status: 'approved',
      })

      expect(result._unsafeUnwrap()).toEqual(updateStatusResponseFixture)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/users/4695277/golfers/13373246/update_golfer_product_access_status.json',
        schema: expect.anything(),
        options: {
          method: 'POST',
          body: JSON.stringify({ gpa_status: 'approved' }),
        },
      })
    })

    it('should return validation error with invalid status', async () => {
      const result = await ghinClient.gpa.updateStatus({
        user_id: 1,
        golfer_id: 123,
        // @ts-expect-error - Testing invalid input type
        status: 'invalid',
      })

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(result._unsafeUnwrapErr().message).toContain('Invalid GPA update status request:')
    })

    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Update failed')
      mockFetchCustomPath.mockResolvedValue(err(failure))

      const result = await ghinClient.gpa.updateStatus({ user_id: 1, golfer_id: 123, status: 'approved' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Update failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      const result = await ghinClient.gpa.updateStatus({ user_id: 1, golfer_id: 123, status: 'approved' })

      expect(result._unsafeUnwrapErr().message).toBe('string error')
    })
  })

  describe('gpa.revokeAccess', () => {
    it('should DELETE and return the success envelope', async () => {
      mockFetchCustomPath.mockResolvedValue(ok(revokeAccessResponseFixture))

      const result = await ghinClient.gpa.revokeAccess(123)

      expect(result._unsafeUnwrap()).toEqual(revokeAccessResponseFixture)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/users/golfers/123/revoke_golfer_product_access.json',
        schema: expect.anything(),
        options: { method: 'DELETE' },
      })
    })

    it('should return validation error with invalid golfer ID', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.gpa.revokeAccess('invalid')

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(result._unsafeUnwrapErr().message).toContain('Invalid golfer ID:')
    })

    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Revoke failed')
      mockFetchCustomPath.mockResolvedValue(err(failure))

      const result = await ghinClient.gpa.revokeAccess(123)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Revoke failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      const result = await ghinClient.gpa.revokeAccess(123)

      expect(result._unsafeUnwrapErr().message).toBe('string error')
    })
  })

  describe('handicaps.getOne', () => {
    // #68: this used to hit `/search_golfer.json`, which 404s on UAT for every
    // golfer. It is now backed by `/golfers/search.json`, so the assertion that
    // matters is which entity the request client is asked for.
    it('should fetch the golfer record from golfers/search and return it', async () => {
      // `mockFetch` stands in for the request client, so it returns already-*parsed* data and
      // `schemaGolfer` never runs here. `handicap_index` is therefore the number the schema
      // emits (`handicap.nullish()`), not the `"12.5"` string GHIN puts on the wire — the
      // display twin `hi_display` is the string.
      const mockResponse = {
        golfers: [
          {
            ghin: 1234567,
            last_name: 'Doe',
            handicap_index: 12.5,
            hi_display: '12.5',
            status: 'Active',
          },
        ],
        invalid: [],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.handicaps.getOne(1234567)

      expect(result._unsafeUnwrap()).toEqual(mockResponse.golfers[0])
      expect(result._unsafeUnwrap()?.handicap_index).toBe(12.5)
      expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ entity: 'golfers_search' }))
    })

    // `handicaps.getOne` delegates to `golfers.getOne`, so it inherits #83's
    // fix: an inactive member has a real, readable Handicap Index and this used
    // to answer `undefined` for them. That was the bug that let spicy fall back
    // to a four-year-old cached index (spicygolf/spicy#1153).
    it('should return the handicap of an inactive golfer', async () => {
      const golfer = { ghin: 2890015, last_name: 'Doe', handicap_index: 8.1, hi_display: '8.1', status: 'Inactive' }
      mockFetch.mockResolvedValue(ok({ golfers: [golfer], invalid: [] }))

      const result = await ghinClient.handicaps.getOne(2890015)

      expect(result._unsafeUnwrap()).toEqual(golfer)
      expect(result._unsafeUnwrap()?.status).toBe('Inactive')
      expect(mockFetch.mock.calls[0]?.[0].options.searchParams.has('status')).toBe(false)
    })

    // "No such golfer" is a normal answer, not a failure: this stays
    // `Ok(undefined)` so callers don't have to distinguish an empty search from
    // a transport error by inspecting the error type.
    it('should return an ok result holding undefined when no golfer matches', async () => {
      mockFetch.mockResolvedValue(ok({ golfers: [], invalid: [] }))

      const result = await ghinClient.handicaps.getOne(1234567)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBeUndefined()
    })

    it('should return a validation error with invalid ghin', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.handicaps.getOne('invalid')

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    // Nothing on this surface rejects any more: the promise resolves to an Err.
    // Asserting only `isErr()` would still pass if a throw crept back in.
    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Not found', 404)
      mockFetch.mockResolvedValue(err(failure))

      await expect(ghinClient.handicaps.getOne(1234567)).resolves.toBeDefined()

      const result = await ghinClient.handicaps.getOne(1234567)

      expect(result.isErr()).toBe(true)
      // The instance, not a copy — statusCode/retryAfter/field are the point.
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Not found')
    })
  })

  describe('handicaps.getCoursePlayerHandicaps', () => {
    const request = [{ ghin: 1234567, tee_set_id: 12345, tee_set_side: 'All 18' }] as const
    // `POST /playing_handicaps.json` answers with one bucket per allowance
    // percentage, each keyed by `golfer_id`. Trimmed to two buckets here; the
    // shape is `schemaCoursePlayerHandicapsResponse`'s output, since `fetch` is
    // mocked and the schema never runs.
    const bucket = { '1234567': { playing_handicap: 15, playing_handicap_display: '15', shots_off: 15 } }

    it('should fetch and return course player handicaps', async () => {
      const mockResponse = { 100: bucket, 5: bucket, invalid: [] }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.handicaps.getCoursePlayerHandicaps([...request])

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalled()
    })

    // Degradation must never be silent: a foursome that quietly comes back with
    // three golfers is indistinguishable from a threesome, which is exactly how
    // this endpoint's NH-golfer bug hid until it was reproduced against staging.
    it('should report dropped rows through onDegraded', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      const rejected = { golfer_id: '7654321', row: { playing_handicap: null, shots_off: 'N/A' } }
      mockFetch.mockResolvedValue(ok({ 100: bucket, 5: bucket, invalid: [rejected] }))

      await client.handicaps.getCoursePlayerHandicaps([...request])

      // One golfer parsed across both buckets and one was dropped — two golfers
      // in the payload, not four, because the buckets echo the same golfer set.
      expect(onDegraded).toHaveBeenCalledWith({
        entity: 'course_handicaps',
        dropped: 1,
        total: 2,
        sample: [rejected],
      })
    })

    it('should not call onDegraded when nothing was dropped', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      mockFetch.mockResolvedValue(ok({ 100: bucket, 5: bucket, invalid: [] }))

      await client.handicaps.getCoursePlayerHandicaps([...request])

      expect(onDegraded).not.toHaveBeenCalled()
    })

    it('should survive an onDegraded callback that throws', async () => {
      const client = new GhinClient({
        password: 'p',
        username: 'u',
        onDegraded: () => {
          throw new Error('reporter exploded')
        },
      })
      mockFetch.mockResolvedValue(ok({ 100: bucket, 5: bucket, invalid: [{ golfer_id: '7654321', row: {} }] }))

      const result = await client.handicaps.getCoursePlayerHandicaps([...request])

      expect(result.isOk()).toBe(true)
    })

    it('should return an error result when fetch fails', async () => {
      const failure = new NetworkError('Calculation failed')
      mockFetch.mockResolvedValue(err(failure))

      const result = await ghinClient.handicaps.getCoursePlayerHandicaps([
        { ghin: 1234567, tee_set_id: 12345, tee_set_side: 'All 18' },
      ])

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Calculation failed')
    })
  })

  describe('handicaps.getCourseHandicaps', () => {
    // `GET /course_handicaps.json` answers with `tee_sets`, each rating carrying
    // the Course Handicap. It has never returned a `course_handicaps` array.
    const validRequest = {
      golfer_id: 123,
      course_id: 2539,
      tee_set_id: 262908,
      tee_set_side: 'All 18',
      played_at: '2026-03-17',
      gender: 'M',
    } as const

    const teeSet = {
      tee_set_id: 161278,
      name: 'Black Tees',
      gender: 'M',
      holes_number: 18,
      holes: [{ Number: 1, HoleId: 322337, Length: 528, Par: 5, Allocation: 15 }],
      is_shorter: null,
      eligible_sides: null,
      ratings: [
        {
          tee_set_side: 'All 18',
          course_rating: 73.2,
          slope_rating: 132,
          par: 72,
          course_handicap: 11,
          course_handicap_display: '11',
        },
      ],
    }

    it('should fetch and return course handicaps', async () => {
      const mockResponse = { tee_sets: [teeSet], invalid: [] }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.handicaps.getCourseHandicaps(validRequest)

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith({
        entity: 'course_handicaps_get',
        options: expect.objectContaining({
          searchParams: expect.any(URLSearchParams),
        }),
        schema: expect.anything(),
      })
    })

    // Degradation must never be silent: a course that quietly comes back with 14
    // of its 15 tee sets is indistinguishable from a course with 14 tees, which
    // is exactly how a GHIN payload change hides until a user reports it.
    it('should report dropped rows through onDegraded', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      const rejected = { tee_set_id: 999, name: 'No Ratings' }
      mockFetch.mockResolvedValue(ok({ tee_sets: [teeSet], invalid: [rejected] }))

      await client.handicaps.getCourseHandicaps(validRequest)

      expect(onDegraded).toHaveBeenCalledWith({
        entity: 'course_handicaps_get',
        dropped: 1,
        total: 2,
        sample: [rejected],
      })
    })

    it('should not call onDegraded when nothing was dropped', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      mockFetch.mockResolvedValue(ok({ tee_sets: [teeSet], invalid: [] }))

      await client.handicaps.getCourseHandicaps(validRequest)

      expect(onDegraded).not.toHaveBeenCalled()
    })

    it('should survive an onDegraded callback that throws', async () => {
      const client = new GhinClient({
        password: 'p',
        username: 'u',
        onDegraded: () => {
          throw new Error('reporter exploded')
        },
      })
      mockFetch.mockResolvedValue(ok({ tee_sets: [teeSet], invalid: [{ bad: true }] }))

      const result = await client.handicaps.getCourseHandicaps(validRequest)

      expect(result.isOk()).toBe(true)
    })

    // Nothing on this surface rejects any more: the promise resolves to an Err.
    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Failed')
      mockFetch.mockResolvedValue(err(failure))

      await expect(ghinClient.handicaps.getCourseHandicaps(validRequest)).resolves.toBeDefined()

      const result = await ghinClient.handicaps.getCourseHandicaps(validRequest)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Failed')
    })

    // GHIN rejects the spaceless `'All18'` outright:
    // `{"errors":{"tee_set_side":["must be one of the following: 'All 18', 'F9', 'B9'"]}}`.
    it('should return a validation error for the spaceless All18 tee_set_side', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.handicaps.getCourseHandicaps({ ...validRequest, tee_set_side: 'All18' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('should return a validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.handicaps.getCourseHandicaps({ ...validRequest, tee_set_side: 'invalid' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      const result = await ghinClient.handicaps.getCourseHandicaps(validRequest)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().message).toBe('string error')
    })
  })

  describe('golfers.search', () => {
    it('should search and return golfers', async () => {
      const mockResponse = {
        golfers: [{ ghin: 1234567, first_name: 'John', last_name: 'Doe' }],
        invalid: [],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.golfers.search({ last_name: 'Doe' })

      expect(result._unsafeUnwrap()).toEqual(mockResponse.golfers)
      expect(mockFetch).toHaveBeenCalled()
    })

    // Nothing on this surface rejects any more: the promise resolves to an Err.
    // Asserting only `isErr()` would still pass if a throw crept back in.
    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Search failed')
      mockFetch.mockResolvedValue(err(failure))

      await expect(ghinClient.golfers.search({ last_name: 'Doe' })).resolves.toBeDefined()

      const result = await ghinClient.golfers.search({ last_name: 'Doe' })

      expect(result.isErr()).toBe(true)
      // The instance, not a copy — statusCode/retryAfter/field are the point.
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Search failed')
    })

    // Three states, not two. `status=All` returns zero rows and omitting the
    // parameter returns both statuses (api-uat, 2026-09-02, golfer 2890015), so
    // `null` is encoded as a *missing* key — asserting `has()` rather than
    // `get()` is deliberate: `status=` would also read as `null` from `get()`.
    describe('status filter', () => {
      const searchParamsOfCall = (call: number): URLSearchParams => mockFetch.mock.calls[call]?.[0].options.searchParams

      beforeEach(() => {
        mockFetch.mockResolvedValue(ok({ golfers: [], invalid: [] }))
      })

      it('should omit status entirely when it is null', async () => {
        await ghinClient.golfers.search({ last_name: 'Doe', status: null })

        expect(searchParamsOfCall(0).has('status')).toBe(false)
      })

      it('should still default to Active when status is not given', async () => {
        await ghinClient.golfers.search({ last_name: 'Doe' })

        expect(searchParamsOfCall(0).get('status')).toBe('Active')
      })

      // `undefined` inherits the default, `null` clears it — zod `.partial()`
      // keeps a present-but-undefined key, so this path is reachable and would
      // otherwise be a footgun for anyone spreading an optional field in.
      it('should fall back to Active when status is undefined', async () => {
        await ghinClient.golfers.search({ last_name: 'Doe', status: undefined })

        expect(searchParamsOfCall(0).get('status')).toBe('Active')
      })
    })

    // #83: zod `.partial()` keeps a present-but-`undefined` key, so a caller
    // spreading an optional field in — `{ last_name, page: body.page }` — used
    // to put `page=` on the wire, and GHIN answers that with
    // `400 {"errors":{"page":["can't be blank"]}}`.
    describe('undefined parameters', () => {
      const searchParamsOfCall = (call: number): URLSearchParams => mockFetch.mock.calls[call]?.[0].options.searchParams
      const emptyValuedKeys = (params: URLSearchParams): string[] =>
        [...params].filter(([, value]) => value === '').map(([key]) => key)

      beforeEach(() => {
        mockFetch.mockResolvedValue(ok({ golfers: [], invalid: [] }))
      })

      it('should fall back to the default page when page is undefined', async () => {
        await ghinClient.golfers.search({ last_name: 'Doe', page: undefined })

        expect(searchParamsOfCall(0).get('page')).toBe('1')
        expect(emptyValuedKeys(searchParamsOfCall(0))).toEqual([])
      })

      it('should still send an explicit page', async () => {
        await ghinClient.golfers.search({ last_name: 'Doe', page: 3 })

        expect(searchParamsOfCall(0).get('page')).toBe('3')
      })

      // Scope pin: this phase changed `undefined` only. `first_name: ''` runs
      // through `emptyStringToNull`, and a `null` non-`status` parameter still
      // reaches the wire as `key=` exactly as it always has.
      it('should still send an empty value for a null parameter', async () => {
        await ghinClient.golfers.search({ last_name: 'Doe', first_name: '' })

        expect(searchParamsOfCall(0).get('first_name')).toBe('')
        expect(emptyValuedKeys(searchParamsOfCall(0))).toEqual(['first_name'])
      })
    })
  })

  describe('golfers.globalSearch', () => {
    it('should search globally and return golfers', async () => {
      const mockResponse = {
        golfers: [
          {
            ghin: 1234567,
            first_name: 'John',
            last_name: 'Doe',
            status: 'Active',
          },
        ],
        invalid: [],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.golfers.globalSearch({ ghin: 1234567 })

      expect(result._unsafeUnwrap()).toEqual(mockResponse.golfers)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should return an error result when fetch fails', async () => {
      const failure = new NetworkError('Search failed')
      mockFetch.mockResolvedValue(err(failure))

      const result = await ghinClient.golfers.globalSearch({ ghin: 1234567 })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Search failed')
    })

    // Same `400 {"errors":{"page":["can't be blank"]}}` hazard as
    // `golfers.search`: a present-but-`undefined` key must inherit the default
    // rather than overwrite it with an empty string.
    describe('undefined parameters', () => {
      const searchParamsOfCall = (call: number): URLSearchParams => mockFetch.mock.calls[call]?.[0].options.searchParams

      beforeEach(() => {
        mockFetch.mockResolvedValue(ok({ golfers: [], invalid: [] }))
      })

      it('should fall back to the default page when page is undefined', async () => {
        await ghinClient.golfers.globalSearch({ ghin: 1234567, page: undefined })

        expect(searchParamsOfCall(0).get('page')).toBe('1')
        expect([...searchParamsOfCall(0)].filter(([, value]) => value === '')).toEqual([])
      })

      it('should still send an explicit page', async () => {
        await ghinClient.golfers.globalSearch({ ghin: 1234567, page: 3 })

        expect(searchParamsOfCall(0).get('page')).toBe('3')
      })
    })
  })

  describe('golfers.getOne', () => {
    it('should fetch and return one golfer', async () => {
      const mockResponse = {
        golfers: [
          {
            ghin: 1234567,
            first_name: 'John',
            last_name: 'Doe',
            status: 'Active',
          },
        ],
        invalid: [],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.golfers.getOne(1234567)

      expect(result._unsafeUnwrap()).toEqual(mockResponse.golfers[0])
      expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ entity: 'golfers_search' }))
    })

    // "No golfer matched" is an ordinary answer, so it stays on the ok track:
    // `Ok(undefined)`, never `Err`. The one place a reader might reasonably
    // expect an error, so it is asserted explicitly. #83 removed the status
    // filter as one reason for this `undefined`; the schema-drop below is the
    // one that remains.
    it('should return an ok result holding undefined when no golfer found', async () => {
      const mockResponse = {
        golfers: [],
        invalid: [],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.golfers.getOne(1234567)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBeUndefined()
    })

    // `undefined` is not proof of "no such GHIN number". If every row a golfer
    // has fails `schemaGolfer` it is partitioned into `invalid` and this resolves
    // the identical `undefined` — the `Archived` status found in #83 was one such
    // value, and `gender: z.enum(['M','F'])` is the same trap still live. Only
    // `onDegraded` separates the two, and it is undefined unless the consumer
    // wires it up, so the ambiguity is pinned here rather than left to a reader.
    it('should return an ok result holding undefined when the only row failed the schema', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      const rejected = { ghin: 1234567, last_name: 'Doe', status: 'Something GHIN added' }
      mockFetch.mockResolvedValue(ok({ golfers: [], invalid: [rejected] }))

      const result = await client.golfers.getOne(1234567)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBeUndefined()
      expect(onDegraded).toHaveBeenCalledWith({ entity: 'golfers_search', dropped: 1, total: 1, sample: [rejected] })
    })

    // The old `per_page: 1` returned whichever affiliation row GHIN sorted first,
    // so `club_name` was a coin flip for a multi-club golfer — the field that
    // tells two golfers with the same name apart.
    it('should return the home club row for a multi-club golfer', async () => {
      mockFetch.mockResolvedValue(
        ok({
          golfers: [
            { ghin: 1234567, last_name: 'Doe', club_name: 'Away Club', is_home_club: false },
            { ghin: 1234567, last_name: 'Doe', club_name: 'Home Club', is_home_club: true },
          ],
          invalid: [],
        }),
      )

      const result = await ghinClient.golfers.getOne(1234567)

      expect(result._unsafeUnwrap()?.club_name).toBe('Home Club')
    })

    // Delegating to `getMany` costs a bigger page, not a second request: every
    // affiliation of one golfer fits on it.
    it('should still take a single request, asking for a full page', async () => {
      mockFetch.mockResolvedValue(ok({ golfers: [{ ghin: 1234567, last_name: 'Doe' }], invalid: [] }))

      await ghinClient.golfers.getOne(1234567)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const searchParams = mockFetch.mock.calls[0]?.[0].options.searchParams

      expect(searchParams.get('golfer_id')).toBe('1234567')
      expect(searchParams.get('per_page')).toBe('100')
      expect(searchParams.get('page')).toBe('1')
      expect(searchParams.get('sorting_criteria')).toBe('last_name_first_name')
      expect(searchParams.get('order')).toBe('asc')
      expect(searchParams.get('source')).toBe('GHINcom')
    })

    // #83: this used to send `status=Active`, which made `undefined` mean "no
    // such GHIN number *or* not a current member". Measured against `api-uat` on
    // 2026-09-02, golfer 2890015 returns 0 rows for `status=Active` and
    // `status=All`, and 3 rows for `status=Inactive`, no `status` at all, or an
    // empty `status=`. Omission is GHIN's "both", so `has` is the assertion —
    // `get` returns null for `status=` too, and that is a different wire string.
    it('should send no status parameter at all', async () => {
      mockFetch.mockResolvedValue(ok({ golfers: [{ ghin: 1234567, last_name: 'Doe' }], invalid: [] }))

      await ghinClient.golfers.getOne(1234567)

      expect(mockFetch.mock.calls[0]?.[0].options.searchParams.has('status')).toBe(false)
    })

    // The behaviour the parameter was hiding: a lapsed member has a real,
    // readable Handicap Index and is now returned, with `status` telling the
    // caller what they are looking at.
    it('should return an inactive golfer', async () => {
      mockFetch.mockResolvedValue(
        ok({ golfers: [{ ghin: 2890015, last_name: 'Doe', status: 'Inactive' }], invalid: [] }),
      )

      const result = await ghinClient.golfers.getOne(2890015)

      expect(result._unsafeUnwrap()).toBeDefined()
      expect(result._unsafeUnwrap()?.status).toBe('Inactive')
    })

    it('should return a validation error with invalid ghin', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.golfers.getOne('invalid')

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    // The error travels up through `golfersSearch`, so this also pins that the
    // inner Result is threaded rather than unwrapped-and-rethrown.
    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Not found', 404)
      mockFetch.mockResolvedValue(err(failure))

      await expect(ghinClient.golfers.getOne(1234567)).resolves.toBeDefined()

      const result = await ghinClient.golfers.getOne(1234567)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Not found')
    })
  })

  describe('golfers.getMany', () => {
    // GHIN's bulk shape is a comma-separated `golfer_id`; the bracket forms the
    // rest of the API uses are a 500/400 (#81). Asserting the wire string, not
    // just "some ids were sent", is the point of this test.
    const searchParamsOfCall = (call: number): URLSearchParams => mockFetch.mock.calls[call]?.[0].options.searchParams

    const row = (ghin: number, overrides: Record<string, unknown> = {}) => ({
      ghin,
      last_name: `Golfer${ghin}`,
      club_name: 'Home Club',
      is_home_club: true,
      hi_display: '11.4',
      ...overrides,
    })

    it('should send one comma-separated golfer_id and return golfers in request order', async () => {
      mockFetch.mockResolvedValue(ok({ golfers: [row(3), row(1), row(2)], invalid: [] }))

      const result = await ghinClient.golfers.getMany([1, 2, 3])

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(searchParamsOfCall(0).get('golfer_id')).toBe('1,2,3')
      expect(result._unsafeUnwrap().golfers.map((golfer) => golfer.ghin)).toEqual([1, 2, 3])
      expect(result._unsafeUnwrap().missing).toEqual([])
    })

    // The whole reason this method exists over a raw `search`: GHIN drops GHIN
    // numbers it does not know without an error, so the caller cannot tell
    // "not a golfer" from "we forgot to ask".
    it('should report requested numbers GHIN did not return as missing', async () => {
      mockFetch.mockResolvedValue(ok({ golfers: [row(1)], invalid: [] }))

      const result = await ghinClient.golfers.getMany([1, 2, 3])

      expect(result._unsafeUnwrap().golfers.map((golfer) => golfer.ghin)).toEqual([1])
      expect(result._unsafeUnwrap().missing).toEqual([2, 3])
    })

    it('should collapse duplicate GHIN numbers in the request', async () => {
      mockFetch.mockResolvedValue(ok({ golfers: [row(1)], invalid: [] }))

      const result = await ghinClient.golfers.getMany([1, 1, 1])

      expect(searchParamsOfCall(0).get('golfer_id')).toBe('1')
      expect(result._unsafeUnwrap().golfers).toHaveLength(1)
    })

    // A golfer comes back once per club affiliation. Handicap fields are
    // identical across those rows; only the club differs, so the home club is
    // the one that disambiguates two golfers with the same name (#1148).
    it('should deduplicate multi-club golfers to their home club row', async () => {
      mockFetch.mockResolvedValue(
        ok({
          golfers: [
            row(1, { club_name: 'Away Club', is_home_club: false }),
            row(1, { club_name: 'Real Home Club', is_home_club: true }),
            row(1, { club_name: 'Other Away Club', is_home_club: false }),
          ],
          invalid: [],
        }),
      )

      const result = await ghinClient.golfers.getMany([1])

      expect(result._unsafeUnwrap().golfers).toHaveLength(1)
      expect(result._unsafeUnwrap().golfers[0]?.club_name).toBe('Real Home Club')
    })

    it('should keep a golfer whose rows never say is_home_club', async () => {
      mockFetch.mockResolvedValue(
        ok({
          golfers: [
            row(1, { club_name: 'First Club', is_home_club: false }),
            row(1, { club_name: 'Second', is_home_club: false }),
          ],
          invalid: [],
        }),
      )

      const result = await ghinClient.golfers.getMany([1])

      expect(result._unsafeUnwrap().golfers[0]?.club_name).toBe('First Club')
    })

    // `per_page` bounds *rows*, and there is no `meta` block to page against, so
    // a full page is the only signal there is more to read.
    it('should page until GHIN sends a short page', async () => {
      const fullPage = Array.from({ length: 100 }, (_, index) => row(index + 1))

      mockFetch
        .mockResolvedValueOnce(ok({ golfers: fullPage, invalid: [] }))
        .mockResolvedValueOnce(ok({ golfers: [row(101)], invalid: [] }))

      const result = await ghinClient.golfers.getMany([1, 101])

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(searchParamsOfCall(0).get('page')).toBe('1')
      expect(searchParamsOfCall(1).get('page')).toBe('2')
      expect(searchParamsOfCall(1).get('golfer_id')).toBe('1,101')
      expect(result._unsafeUnwrap().golfers.map((golfer) => golfer.ghin)).toEqual([1, 101])
    })

    // The regression this pages on `rowsReceived` for: a page of 100 rows with
    // two that fail `schemaGolfer` yields 98 parsed golfers. Measuring "short
    // page" against the parsed count would call that the last page and silently
    // drop everything after it.
    it('should keep paging when a full page had rows dropped by the schema', async () => {
      const partialPage = Array.from({ length: 98 }, (_, index) => row(index + 1))

      mockFetch
        .mockResolvedValueOnce(ok({ golfers: partialPage, invalid: [{ bad: 'row' }, { bad: 'row' }] }))
        .mockResolvedValueOnce(ok({ golfers: [row(99)], invalid: [] }))

      const result = await ghinClient.golfers.getMany([1, 99])

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result._unsafeUnwrap().golfers.map((golfer) => golfer.ghin)).toContain(99)
    })

    it('should split more than 100 GHIN numbers into separate batches', async () => {
      const ghins = Array.from({ length: 150 }, (_, index) => index + 1)
      mockFetch.mockResolvedValue(ok({ golfers: [], invalid: [] }))

      const result = await ghinClient.golfers.getMany(ghins)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(searchParamsOfCall(0).get('golfer_id')?.split(',')).toHaveLength(100)
      expect(searchParamsOfCall(1).get('golfer_id')?.split(',')).toHaveLength(50)
      expect(result._unsafeUnwrap().missing).toHaveLength(150)
    })

    it('should forward status and updated_since', async () => {
      mockFetch.mockResolvedValue(ok({ golfers: [], invalid: [] }))

      await ghinClient.golfers.getMany([1], { status: 'Inactive', updated_since: '2026-08-01' })

      expect(searchParamsOfCall(0).get('status')).toBe('Inactive')
      expect(searchParamsOfCall(0).get('updated_since')).toBe('2026-08-01')
      expect(searchParamsOfCall(0).get('per_page')).toBe('100')
    })

    // The default is unchanged by the `status: null` opt-out — dropping it would
    // silently move inactive golfers out of `missing` for every existing caller.
    it('should default to Active and drop status entirely for null', async () => {
      mockFetch.mockResolvedValue(ok({ golfers: [], invalid: [] }))

      await ghinClient.golfers.getMany([1])
      await ghinClient.golfers.getMany([1], { status: null })

      expect(searchParamsOfCall(0).get('status')).toBe('Active')
      expect(searchParamsOfCall(1).has('status')).toBe(false)
    })

    // An unfiltered `golfers/search` is not what "get these golfers" meant, so
    // an empty list is a caller bug rather than an empty result.
    it('should return a validation error for an empty list', async () => {
      const result = await ghinClient.golfers.getMany([])

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return a validation error for a non-numeric GHIN number', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.golfers.getMany(['nope'])

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('should stop and surface a fetch failure rather than returning a partial batch', async () => {
      const failure = new NetworkError('Search failed')
      mockFetch.mockResolvedValue(err(failure))

      const result = await ghinClient.golfers.getMany([1, 2])

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
    })

    // Only fires if GHIN stops shortening the last page; without the cap that
    // is an infinite loop rather than an error.
    it('should give up rather than page forever on a never-shortening page', async () => {
      const fullPage = Array.from({ length: 100 }, (_, index) => row(index + 1))
      mockFetch.mockResolvedValue(ok({ golfers: fullPage, invalid: [] }))

      const result = await ghinClient.golfers.getMany([1])

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(mockFetch).toHaveBeenCalledTimes(25)
    })
  })

  describe('golfers.getScores', () => {
    it('should fetch and return golfer scores', async () => {
      const mockResponse = {
        scores: [{ score_id: 1, adjusted_gross_score: 85 }],
        invalid: [],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.golfers.getScores(1234567)

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should handle optional request parameters', async () => {
      const mockResponse = { scores: [], invalid: [] }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.golfers.getScores(1234567, {
        from_date_played: new Date('2024-01-01'),
        to_date_played: new Date('2024-12-31'),
        score_types: ['H', 'A'],
      })

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should return a validation error with invalid ghin', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.golfers.getScores('invalid')

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    // #83: the query-string loop guarded `null` but not `undefined`, and zod
    // `.partial()` keeps a present-but-`undefined` key — verified, `safeParse({
    // course_id: undefined })` succeeds with `course_id` still in `data`. So
    // `.toString()` threw a `TypeError` inside the `try`, `toGhinError` swallowed
    // it, and the exact "caller spreads an optional field in" pattern came back
    // as an `Err` instead of working. Skipping the key is the right wire shape:
    // the caller meant "don't filter on course", not `course_id=`.
    it('should skip a present-but-undefined parameter rather than throw', async () => {
      const mockResponse = { scores: [], invalid: [] }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.golfers.getScores(1234567, { course_id: undefined })

      expect(result.isOk()).toBe(true)
      expect(mockFetch.mock.calls[0]?.[0].options.searchParams.has('course_id')).toBe(false)
    })

    // Degradation must never be silent: a history that quietly comes back one
    // round short is indistinguishable from a golfer who played one round fewer,
    // which is exactly how the #66 score_type drift would have hidden.
    it('should report dropped rows through onDegraded', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      const rejected = { id: 2, score_type: 'Z' }
      mockFetch.mockResolvedValue(ok({ scores: [{ id: 1, adjusted_gross_score: 85 }], invalid: [rejected] }))

      await client.golfers.getScores(1234567)

      expect(onDegraded).toHaveBeenCalledWith({
        entity: 'scores',
        dropped: 1,
        total: 2,
        sample: [rejected],
      })
    })

    it('should not call onDegraded when nothing was dropped', async () => {
      const onDegraded = vi.fn()
      const client = new GhinClient({ password: 'p', username: 'u', onDegraded })
      mockFetch.mockResolvedValue(ok({ scores: [{ id: 1 }], invalid: [] }))

      await client.golfers.getScores(1234567)

      expect(onDegraded).not.toHaveBeenCalled()
    })

    // Telemetry is a side channel — a caller's broken reporter must not turn a
    // working GHIN response into a failed request.
    it('should survive an onDegraded callback that throws', async () => {
      const client = new GhinClient({
        password: 'p',
        username: 'u',
        onDegraded: () => {
          throw new Error('reporter exploded')
        },
      })
      mockFetch.mockResolvedValue(ok({ scores: [{ id: 1 }], invalid: [{ bad: true }] }))

      const result = await client.golfers.getScores(1234567)

      expect(result.isOk()).toBe(true)
    })

    it('should return an error result when fetch fails', async () => {
      const failure = new NetworkError('Fetch failed')
      mockFetch.mockResolvedValue(err(failure))

      const result = await ghinClient.golfers.getScores(1234567)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Fetch failed')
    })
  })

  describe('scores.postHoleByHole', () => {
    const validHbhRequest = {
      golfer_id: '123',
      course_id: '2539',
      tee_set_id: '262908',
      tee_set_side: 'All18' as const,
      played_at: '2026-03-17',
      score_type: 'H' as const,
      hole_details: Array.from({ length: 18 }, (_, i) => ({
        hole_number: i + 1,
        raw_score: 4,
      })),
      number_of_holes: '18' as const,
      gender: 'M' as const,
    }

    it('should post hole-by-hole score and return response', async () => {
      const mockResponse = {
        id: 1,
        golfer_id: 123,
        status: 'Validated',
        adjusted_gross_score: 72,
        number_of_holes: 18,
        number_of_played_holes: 18,
        differential: 0.5,
        course_id: '2539',
        course_name: 'Test Course',
        facility_name: 'Test Facility',
        played_at: '2026-03-17',
        tee_name: "Men's Black",
        tee_set_id: '262908',
        course_rating: 72.5,
        slope_rating: 130,
        score_type: 'H',
        estimated_handicap_display: '15.4',
      }
      mockFetch.mockResolvedValue(ok({ score: mockResponse }))

      const result = await ghinClient.scores.postHoleByHole(validHbhRequest)

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      // `RequestClient` is mocked wholesale, so this asserts the field is
      // carried through `scores.postHoleByHole` to the caller — it does not
      // exercise the schema. Parse coverage lives in `post-response.test.ts`.
      expect(result._unsafeUnwrap().estimated_handicap_display).toBe('15.4')
      expect(mockFetch).toHaveBeenCalledWith({
        entity: 'scores_hbh',
        options: expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        schema: expect.anything(),
      })

      const hbhBody = JSON.parse(mockFetch.mock.calls.at(-1)?.[0]?.options?.body as string)
      expect(hbhBody).toMatchObject({
        golfer_id: '123',
        course_id: '2539',
        score_type: 'H',
        number_of_holes: '18',
      })
      expect(hbhBody.hole_details).toHaveLength(18)
    })

    it('should return a validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.scores.postHoleByHole({ ...validHbhRequest, score_type: 'X' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    // Nothing on this surface rejects any more: the promise resolves to an Err.
    // Asserting only `isErr()` would still pass if a throw crept back in.
    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Post failed')
      mockFetch.mockResolvedValue(err(failure))

      await expect(ghinClient.scores.postHoleByHole(validHbhRequest)).resolves.toBeDefined()

      const result = await ghinClient.scores.postHoleByHole(validHbhRequest)

      expect(result.isErr()).toBe(true)
      // The instance, not a copy — statusCode/retryAfter/field are the point.
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Post failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      const result = await ghinClient.scores.postHoleByHole(validHbhRequest)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().message).toBe('string error')
    })
  })

  describe('scores.postAdjusted', () => {
    const validAdjustedRequest = {
      golfer_id: '123',
      course_id: '2539',
      tee_set_id: '262908',
      tee_set_side: 'All18' as const,
      played_at: '2026-03-17',
      score_type: 'A' as const,
      adjusted_gross_score: 85,
      number_of_holes: '18' as const,
      gender: 'M' as const,
    }

    it('should post adjusted score and return response', async () => {
      const mockResponse = {
        id: 2,
        golfer_id: 123,
        status: 'Validated',
        adjusted_gross_score: 85,
        number_of_holes: 18,
        number_of_played_holes: 18,
        differential: 10.5,
        course_id: '2539',
        course_name: 'Test Course',
        facility_name: 'Test Facility',
        played_at: '2026-03-17',
        tee_name: "Men's Black",
        tee_set_id: '262908',
        course_rating: 72.5,
        slope_rating: 130,
        score_type: 'A',
        // A golfer with no established index posts back `NH`, not a number.
        estimated_handicap_display: 'NH',
      }
      mockFetch.mockResolvedValue(ok({ score: mockResponse }))

      const result = await ghinClient.scores.postAdjusted(validAdjustedRequest)

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(result._unsafeUnwrap().estimated_handicap_display).toBe('NH')
      expect(mockFetch).toHaveBeenCalledWith({
        entity: 'scores_adjusted',
        options: expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        schema: expect.anything(),
      })

      const adjustedBody = JSON.parse(mockFetch.mock.calls.at(-1)?.[0]?.options?.body as string)
      expect(adjustedBody).toMatchObject({
        golfer_id: '123',
        course_id: '2539',
        score_type: 'A',
        adjusted_gross_score: 85,
      })
    })

    it('should return a validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.scores.postAdjusted({ ...validAdjustedRequest, score_type: 'X' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('should return an error result when fetch fails', async () => {
      const failure = new NetworkError('Post failed')
      mockFetch.mockResolvedValue(err(failure))

      const result = await ghinClient.scores.postAdjusted(validAdjustedRequest)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Post failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      const result = await ghinClient.scores.postAdjusted(validAdjustedRequest)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().message).toBe('string error')
    })
  })

  describe('scores.post18h9and9', () => {
    const valid9and9Request = {
      golfer_id: '123',
      course_id: '2539',
      tee_set_id: '262908',
      played_at: '2026-03-17',
      score_type: 'H' as const,
      front9_adjusted: 42,
      back9_adjusted: 43,
      number_of_holes: '18' as const,
      gender: 'M' as const,
    }

    it('should post 9-and-9 score and return response', async () => {
      const mockResponse = {
        id: 3,
        golfer_id: 123,
        status: 'Validated',
        adjusted_gross_score: 85,
        number_of_holes: 18,
        number_of_played_holes: 18,
        differential: 10.5,
        course_id: '2539',
        course_name: 'Test Course',
        facility_name: 'Test Facility',
        played_at: '2026-03-17',
        tee_name: "Men's Black",
        tee_set_id: '262908',
        course_rating: 72.5,
        slope_rating: 130,
        score_type: 'H',
        // A plus golfer's index keeps its leading `+`.
        estimated_handicap_display: '+1.2',
      }
      mockFetch.mockResolvedValue(ok({ score: mockResponse }))

      const result = await ghinClient.scores.post18h9and9(valid9and9Request)

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(result._unsafeUnwrap().estimated_handicap_display).toBe('+1.2')
      expect(mockFetch).toHaveBeenCalledWith({
        entity: 'scores_18h9and9',
        options: expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        schema: expect.anything(),
      })

      const nineAndNineBody = JSON.parse(mockFetch.mock.calls.at(-1)?.[0]?.options?.body as string)
      expect(nineAndNineBody).toMatchObject({
        golfer_id: '123',
        course_id: '2539',
        score_type: 'H',
        front9_adjusted: 42,
        back9_adjusted: 43,
      })
    })

    it('should return a validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      const result = await ghinClient.scores.post18h9and9({ ...valid9and9Request, score_type: 'X' })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('should return an error result when fetch fails', async () => {
      const failure = new NetworkError('Post failed')
      mockFetch.mockResolvedValue(err(failure))

      const result = await ghinClient.scores.post18h9and9(valid9and9Request)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Post failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      const result = await ghinClient.scores.post18h9and9(valid9and9Request)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().message).toBe('string error')
    })
  })

  describe('webhooks.get', () => {
    it('should fetch and return webhook settings', async () => {
      const mockResponse = {
        webhook_url: { revision: 'https://example.com/hooks' },
        webhook_data_type: { revision: 'changes_only' },
        webhook_enabled: { revision: true },
      }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.webhooks.get()

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/user/webhook_settings.json',
        schema: expect.anything(),
      })
    })

    // Nothing on this surface rejects any more: the promise resolves to an Err.
    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Unauthorized')
      mockFetchCustomPath.mockResolvedValue(err(failure))

      await expect(ghinClient.webhooks.get()).resolves.toBeDefined()

      const result = await ghinClient.webhooks.get()

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Unauthorized')
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      const result = await ghinClient.webhooks.get()

      expect(result._unsafeUnwrapErr().message).toBe('string error')
    })
  })

  describe('webhooks.patch', () => {
    it('should PATCH webhook settings and return updated body', async () => {
      const mockResponse = {
        webhook_url: { revision: 'https://example.com/hooks' },
        webhook_data_type: { revision: 'changes_only' },
        webhook_enabled: { revision: true },
      }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.webhooks.patch({
        webhook_url: { revision: 'https://example.com/hooks' },
        webhook_data_type: { revision: 'changes_only' },
        webhook_enabled: { revision: true },
      })

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/user/webhook_settings.json',
        schema: expect.anything(),
        options: expect.objectContaining({
          method: 'PATCH',
          body: expect.any(String),
        }),
      })

      const body = JSON.parse(mockFetchCustomPath.mock.calls.at(-1)?.[0]?.options?.body as string)
      expect(body).toEqual({
        webhook_url: { revision: 'https://example.com/hooks' },
        webhook_data_type: { revision: 'changes_only' },
        webhook_enabled: { revision: true },
      })
    })

    it('should return validation error with empty patch', async () => {
      const result = await ghinClient.webhooks.patch({})

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(result._unsafeUnwrapErr().message).toContain('Invalid webhook settings patch:')
    })

    it('should return validation error when all event maps are empty', async () => {
      const result = await ghinClient.webhooks.patch({ webhook_url: {}, webhook_data_type: {}, webhook_enabled: {} })

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('should return validation error with invalid data type', async () => {
      const result = await ghinClient.webhooks.patch({
        // @ts-expect-error - testing invalid input
        webhook_data_type: { revision: 'invalid' },
      })

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Update failed')
      mockFetchCustomPath.mockResolvedValue(err(failure))

      const result = await ghinClient.webhooks.patch({ webhook_enabled: { revision: true } })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Update failed')
    })
  })

  describe('webhooks.delete', () => {
    it('should DELETE webhook settings', async () => {
      const mockResponse = { success: 'Webhook settings deleted' }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.webhooks.delete()

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/user/webhook_settings.json',
        schema: expect.anything(),
        options: { method: 'DELETE' },
      })
    })

    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Delete failed')
      mockFetchCustomPath.mockResolvedValue(err(failure))

      const result = await ghinClient.webhooks.delete()

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Delete failed')
    })
  })

  describe('webhooks.test', () => {
    it('should fire a test event for the given event type', async () => {
      const mockResponse = { success: 'Check your URL for test response.' }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.webhooks.test('revision')

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/user/webhook_settings/test.json',
        schema: expect.anything(),
        options: expect.objectContaining({
          searchParams: expect.any(URLSearchParams),
        }),
      })

      const searchParams = mockFetchCustomPath.mock.calls.at(-1)?.[0]?.options?.searchParams as URLSearchParams
      expect(searchParams.get('type')).toBe('revision')
    })

    it('should return validation error with invalid event type', async () => {
      // @ts-expect-error - testing invalid input
      const result = await ghinClient.webhooks.test('tournament')

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(result._unsafeUnwrapErr().message).toContain('Invalid webhook event type:')
    })

    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Test failed')
      mockFetchCustomPath.mockResolvedValue(err(failure))

      const result = await ghinClient.webhooks.test('revision')

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Test failed')
    })
  })

  describe('webhooks.list', () => {
    it('should list deliveries with default pagination', async () => {
      const mockResponse = { webhooks: [] }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.webhooks.list()

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/user/webhooks.json',
        schema: expect.anything(),
        options: expect.objectContaining({
          searchParams: expect.any(URLSearchParams),
        }),
      })

      const searchParams = mockFetchCustomPath.mock.calls.at(-1)?.[0]?.options?.searchParams as URLSearchParams
      expect(searchParams.get('page')).toBe('1')
      expect(searchParams.get('per_page')).toBe('25')
    })

    it('should pass through filter parameters', async () => {
      const mockResponse = { webhooks: [] }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      await ghinClient.webhooks.list({
        page: 2,
        per_page: 50,
        status: 'not sent',
        object_type: 'revision',
        from_date: '2026-01-01',
        to_date: '2026-01-31',
      })

      const searchParams = mockFetchCustomPath.mock.calls.at(-1)?.[0]?.options?.searchParams as URLSearchParams
      expect(searchParams.get('page')).toBe('2')
      expect(searchParams.get('per_page')).toBe('50')
      expect(searchParams.get('status')).toBe('not sent')
      expect(searchParams.get('object_type')).toBe('revision')
      expect(searchParams.get('from_date')).toBe('2026-01-01')
      expect(searchParams.get('to_date')).toBe('2026-01-31')
    })

    it('should return validation error with invalid object_type', async () => {
      const result = await ghinClient.webhooks.list({
        // @ts-expect-error - testing invalid input
        object_type: 'tournament',
      })

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(result._unsafeUnwrapErr().message).toContain('Invalid webhooks list request:')
    })

    // Nothing on this surface rejects any more: the promise resolves to an Err.
    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('List failed')
      mockFetchCustomPath.mockResolvedValue(err(failure))

      await expect(ghinClient.webhooks.list()).resolves.toBeDefined()

      const result = await ghinClient.webhooks.list()

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('List failed')
    })
  })

  describe('webhooks.resend', () => {
    it('should POST to resend_webhook with default is_crs_webhook=false', async () => {
      const mockResponse = { success: 'Webhook queued for resend' }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.webhooks.resend({ webhook_id: 12345 })

      expect(result._unsafeUnwrap()).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/user/resend_webhook.json',
        schema: expect.anything(),
        options: expect.objectContaining({
          method: 'POST',
          searchParams: expect.any(URLSearchParams),
        }),
      })

      const searchParams = mockFetchCustomPath.mock.calls.at(-1)?.[0]?.options?.searchParams as URLSearchParams
      expect(searchParams.get('webhook_id')).toBe('12345')
      expect(searchParams.get('is_crs_webhook')).toBe('false')
    })

    it('should honor is_crs_webhook=true', async () => {
      const mockResponse = { success: 'Webhook queued for resend' }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      await ghinClient.webhooks.resend({ webhook_id: 12345, is_crs_webhook: true })

      const searchParams = mockFetchCustomPath.mock.calls.at(-1)?.[0]?.options?.searchParams as URLSearchParams
      expect(searchParams.get('is_crs_webhook')).toBe('true')
    })

    it('should return validation error with non-positive id', async () => {
      const result = await ghinClient.webhooks.resend({ webhook_id: 0 })

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(result._unsafeUnwrapErr().message).toContain('Invalid webhook resend request:')
    })

    it('should resolve to an error result when fetch fails', async () => {
      const failure = new NetworkError('Resend failed')
      mockFetchCustomPath.mockResolvedValue(err(failure))

      const result = await ghinClient.webhooks.resend({ webhook_id: 12345 })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(result._unsafeUnwrapErr().message).toBe('Resend failed')
    })
  })

  describe('webhooks.ensureRegistered', () => {
    const matchingSettings = {
      webhook_url: { revision: 'https://example.com/hooks' },
      webhook_data_type: { revision: 'changes_only' },
      webhook_enabled: { revision: true },
    }

    it('should not PATCH when settings already match', async () => {
      mockFetchCustomPath.mockResolvedValueOnce(ok(matchingSettings))

      const result = await ghinClient.webhooks.ensureRegistered({
        event: 'revision',
        url: 'https://example.com/hooks',
      })

      expect(result._unsafeUnwrap().changed).toBe(false)
      expect(result._unsafeUnwrap().settings).toEqual(matchingSettings)
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(1)
    })

    it('should treat trailing-slash differences as a match', async () => {
      mockFetchCustomPath.mockResolvedValueOnce(
        ok({
          ...matchingSettings,
          webhook_url: { revision: 'https://example.com/hooks/' },
        }),
      )

      const result = await ghinClient.webhooks.ensureRegistered({
        event: 'revision',
        url: 'https://example.com/hooks',
      })

      expect(result._unsafeUnwrap().changed).toBe(false)
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(1)
    })

    it('should PATCH when url differs and return reason', async () => {
      mockFetchCustomPath
        .mockResolvedValueOnce(
          ok({
            webhook_url: { revision: 'https://old.example.com/hooks' },
            webhook_data_type: { revision: 'changes_only' },
            webhook_enabled: { revision: true },
          }),
        )
        .mockResolvedValueOnce(ok(matchingSettings))

      const result = await ghinClient.webhooks.ensureRegistered({
        event: 'revision',
        url: 'https://example.com/hooks',
      })

      expect(result._unsafeUnwrap().changed).toBe(true)
      expect(result._unsafeUnwrap().reason).toMatch(/url differs/)
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(2)

      const patchCall = mockFetchCustomPath.mock.calls[1]?.[0]
      expect(patchCall?.options?.method).toBe('PATCH')
      const body = JSON.parse(patchCall?.options?.body as string)
      expect(body).toEqual({
        webhook_url: { revision: 'https://example.com/hooks' },
        webhook_data_type: { revision: 'changes_only' },
        webhook_enabled: { revision: true },
      })
    })

    it('should PATCH when enabled flag differs', async () => {
      mockFetchCustomPath
        .mockResolvedValueOnce(
          ok({
            webhook_url: { revision: 'https://example.com/hooks' },
            webhook_data_type: { revision: 'changes_only' },
            webhook_enabled: { revision: false },
          }),
        )
        .mockResolvedValueOnce(ok(matchingSettings))

      const result = await ghinClient.webhooks.ensureRegistered({
        event: 'revision',
        url: 'https://example.com/hooks',
      })

      expect(result._unsafeUnwrap().changed).toBe(true)
      expect(result._unsafeUnwrap().reason).toMatch(/enabled differs/)
    })

    it('should PATCH when leaf is missing entirely', async () => {
      mockFetchCustomPath
        .mockResolvedValueOnce(ok({ webhook_url: {}, webhook_data_type: {}, webhook_enabled: {} }))
        .mockResolvedValueOnce(ok(matchingSettings))

      const result = await ghinClient.webhooks.ensureRegistered({
        event: 'revision',
        url: 'https://example.com/hooks',
      })

      expect(result._unsafeUnwrap().changed).toBe(true)
    })

    it('should PATCH when GHIN returns null leaves (unregistered sentinel)', async () => {
      // GHIN's GET response always includes every event key with `null` for
      // unset slots, not an empty object. Verifies the response schema
      // accepts null and ensureRegistered treats it as "not set".
      mockFetchCustomPath
        .mockResolvedValueOnce(
          ok({
            webhook_url: { golfer: null, score: null, revision: null, club: null, course: null, gpa: null },
            webhook_data_type: { golfer: null, score: null, revision: null, club: null, course: null, gpa: null },
            webhook_enabled: { golfer: null, score: null, revision: null, club: null, course: null, gpa: null },
          }),
        )
        .mockResolvedValueOnce(ok(matchingSettings))

      const result = await ghinClient.webhooks.ensureRegistered({
        event: 'revision',
        url: 'https://example.com/hooks',
      })

      expect(result._unsafeUnwrap().changed).toBe(true)
      expect(result._unsafeUnwrap().reason).toMatch(/url differs.*\(not set\)/)
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(2)
    })

    it('should honor non-default dataType and enabled', async () => {
      mockFetchCustomPath
        .mockResolvedValueOnce(ok({ webhook_url: {}, webhook_data_type: {}, webhook_enabled: {} }))
        .mockResolvedValueOnce(
          ok({
            webhook_url: { score: 'https://example.com/scores' },
            webhook_data_type: { score: 'all' },
            webhook_enabled: { score: false },
          }),
        )

      const result = await ghinClient.webhooks.ensureRegistered({
        event: 'score',
        url: 'https://example.com/scores',
        dataType: 'all',
        enabled: false,
      })

      expect(result._unsafeUnwrap().changed).toBe(true)
      const patchBody = JSON.parse(mockFetchCustomPath.mock.calls[1]?.[0]?.options?.body as string)
      expect(patchBody).toEqual({
        webhook_url: { score: 'https://example.com/scores' },
        webhook_data_type: { score: 'all' },
        webhook_enabled: { score: false },
      })
    })

    it('should return validation error with invalid url', async () => {
      const result = await ghinClient.webhooks.ensureRegistered({ event: 'revision', url: 'not-a-url' })

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(result._unsafeUnwrapErr().message).toContain('Invalid ensureRegistered request:')
      expect(mockFetchCustomPath).not.toHaveBeenCalled()
    })

    it('should return validation error with invalid event', async () => {
      // @ts-expect-error - testing invalid input
      const result = await ghinClient.webhooks.ensureRegistered({ event: 'tournament', url: 'https://example.com' })

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
    })

    // The GET used to throw, which short-circuited the PATCH for free. Now the
    // Result has to be threaded, so assert the PATCH is genuinely skipped.
    it('should short-circuit without attempting the PATCH when the GET fails', async () => {
      const failure = new NetworkError('Unauthorized', 401)
      mockFetchCustomPath.mockResolvedValueOnce(err(failure))

      const promise = ghinClient.webhooks.ensureRegistered({ event: 'revision', url: 'https://example.com/hooks' })

      await expect(promise).resolves.toBeDefined()

      const result = await promise

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(1)
    })

    it('should surface a failing PATCH without rewrapping it', async () => {
      const failure = new NetworkError('Update failed', 500)
      mockFetchCustomPath
        .mockResolvedValueOnce(ok({ webhook_url: {}, webhook_data_type: {}, webhook_enabled: {} }))
        .mockResolvedValueOnce(err(failure))

      const result = await ghinClient.webhooks.ensureRegistered({
        event: 'revision',
        url: 'https://example.com/hooks',
      })

      expect(result._unsafeUnwrapErr()).toBe(failure)
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(2)
    })
  })

  describe('webhooks.iterateUndelivered', () => {
    const envelope = (id: number) => ({
      id,
      payload: {
        object: {},
        object_type: 'revision',
        action: 'created',
        webhook_key: 'k',
        webhook_sent_at: '2026-05-12T12:00:00Z',
        environment: 'sandbox',
      },
      status: 'not sent',
    })

    it('should yield ok envelopes from a single page and stop', async () => {
      mockFetchCustomPath.mockResolvedValueOnce(ok({ webhooks: [envelope(1), envelope(2)] }))

      const collected: number[] = []
      for await (const item of ghinClient.webhooks.iterateUndelivered({ per_page: 25 })) {
        collected.push(item._unsafeUnwrap().id)
      }

      expect(collected).toEqual([1, 2])
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(1)
      const searchParams = mockFetchCustomPath.mock.calls[0]?.[0]?.options?.searchParams as URLSearchParams
      expect(searchParams.get('status')).toBe('not sent')
      expect(searchParams.get('page')).toBe('1')
    })

    it('should page until a partial page signals exhaustion', async () => {
      const fullPage = { webhooks: [envelope(1), envelope(2)] }
      const partialPage = { webhooks: [envelope(3)] }
      mockFetchCustomPath.mockResolvedValueOnce(ok(fullPage)).mockResolvedValueOnce(ok(partialPage))

      const collected: number[] = []
      for await (const item of ghinClient.webhooks.iterateUndelivered({ per_page: 2 })) {
        collected.push(item._unsafeUnwrap().id)
      }

      expect(collected).toEqual([1, 2, 3])
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(2)
      expect((mockFetchCustomPath.mock.calls[1]?.[0]?.options?.searchParams as URLSearchParams).get('page')).toBe('2')
    })

    it('should stop on the first empty page', async () => {
      mockFetchCustomPath.mockResolvedValueOnce(ok({ webhooks: [] }))

      const collected: number[] = []
      for await (const item of ghinClient.webhooks.iterateUndelivered()) {
        collected.push(item._unsafeUnwrap().id)
      }

      expect(collected).toEqual([])
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(1)
    })

    it('should forward filters to list()', async () => {
      mockFetchCustomPath.mockResolvedValueOnce(ok({ webhooks: [] }))

      for await (const _item of ghinClient.webhooks.iterateUndelivered({
        per_page: 25,
        object_type: 'revision',
        from_date: '2026-01-01',
      })) {
        // drain
      }

      const searchParams = mockFetchCustomPath.mock.calls[0]?.[0]?.options?.searchParams as URLSearchParams
      expect(searchParams.get('object_type')).toBe('revision')
      expect(searchParams.get('from_date')).toBe('2026-01-01')
      expect(searchParams.get('status')).toBe('not sent')
    })

    // Per #42 Decision 1 the generator never throws: every failure mode below
    // arrives as a yielded `err` and then ends the scan.
    it('should yield a validation error and stop with invalid per_page', async () => {
      const iter = ghinClient.webhooks.iterateUndelivered({ per_page: 0 })

      const first = await iter.next()

      expect(first.done).toBe(false)
      expect(first.value?._unsafeUnwrapErr()).toBeInstanceOf(ValidationError)
      expect(first.value?._unsafeUnwrapErr().message).toContain('Invalid iterateUndelivered request:')
      expect((await iter.next()).done).toBe(true)
      expect(mockFetchCustomPath).not.toHaveBeenCalled()
    })

    it('should yield the list error unrewrapped and stop paging', async () => {
      const failure = new NetworkError('List failed', 500)
      mockFetchCustomPath.mockResolvedValueOnce(err(failure))

      const iter = ghinClient.webhooks.iterateUndelivered()

      const first = await iter.next()

      expect(first.done).toBe(false)
      expect(first.value?._unsafeUnwrapErr()).toBe(failure)
      expect((await iter.next()).done).toBe(true)
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(1)
    })

    it('should never reject, even when the underlying fetch throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      const iter = ghinClient.webhooks.iterateUndelivered()

      await expect(iter.next()).resolves.toBeDefined()
    })

    it('should yield the envelopes it already read before a mid-scan list failure', async () => {
      const failure = new NetworkError('List failed', 500)
      mockFetchCustomPath
        .mockResolvedValueOnce(ok({ webhooks: [envelope(1), envelope(2)] }))
        .mockResolvedValueOnce(err(failure))

      const collected: Array<number | string> = []
      for await (const item of ghinClient.webhooks.iterateUndelivered({ per_page: 2 })) {
        collected.push(item.isErr() ? item.error.message : item.value.id)
      }

      expect(collected).toEqual([1, 2, 'List failed'])
    })

    it('should yield an error and stop when the page cap is exceeded', async () => {
      // Sticky mock: every page returns a full page so the loop never
      // terminates on its own. The hard cap (ITERATE_UNDELIVERED_MAX_PAGES)
      // is the only thing that stops it.
      mockFetchCustomPath.mockResolvedValue(ok({ webhooks: [envelope(1), envelope(2)] }))

      let drained = 0
      let capError: Error | undefined
      for await (const item of ghinClient.webhooks.iterateUndelivered({ per_page: 2 })) {
        if (item.isErr()) {
          capError = item.error
          continue
        }
        drained += 1
      }

      expect(capError).toBeInstanceOf(ValidationError)
      expect(capError?.message).toMatch(/exceeded \d+ pages/)
      // 10_000 pages * 2 envelopes per page were yielded before the cap error.
      expect(drained).toBeGreaterThan(0)
    }, 30000)
  })
})
