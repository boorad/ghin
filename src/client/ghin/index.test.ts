import { err, ok } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../../errors'
import { InMemoryCacheClient } from '../in-memory-cache-client'
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

      expect(result).toEqual(mockCountries.countries)
      expect(mockFetch).toHaveBeenCalledWith({
        entity: 'course_countries',
        options: expect.objectContaining({
          searchParams: expect.any(URLSearchParams),
        }),
        schema: expect.anything(),
      })
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Network error')))

      await expect(ghinClient.courses.getCountries()).rejects.toThrow('Network error')
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

      expect(result).toEqual(mockDetails)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should throw validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.courses.getDetails({ course_id: 'invalid' })).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Not found')))

      await expect(ghinClient.courses.getDetails({ course_id: 12345 })).rejects.toThrow('Not found')
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

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalled()
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

      await expect(client.courses.search({ name: 'Test' })).resolves.toBeDefined()
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Search failed')))

      await expect(ghinClient.courses.search({ name: 'Test' })).rejects.toThrow('Search failed')
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

      expect(result).toEqual(mockResponse)
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

      await expect(client.courses.getTeeSetRatingsForScorePosting({ course_id: 7817 })).resolves.toBeDefined()
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('Not found')))

      await expect(ghinClient.courses.getTeeSetRatingsForScorePosting({ course_id: 2539 })).rejects.toThrow('Not found')
    })

    it('should throw validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.courses.getTeeSetRatingsForScorePosting({ course_id: 'invalid' })).rejects.toThrow(
        ValidationError,
      )
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      await expect(ghinClient.courses.getTeeSetRatingsForScorePosting({ course_id: 2539 })).rejects.toThrow(
        'string error',
      )
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

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Search failed')))

      await expect(ghinClient.facilities.search({ name: 'Test' })).rejects.toThrow('Search failed')
    })
  })

  describe('gpa.getAccesses', () => {
    it('should fetch and flatten the golfers branch of the UserAccesses response', async () => {
      // RequestClient parses through the schema before resolving the Result,
      // so the wrapper sees coerced numeric IDs. Mirror that here.
      mockFetch.mockResolvedValue(ok(schemaUserAccessesResponse.parse(getAccessesResponseFixture)))

      const result = await ghinClient.gpa.getAccesses()

      expect(result).toEqual([
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

      await expect(ghinClient.gpa.getAccesses()).resolves.toEqual([])
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Unauthorized')))

      await expect(ghinClient.gpa.getAccesses()).rejects.toThrow('Unauthorized')
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      await expect(ghinClient.gpa.getAccesses()).rejects.toThrow('string error')
    })
  })

  describe('gpa.requestAccess', () => {
    it('should POST email body and return the success envelope', async () => {
      mockFetchCustomPath.mockResolvedValue(ok(requestAccessResponseFixture))

      const result = await ghinClient.gpa.requestAccess(123, { email: 'golfer@example.com' })

      expect(result).toEqual(requestAccessResponseFixture)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/users/golfers/123/request_golfer_product_access.json',
        schema: expect.anything(),
        options: {
          method: 'POST',
          body: JSON.stringify({ email: 'golfer@example.com' }),
        },
      })
    })

    it('should throw validation error with invalid golfer ID', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.gpa.requestAccess('invalid', { email: 'a@b.com' })).rejects.toThrow(ValidationError)
    })

    it('should throw validation error when email is missing', async () => {
      // @ts-expect-error - Testing missing required input
      await expect(ghinClient.gpa.requestAccess(123, {})).rejects.toThrow(ValidationError)
    })

    it('should throw validation error when email is empty', async () => {
      await expect(ghinClient.gpa.requestAccess(123, { email: '' })).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('Request failed')))

      await expect(ghinClient.gpa.requestAccess(123, { email: 'a@b.com' })).rejects.toThrow('Request failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      await expect(ghinClient.gpa.requestAccess(123, { email: 'a@b.com' })).rejects.toThrow('string error')
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

      expect(result).toEqual(updateStatusResponseFixture)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/users/4695277/golfers/13373246/update_golfer_product_access_status.json',
        schema: expect.anything(),
        options: {
          method: 'POST',
          body: JSON.stringify({ gpa_status: 'approved' }),
        },
      })
    })

    it('should throw validation error with invalid status', async () => {
      await expect(
        ghinClient.gpa.updateStatus({
          user_id: 1,
          golfer_id: 123,
          // @ts-expect-error - Testing invalid input type
          status: 'invalid',
        }),
      ).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('Update failed')))

      await expect(ghinClient.gpa.updateStatus({ user_id: 1, golfer_id: 123, status: 'approved' })).rejects.toThrow(
        'Update failed',
      )
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      await expect(ghinClient.gpa.updateStatus({ user_id: 1, golfer_id: 123, status: 'approved' })).rejects.toThrow(
        'string error',
      )
    })
  })

  describe('gpa.revokeAccess', () => {
    it('should DELETE and return the success envelope', async () => {
      mockFetchCustomPath.mockResolvedValue(ok(revokeAccessResponseFixture))

      const result = await ghinClient.gpa.revokeAccess(123)

      expect(result).toEqual(revokeAccessResponseFixture)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/users/golfers/123/revoke_golfer_product_access.json',
        schema: expect.anything(),
        options: { method: 'DELETE' },
      })
    })

    it('should throw validation error with invalid golfer ID', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.gpa.revokeAccess('invalid')).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('Revoke failed')))

      await expect(ghinClient.gpa.revokeAccess(123)).rejects.toThrow('Revoke failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      await expect(ghinClient.gpa.revokeAccess(123)).rejects.toThrow('string error')
    })
  })

  describe('handicaps.getOne', () => {
    // #68: this used to hit `/search_golfer.json`, which 404s on UAT for every
    // golfer. It is now backed by `/golfers/search.json`, so the assertion that
    // matters is which entity the request client is asked for.
    it('should fetch the golfer record from golfers/search and return it', async () => {
      const mockResponse = {
        golfers: [
          {
            ghin: 1234567,
            last_name: 'Doe',
            handicap_index: '12.5',
            hi_display: '12.5',
            status: 'Active',
          },
        ],
        invalid: [],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.handicaps.getOne(1234567)

      expect(result).toEqual(mockResponse.golfers[0])
      expect(result?.handicap_index).toBe('12.5')
      expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ entity: 'golfers_search' }))
    })

    it('should return undefined when no golfer matches', async () => {
      mockFetch.mockResolvedValue(ok({ golfers: [], invalid: [] }))

      await expect(ghinClient.handicaps.getOne(1234567)).resolves.toBeUndefined()
    })

    it('should throw validation error with invalid ghin', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.handicaps.getOne('invalid')).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Not found')))

      await expect(ghinClient.handicaps.getOne(1234567)).rejects.toThrow('Not found')
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

      expect(result).toEqual(mockResponse)
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

      await expect(client.handicaps.getCoursePlayerHandicaps([...request])).resolves.toBeDefined()
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Calculation failed')))

      await expect(
        ghinClient.handicaps.getCoursePlayerHandicaps([{ ghin: 1234567, tee_set_id: 12345, tee_set_side: 'All 18' }]),
      ).rejects.toThrow('Calculation failed')
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

      expect(result).toEqual(mockResponse)
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

      await expect(client.handicaps.getCourseHandicaps(validRequest)).resolves.toBeDefined()
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Failed')))

      await expect(ghinClient.handicaps.getCourseHandicaps(validRequest)).rejects.toThrow('Failed')
    })

    // GHIN rejects the spaceless `'All18'` outright:
    // `{"errors":{"tee_set_side":["must be one of the following: 'All 18', 'F9', 'B9'"]}}`.
    it('should throw validation error for the spaceless All18 tee_set_side', async () => {
      await expect(
        // @ts-expect-error - Testing invalid input type
        ghinClient.handicaps.getCourseHandicaps({ ...validRequest, tee_set_side: 'All18' }),
      ).rejects.toThrow(ValidationError)
    })

    it('should throw validation error with invalid request', async () => {
      await expect(
        // @ts-expect-error - Testing invalid input type
        ghinClient.handicaps.getCourseHandicaps({ ...validRequest, tee_set_side: 'invalid' }),
      ).rejects.toThrow(ValidationError)
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      await expect(ghinClient.handicaps.getCourseHandicaps(validRequest)).rejects.toThrow('string error')
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

      expect(result).toEqual(mockResponse.golfers)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Search failed')))

      await expect(ghinClient.golfers.search({ last_name: 'Doe' })).rejects.toThrow('Search failed')
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

      expect(result).toEqual(mockResponse.golfers)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Search failed')))

      await expect(ghinClient.golfers.globalSearch({ ghin: 1234567 })).rejects.toThrow('Search failed')
    })
  })

  describe('golfers.getOne', () => {
    it('should fetch and return one active golfer', async () => {
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

      expect(result).toEqual(mockResponse.golfers[0])
      expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ entity: 'golfers_search' }))
    })

    it('should return undefined when no golfer found', async () => {
      const mockResponse = {
        golfers: [],
        invalid: [],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.golfers.getOne(1234567)

      expect(result).toBeUndefined()
    })

    it('should throw validation error with invalid ghin', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.golfers.getOne('invalid')).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Not found')))

      await expect(ghinClient.golfers.getOne(1234567)).rejects.toThrow('Not found')
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

      expect(result).toEqual(mockResponse)
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

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should throw validation error with invalid ghin', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.golfers.getScores('invalid')).rejects.toThrow(ValidationError)
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

      await expect(client.golfers.getScores(1234567)).resolves.toBeDefined()
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Fetch failed')))

      await expect(ghinClient.golfers.getScores(1234567)).rejects.toThrow('Fetch failed')
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

      expect(result).toEqual(mockResponse)
      // `RequestClient` is mocked wholesale, so this asserts the field is
      // carried through `scores.postHoleByHole` to the caller — it does not
      // exercise the schema. Parse coverage lives in `post-response.test.ts`.
      expect(result.estimated_handicap_display).toBe('15.4')
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

    it('should throw validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.scores.postHoleByHole({ ...validHbhRequest, score_type: 'X' })).rejects.toThrow(
        ValidationError,
      )
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Post failed')))

      await expect(ghinClient.scores.postHoleByHole(validHbhRequest)).rejects.toThrow('Post failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      await expect(ghinClient.scores.postHoleByHole(validHbhRequest)).rejects.toThrow('string error')
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

      expect(result).toEqual(mockResponse)
      expect(result.estimated_handicap_display).toBe('NH')
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

    it('should throw validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.scores.postAdjusted({ ...validAdjustedRequest, score_type: 'X' })).rejects.toThrow(
        ValidationError,
      )
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Post failed')))

      await expect(ghinClient.scores.postAdjusted(validAdjustedRequest)).rejects.toThrow('Post failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      await expect(ghinClient.scores.postAdjusted(validAdjustedRequest)).rejects.toThrow('string error')
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

      expect(result).toEqual(mockResponse)
      expect(result.estimated_handicap_display).toBe('+1.2')
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

    it('should throw validation error with invalid request', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.scores.post18h9and9({ ...valid9and9Request, score_type: 'X' })).rejects.toThrow(
        ValidationError,
      )
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Post failed')))

      await expect(ghinClient.scores.post18h9and9(valid9and9Request)).rejects.toThrow('Post failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      await expect(ghinClient.scores.post18h9and9(valid9and9Request)).rejects.toThrow('string error')
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

      expect(result).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/user/webhook_settings.json',
        schema: expect.anything(),
      })
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('Unauthorized')))
      await expect(ghinClient.webhooks.get()).rejects.toThrow('Unauthorized')
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')
      await expect(ghinClient.webhooks.get()).rejects.toThrow('string error')
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

      expect(result).toEqual(mockResponse)
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

    it('should throw validation error with empty patch', async () => {
      await expect(ghinClient.webhooks.patch({})).rejects.toThrow(ValidationError)
    })

    it('should throw validation error when all event maps are empty', async () => {
      await expect(
        ghinClient.webhooks.patch({ webhook_url: {}, webhook_data_type: {}, webhook_enabled: {} }),
      ).rejects.toThrow(ValidationError)
    })

    it('should throw validation error with invalid data type', async () => {
      await expect(
        ghinClient.webhooks.patch({
          // @ts-expect-error - testing invalid input
          webhook_data_type: { revision: 'invalid' },
        }),
      ).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('Update failed')))
      await expect(ghinClient.webhooks.patch({ webhook_enabled: { revision: true } })).rejects.toThrow('Update failed')
    })
  })

  describe('webhooks.delete', () => {
    it('should DELETE webhook settings', async () => {
      const mockResponse = { success: 'Webhook settings deleted' }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.webhooks.delete()

      expect(result).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/user/webhook_settings.json',
        schema: expect.anything(),
        options: { method: 'DELETE' },
      })
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('Delete failed')))
      await expect(ghinClient.webhooks.delete()).rejects.toThrow('Delete failed')
    })
  })

  describe('webhooks.test', () => {
    it('should fire a test event for the given event type', async () => {
      const mockResponse = { success: 'Check your URL for test response.' }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.webhooks.test('revision')

      expect(result).toEqual(mockResponse)
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

    it('should throw validation error with invalid event type', async () => {
      // @ts-expect-error - testing invalid input
      await expect(ghinClient.webhooks.test('tournament')).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('Test failed')))
      await expect(ghinClient.webhooks.test('revision')).rejects.toThrow('Test failed')
    })
  })

  describe('webhooks.list', () => {
    it('should list deliveries with default pagination', async () => {
      const mockResponse = { webhooks: [] }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.webhooks.list()

      expect(result).toEqual(mockResponse)
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

    it('should throw validation error with invalid object_type', async () => {
      await expect(
        ghinClient.webhooks.list({
          // @ts-expect-error - testing invalid input
          object_type: 'tournament',
        }),
      ).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('List failed')))
      await expect(ghinClient.webhooks.list()).rejects.toThrow('List failed')
    })
  })

  describe('webhooks.resend', () => {
    it('should POST to resend_webhook with default is_crs_webhook=false', async () => {
      const mockResponse = { success: 'Webhook queued for resend' }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.webhooks.resend({ webhook_id: 12345 })

      expect(result).toEqual(mockResponse)
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

    it('should throw validation error with non-positive id', async () => {
      await expect(ghinClient.webhooks.resend({ webhook_id: 0 })).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('Resend failed')))
      await expect(ghinClient.webhooks.resend({ webhook_id: 12345 })).rejects.toThrow('Resend failed')
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

      expect(result.changed).toBe(false)
      expect(result.settings).toEqual(matchingSettings)
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

      expect(result.changed).toBe(false)
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

      expect(result.changed).toBe(true)
      expect(result.reason).toMatch(/url differs/)
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

      expect(result.changed).toBe(true)
      expect(result.reason).toMatch(/enabled differs/)
    })

    it('should PATCH when leaf is missing entirely', async () => {
      mockFetchCustomPath
        .mockResolvedValueOnce(ok({ webhook_url: {}, webhook_data_type: {}, webhook_enabled: {} }))
        .mockResolvedValueOnce(ok(matchingSettings))

      const result = await ghinClient.webhooks.ensureRegistered({
        event: 'revision',
        url: 'https://example.com/hooks',
      })

      expect(result.changed).toBe(true)
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

      expect(result.changed).toBe(true)
      expect(result.reason).toMatch(/url differs.*\(not set\)/)
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

      expect(result.changed).toBe(true)
      const patchBody = JSON.parse(mockFetchCustomPath.mock.calls[1]?.[0]?.options?.body as string)
      expect(patchBody).toEqual({
        webhook_url: { score: 'https://example.com/scores' },
        webhook_data_type: { score: 'all' },
        webhook_enabled: { score: false },
      })
    })

    it('should throw validation error with invalid url', async () => {
      await expect(ghinClient.webhooks.ensureRegistered({ event: 'revision', url: 'not-a-url' })).rejects.toThrow(
        ValidationError,
      )
    })

    it('should throw validation error with invalid event', async () => {
      await expect(
        // @ts-expect-error - testing invalid input
        ghinClient.webhooks.ensureRegistered({ event: 'tournament', url: 'https://example.com' }),
      ).rejects.toThrow(ValidationError)
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

    it('should yield envelopes from a single page and stop', async () => {
      mockFetchCustomPath.mockResolvedValueOnce(ok({ webhooks: [envelope(1), envelope(2)] }))

      const collected: number[] = []
      for await (const item of ghinClient.webhooks.iterateUndelivered({ per_page: 25 })) {
        collected.push(item.id)
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
        collected.push(item.id)
      }

      expect(collected).toEqual([1, 2, 3])
      expect(mockFetchCustomPath).toHaveBeenCalledTimes(2)
      expect((mockFetchCustomPath.mock.calls[1]?.[0]?.options?.searchParams as URLSearchParams).get('page')).toBe('2')
    })

    it('should stop on the first empty page', async () => {
      mockFetchCustomPath.mockResolvedValueOnce(ok({ webhooks: [] }))

      const collected: number[] = []
      for await (const item of ghinClient.webhooks.iterateUndelivered()) {
        collected.push(item.id)
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

    it('should throw validation error with invalid per_page', async () => {
      const iter = ghinClient.webhooks.iterateUndelivered({ per_page: 0 })
      await expect(iter.next()).rejects.toThrow(ValidationError)
    })

    it('should propagate fetch errors', async () => {
      mockFetchCustomPath.mockResolvedValueOnce(err(new Error('List failed')))

      const iter = ghinClient.webhooks.iterateUndelivered()
      await expect(iter.next()).rejects.toThrow('List failed')
    })

    it('should throw when the page cap is exceeded', async () => {
      // Sticky mock: every page returns a full page so the loop never
      // terminates on its own. The hard cap (ITERATE_UNDELIVERED_MAX_PAGES)
      // is the only thing that stops it.
      mockFetchCustomPath.mockResolvedValue(ok({ webhooks: [envelope(1), envelope(2)] }))

      let drained = 0
      let caught: unknown
      try {
        for await (const _item of ghinClient.webhooks.iterateUndelivered({ per_page: 2 })) {
          drained += 1
        }
      } catch (error) {
        caught = error
      }

      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).toMatch(/exceeded \d+ pages/)
      // 10_000 pages * 2 envelopes per page were yielded before the throw.
      expect(drained).toBeGreaterThan(0)
    }, 30000)
  })
})
