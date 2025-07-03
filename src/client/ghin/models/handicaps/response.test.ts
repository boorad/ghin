import { describe, it, expect } from 'vitest'
import { schemaGolferHandicapResponse } from './response'

describe('Handicap Response Schemas', () => {
  describe('schemaGolferHandicapResponse', () => {
    it('should validate a valid golfer handicap response', () => {
      const validResponse = {
        golfer: {
          handicap_index: '12.5',
          clubs: [
            {
              id: 1,
              club_name: 'Test Club',
              association_id: 123,
              active: true,
            },
          ],
        },
      }

      const result = schemaGolferHandicapResponse.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it('should validate response with NH handicap', () => {
      const validResponse = {
        golfer: {
          handicap_index: 'NH',
          clubs: [],
        },
      }

      const result = schemaGolferHandicapResponse.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it('should reject response without golfer', () => {
      const invalidResponse = {}

      const result = schemaGolferHandicapResponse.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })
}) 