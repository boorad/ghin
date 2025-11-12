import { describe, expect, it } from 'vitest'
import { schemaCourseDetailsRequest, schemaCourseSearchRequest } from './request'

describe('Course Request Schemas', () => {
  describe('schemaCourseSearchRequest', () => {
    it('should accept search with name only', () => {
      const validRequest = {
        name: 'Druid',
      }

      const result = schemaCourseSearchRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should accept search with country and state', () => {
      const validRequest = {
        country: 'USA',
        state: 'US-GA',
      }

      const result = schemaCourseSearchRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should accept search with name, country, and state', () => {
      const validRequest = {
        name: 'Druid Hills',
        country: 'USA',
        state: 'US-GA',
      }

      const result = schemaCourseSearchRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should accept search with facility_id', () => {
      const validRequest = {
        facility_id: 11807,
      }

      const result = schemaCourseSearchRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should accept search with updated_at', () => {
      const validRequest = {
        updated_at: new Date('2023-01-01'),
      }

      const result = schemaCourseSearchRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject search with country only (no state)', () => {
      const invalidRequest = {
        country: 'USA',
      }

      const result = schemaCourseSearchRequest.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject search with state only (no country)', () => {
      const invalidRequest = {
        state: 'US-GA',
      }

      const result = schemaCourseSearchRequest.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject search with no valid parameters', () => {
      const invalidRequest = {}

      const result = schemaCourseSearchRequest.safeParse(invalidRequest)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('At least one of the following are required')
      }
    })
  })

  describe('schemaCourseDetailsRequest', () => {
    it('should parse valid course details request', () => {
      const validRequest = {
        course_id: 13995,
      }

      const result = schemaCourseDetailsRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.course_id).toBe(13995)
        expect(result.data.include_altered_tees).toBe(false)
      }
    })

    it('should parse request with include_altered_tees', () => {
      const validRequest = {
        course_id: 13995,
        include_altered_tees: true,
      }

      const result = schemaCourseDetailsRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.include_altered_tees).toBe(true)
      }
    })

    it('should default include_altered_tees to false', () => {
      const validRequest = {
        course_id: 13995,
      }

      const result = schemaCourseDetailsRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.include_altered_tees).toBe(false)
      }
    })

    it('should reject request without course_id', () => {
      const invalidRequest = {}

      const result = schemaCourseDetailsRequest.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })
})
