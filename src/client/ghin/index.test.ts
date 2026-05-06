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
      expect(mockFetch).toHaveBeenCalled()
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
})
