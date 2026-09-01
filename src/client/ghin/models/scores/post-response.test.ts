import { describe, expect, it } from 'vitest'
import { schemaScorePostResponse } from './post-response'

// The inner object reached through the envelope's shape rather than a new
// export — nothing outside this file needs it, and the response type is public
// API already.
const schemaInner = schemaScorePostResponse.shape.score

/**
 * A complete, valid score-post response body (the `score` object GHIN returns
 * from a successful post). Taken from a real UAT post against
 * `api-uat.ghin.com` for golfer 13373248.
 */
const baseResponse = {
  id: 987654321,
  golfer_id: 13373248,
  status: 'Validated',
  validation_message: null,
  adjusted_gross_score: 88,
  number_of_holes: 18,
  number_of_played_holes: 18,
  differential: 14.1,
  scaled_up_differential: null,
  adjusted_scaled_up_differential: null,
  course_id: '2539',
  course_name: 'Test Course',
  facility_name: 'Test Facility',
  played_at: '2026-08-28',
  tee_name: 'Blue',
  tee_set_id: '612076',
  course_rating: 72.5,
  slope_rating: 130,
  score_type: 'H',
  estimated_handicap_display: '15.4',
}

describe('schemaScorePostResponse', () => {
  it('parses the full envelope', () => {
    const result = schemaScorePostResponse.safeParse({ score: baseResponse })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.score.id).toBe(987654321)
      expect(result.data.score.estimated_handicap_display).toBe('15.4')
    }
  })

  describe('estimated_handicap_display', () => {
    it('parses a quoted Handicap Index', () => {
      const result = schemaInner.safeParse(baseResponse)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBe('15.4')
      }
    })

    // The reason the declaration is a union: the issue prints established
    // indexes unquoted, so GHIN may well send a number here.
    it('accepts an unquoted number and normalizes it to a string', () => {
      const result = schemaInner.safeParse({ ...baseResponse, estimated_handicap_display: 15.4 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBe('15.4')
      }
    })

    // A golfer with no established index. `NH` is a real answer, not missing
    // data — coercing it to null or 0 would report a scratch handicap.
    it('preserves NH verbatim', () => {
      const result = schemaInner.safeParse({ ...baseResponse, estimated_handicap_display: 'NH' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBe('NH')
        expect(result.data.estimated_handicap_display).not.toBeNull()
        expect(result.data.estimated_handicap_display).not.toBe(0)
      }
    })

    it('preserves a plus handicap verbatim', () => {
      const result = schemaInner.safeParse({ ...baseResponse, estimated_handicap_display: '+1.2' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBe('+1.2')
      }
    })
  })

  describe('leniency', () => {
    // GHIN drops keys entirely rather than nulling them — #46, #51, #55, #56 and
    // LegacyCRPTeeId in #57 were all that same class. A failure here is worse
    // than any of them: the score is already posted, there is no partitionRows
    // salvage on this response and no delete method to undo it.
    it('parses when estimated_handicap_display is omitted entirely', () => {
      const { estimated_handicap_display: _omitted, ...rest } = baseResponse

      const result = schemaInner.safeParse(rest)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBeUndefined()
      }
    })

    it('parses when estimated_handicap_display is null', () => {
      const result = schemaInner.safeParse({ ...baseResponse, estimated_handicap_display: null })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBeNull()
      }
    })

    // Declaring the field must not cost us the passthrough that carried it here
    // in the first place — the next undeclared key GHIN adds still has to arrive.
    it('still passes through undeclared keys', () => {
      const result = schemaInner.safeParse({ ...baseResponse, some_future_ghin_key: 'kept' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('some_future_ghin_key', 'kept')
      }
    })
  })
})
