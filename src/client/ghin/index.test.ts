import { err, ok } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../../errors'
import { InMemoryCacheClient } from '../in-memory-cache-client'
import { GhinClient } from './index'

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
      const mockDetails = {
        course_id: 12345,
        name: 'Test Course',
        city: 'Test City',
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
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.courses.search({ name: 'Test' })

      expect(result).toEqual(mockResponse.courses)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Search failed')))

      await expect(ghinClient.courses.search({ name: 'Test' })).rejects.toThrow('Search failed')
    })
  })

  describe('courses.getTeeSetRatingsForScorePosting', () => {
    it('should fetch and return tee set ratings for score posting', async () => {
      const mockResponse = {
        tee_set_ratings: [
          {
            tee_set_id: 262908,
            tee_name: "Men's Black",
            gender: 'Male',
            course_rating: 72.5,
            slope_rating: 130,
            par: 72,
            holes_number: 18,
            tee_set_side: 'All18',
          },
        ],
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
    it('should fetch and return GPA accesses', async () => {
      const mockResponse = {
        gpa_accesses: [
          { golfer_id: 123, status: 'approved' },
          { golfer_id: 456, status: 'pending' },
        ],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.gpa.getAccesses()

      expect(result).toEqual(mockResponse.gpa_accesses)
      expect(mockFetch).toHaveBeenCalledWith({
        entity: 'gpa_accesses',
        schema: expect.anything(),
      })
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
    it('should request GPA access for a golfer', async () => {
      const mockResponse = { golfer_id: 123, status: 'pending' }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.gpa.requestAccess(123)

      expect(result).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/users/golfers/123/request_golfer_product_access.json',
        schema: expect.anything(),
        options: { method: 'POST' },
      })
    })

    it('should throw validation error with invalid golfer ID', async () => {
      // @ts-expect-error - Testing invalid input type
      await expect(ghinClient.gpa.requestAccess('invalid')).rejects.toThrow(ValidationError)
    })

    it('should throw error when fetch fails', async () => {
      mockFetchCustomPath.mockResolvedValue(err(new Error('Request failed')))

      await expect(ghinClient.gpa.requestAccess(123)).rejects.toThrow('Request failed')
    })

    it('should wrap non-Error throws', async () => {
      mockFetchCustomPath.mockRejectedValue('string error')

      await expect(ghinClient.gpa.requestAccess(123)).rejects.toThrow('string error')
    })
  })

  describe('gpa.updateStatus', () => {
    it('should update GPA access status', async () => {
      const mockResponse = { golfer_id: 123, status: 'approved' }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.gpa.updateStatus({
        user_id: 1,
        golfer_id: 123,
        status: 'approved',
      })

      expect(result).toEqual(mockResponse)
      expect(mockFetchCustomPath).toHaveBeenCalledWith({
        path: '/users/1/golfers/123/update_golfer_product_access_status.json',
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
    it('should revoke GPA access for a golfer', async () => {
      const mockResponse = { golfer_id: 123 }
      mockFetchCustomPath.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.gpa.revokeAccess(123)

      expect(result).toEqual(mockResponse)
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
    it('should fetch and return golfer handicap', async () => {
      const mockResponse = {
        golfer: {
          ghin: 1234567,
          handicap_index: 12.5,
        },
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.handicaps.getOne(1234567)

      expect(result).toEqual(mockResponse.golfer)
      expect(mockFetch).toHaveBeenCalled()
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
    it('should fetch and return course player handicaps', async () => {
      const mockResponse = {
        handicaps: [{ ghin: 1234567, course_handicap: 15 }],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.handicaps.getCoursePlayerHandicaps([
        { ghin: 1234567, tee_set_id: 12345, tee_set_side: 'All 18' },
      ])

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Calculation failed')))

      await expect(
        ghinClient.handicaps.getCoursePlayerHandicaps([{ ghin: 1234567, tee_set_id: 12345, tee_set_side: 'All 18' }]),
      ).rejects.toThrow('Calculation failed')
    })
  })

  describe('handicaps.getCourseHandicaps', () => {
    it('should fetch and return course handicaps', async () => {
      const mockResponse = {
        course_handicaps: [{ golfer_id: 123, course_handicap: 15.2 }],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.handicaps.getCourseHandicaps({
        golfer_id: 123,
        course_id: 2539,
        tee_set_id: 262908,
        tee_set_side: 'All18',
        played_at: '2026-03-17',
        gender: 'M',
      })

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith({
        entity: 'course_handicaps_get',
        options: expect.objectContaining({
          searchParams: expect.any(URLSearchParams),
        }),
        schema: expect.anything(),
      })
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Failed')))

      await expect(
        ghinClient.handicaps.getCourseHandicaps({
          golfer_id: 123,
          course_id: 2539,
          tee_set_id: 262908,
          tee_set_side: 'All18',
          played_at: '2026-03-17',
          gender: 'M',
        }),
      ).rejects.toThrow('Failed')
    })

    it('should throw validation error with invalid request', async () => {
      await expect(
        ghinClient.handicaps.getCourseHandicaps({
          golfer_id: 123,
          course_id: 2539,
          tee_set_id: 262908,
          // @ts-expect-error - Testing invalid input type
          tee_set_side: 'invalid',
          played_at: '2026-03-17',
          gender: 'M',
        }),
      ).rejects.toThrow(ValidationError)
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      await expect(
        ghinClient.handicaps.getCourseHandicaps({
          golfer_id: 123,
          course_id: 2539,
          tee_set_id: 262908,
          tee_set_side: 'All18',
          played_at: '2026-03-17',
          gender: 'M',
        }),
      ).rejects.toThrow('string error')
    })
  })

  describe('handicaps.getPlayingHandicaps', () => {
    it('should fetch and return playing handicaps', async () => {
      const mockResponse = {
        playing_handicaps: [{ golfer_id: 123, playing_handicap: 14, course_handicap: 15.2 }],
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.handicaps.getPlayingHandicaps({
        golfer_id: 123,
        course_id: 2539,
        tee_set_id: 262908,
        tee_set_side: 'All18',
        played_at: '2026-03-17',
        gender: 'M',
      })

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith({
        entity: 'playing_handicaps_post',
        options: expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
        schema: expect.anything(),
      })
    })

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValue(err(new Error('Failed')))

      await expect(
        ghinClient.handicaps.getPlayingHandicaps({
          golfer_id: 123,
          course_id: 2539,
          tee_set_id: 262908,
          tee_set_side: 'All18',
          played_at: '2026-03-17',
          gender: 'M',
        }),
      ).rejects.toThrow('Failed')
    })

    it('should throw validation error with invalid request', async () => {
      await expect(
        ghinClient.handicaps.getPlayingHandicaps({
          golfer_id: 123,
          course_id: 2539,
          tee_set_id: 262908,
          // @ts-expect-error - Testing invalid input type
          tee_set_side: 'invalid',
          played_at: '2026-03-17',
          gender: 'M',
        }),
      ).rejects.toThrow(ValidationError)
    })

    it('should wrap non-Error throws', async () => {
      mockFetch.mockRejectedValue('string error')

      await expect(
        ghinClient.handicaps.getPlayingHandicaps({
          golfer_id: 123,
          course_id: 2539,
          tee_set_id: 262908,
          tee_set_side: 'All18',
          played_at: '2026-03-17',
          gender: 'M',
        }),
      ).rejects.toThrow('string error')
    })
  })

  describe('golfers.search', () => {
    it('should search and return golfers', async () => {
      const mockResponse = {
        golfers: [{ ghin: 1234567, first_name: 'John', last_name: 'Doe' }],
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
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.golfers.getOne(1234567)

      expect(result).toEqual(mockResponse.golfers[0])
      expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ entity: 'golfers_search' }))
    })

    it('should return undefined when no golfer found', async () => {
      const mockResponse = {
        golfers: [],
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
      }
      mockFetch.mockResolvedValue(ok(mockResponse))

      const result = await ghinClient.golfers.getScores(1234567)

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should handle optional request parameters', async () => {
      const mockResponse = { scores: [] }
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
      }
      mockFetch.mockResolvedValue(ok({ score: mockResponse }))

      const result = await ghinClient.scores.postHoleByHole(validHbhRequest)

      expect(result).toEqual(mockResponse)
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
      }
      mockFetch.mockResolvedValue(ok({ score: mockResponse }))

      const result = await ghinClient.scores.postAdjusted(validAdjustedRequest)

      expect(result).toEqual(mockResponse)
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
      }
      mockFetch.mockResolvedValue(ok({ score: mockResponse }))

      const result = await ghinClient.scores.post18h9and9(valid9and9Request)

      expect(result).toEqual(mockResponse)
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
  })
})
