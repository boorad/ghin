import { err, ok } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../../errors'
import { InMemoryCacheClient } from '../in-memory-cache-client'
import { GhinClient } from './index'

// Mock the RequestClient
const mockFetch = vi.fn()
vi.mock('../request-client', () => ({
  RequestClient: vi.fn().mockImplementation(() => ({
    fetch: mockFetch,
  })),
  CLIENT_SOURCE: 'GHINcom',
}))

describe('GhinClient', () => {
  let ghinClient: GhinClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()

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

    it('should return undefined when no active golfer found', async () => {
      const mockResponse = {
        golfers: [
          {
            ghin: 1234567,
            first_name: 'John',
            last_name: 'Doe',
            status: 'Inactive',
          },
        ],
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
})
