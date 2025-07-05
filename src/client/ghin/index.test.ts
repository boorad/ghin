import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryCacheClient } from '../in-memory-cache-client'
import { GhinClient } from './index'

// Mock the RequestClient
vi.mock('../request-client', () => ({
  RequestClient: vi.fn().mockImplementation(() => ({
    fetch: vi.fn(),
  })),
  CLIENT_SOURCE: 'GHINcom',
}))

describe('GhinClient', () => {
  let ghinClient: GhinClient

  beforeEach(() => {
    vi.clearAllMocks()

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

  describe('courses', () => {
    it('should have getCountries method', () => {
      expect(typeof ghinClient.courses.getCountries).toBe('function')
    })

    it('should have getDetails method', () => {
      expect(typeof ghinClient.courses.getDetails).toBe('function')
    })

    it('should have search method', () => {
      expect(typeof ghinClient.courses.search).toBe('function')
    })
  })

  describe('golfers', () => {
    it('should have getOne method', () => {
      expect(typeof ghinClient.golfers.getOne).toBe('function')
    })

    it('should have getScores method', () => {
      expect(typeof ghinClient.golfers.getScores).toBe('function')
    })

    it('should have search method', () => {
      expect(typeof ghinClient.golfers.search).toBe('function')
    })
  })

  describe('handicaps', () => {
    it('should have getOne method', () => {
      expect(typeof ghinClient.handicaps.getOne).toBe('function')
    })

    it('should have getCoursePlayerHandicaps method', () => {
      expect(typeof ghinClient.handicaps.getCoursePlayerHandicaps).toBe('function')
    })
  })
})
