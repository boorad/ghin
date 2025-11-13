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
        expect(result.data.tee_set_status).toBe('Active')
      }
    })

    it('should parse request with tee_set_status', () => {
      const validRequest = {
        course_id: 13995,
        tee_set_status: 'All' as const,
      }

      const result = schemaCourseDetailsRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tee_set_status).toBe('All')
      }
    })

    it('should parse request with gender filter', () => {
      const validRequest = {
        course_id: 13995,
        gender: 'M' as const,
      }

      const result = schemaCourseDetailsRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.gender).toBe('M')
      }
    })

    it('should parse request with number_of_holes filter', () => {
      const validRequest = {
        course_id: 13995,
        number_of_holes: 18 as const,
      }

      const result = schemaCourseDetailsRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.number_of_holes).toBe(18)
      }
    })

    it('should default tee_set_status to Active', () => {
      const validRequest = {
        course_id: 13995,
      }

      const result = schemaCourseDetailsRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tee_set_status).toBe('Active')
      }
    })

    it('should reject invalid tee_set_status', () => {
      const invalidRequest = {
        course_id: 13995,
        tee_set_status: 'Invalid',
      }

      const result = schemaCourseDetailsRequest.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject invalid gender', () => {
      const invalidRequest = {
        course_id: 13995,
        gender: 'X',
      }

      const result = schemaCourseDetailsRequest.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject invalid number_of_holes', () => {
      const invalidRequest = {
        course_id: 13995,
        number_of_holes: 27,
      }

      const result = schemaCourseDetailsRequest.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject request without course_id', () => {
      const invalidRequest = {}

      const result = schemaCourseDetailsRequest.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })
})
