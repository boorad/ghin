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

    // A Handicap Index always displays to one decimal, and this is the string
    // Spicy Golf renders — `String(15)` would put `15` on screen.
    it('formats a whole number to one decimal', () => {
      const result = schemaInner.safeParse({ ...baseResponse, estimated_handicap_display: 15 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBe('15.0')
      }
    })

    it('rounds a number carrying extra precision to one decimal', () => {
      const result = schemaInner.safeParse({ ...baseResponse, estimated_handicap_display: 15.44 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBe('15.4')
      }
    })

    // `z.string()` does not trim, unlike the `string` helper every other string
    // on this response goes through.
    it('trims a padded string', () => {
      const result = schemaInner.safeParse({ ...baseResponse, estimated_handicap_display: ' 15.4 ' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBe('15.4')
      }
    })

    // Declaring the field must not create a rejection path that `.passthrough()`
    // did not have. Nothing computes on this string, so an unexpected shape
    // degrades to absent rather than taking down an already-posted score.
    it('degrades an unexpected shape to undefined instead of rejecting', () => {
      const result = schemaInner.safeParse({ ...baseResponse, estimated_handicap_display: {} })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBeUndefined()
      }
    })

    it('degrades a boolean to undefined instead of rejecting', () => {
      const result = schemaInner.safeParse({ ...baseResponse, estimated_handicap_display: true })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimated_handicap_display).toBeUndefined()
      }
    })
  })

  describe('leniency', () => {
    /**
     * Only the keys that stay required: which score, whose, whether it counts,
     * and the two numbers a consumer computes on. Everything GHIN could drop is
     * gone.
     */
    const minimal = {
      id: 987654321,
      golfer_id: 13373248,
      status: 'Validated',
      adjusted_gross_score: 88,
      differential: 14.1,
    }

    it('parses a response carrying only the required keys', () => {
      const result = schemaInner.safeParse(minimal)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(987654321)
        expect(result.data.course_name).toBeUndefined()
        expect(result.data.course_rating).toBeUndefined()
      }
    })

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

    // A dropped `string` key used to fail as `Required`. It is descriptive —
    // losing the course name is missing information, not wrong information, and
    // never worth rejecting a score that is already posted.
    it('parses when course_name is omitted entirely', () => {
      const { course_name: _omitted, ...rest } = baseResponse

      const result = schemaInner.safeParse(rest)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.course_name).toBeUndefined()
      }
    })

    // The mechanism that took down course search in #51, course details in #52
    // and getTeeSetRating in #57: `float` is `z.coerce.number()`, so an ABSENT
    // key coerces to NaN and the error reads `received nan`, not `Required`.
    // `.nullish()` short-circuits before the coercion ever runs.
    it('parses when course_rating is omitted entirely', () => {
      const { course_rating: _omitted, ...rest } = baseResponse

      const result = schemaInner.safeParse(rest)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.course_rating).toBeUndefined()
      }
    })

    it('parses when slope_rating is omitted entirely', () => {
      const { slope_rating: _omitted, ...rest } = baseResponse

      expect(schemaInner.safeParse(rest).success).toBe(true)
    })

    // The `string` helper is `z.string().trim().min(1)`, so `""` used to reject
    // the whole response. GHIN sends it as a plain "no message" sentinel, and
    // `validation_message` is where it shows up most.
    it('parses when validation_message is an empty string', () => {
      const result = schemaInner.safeParse({ ...baseResponse, validation_message: '' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.validation_message).toBeNull()
      }
    })

    it('parses when course_name is an empty string', () => {
      const result = schemaInner.safeParse({ ...baseResponse, course_name: '' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.course_name).toBeNull()
      }
    })

    // The other side of the policy: leniency stops at the numbers a consumer
    // does arithmetic with. An absent differential would coerce to NaN and be
    // silently wrong rather than merely absent.
    it('still rejects a response missing differential', () => {
      const { differential: _omitted, ...rest } = baseResponse

      expect(schemaInner.safeParse(rest).success).toBe(false)
    })

    it('still rejects a response missing golfer_id', () => {
      const { golfer_id: _omitted, ...rest } = baseResponse

      expect(schemaInner.safeParse(rest).success).toBe(false)
    })

    // Issue #63: `number` is `z.coerce.number()` and `Number(null) === 0`, so an
    // explicit null on these four used to parse as score 0 for golfer 0 with a 0
    // differential. They are the one place this schema rejects rather than bends.
    it.each(['id', 'golfer_id', 'adjusted_gross_score', 'differential'] as const)(
      'rejects an explicit null %s rather than fabricating 0',
      (field) => {
        const result = schemaInner.safeParse({ ...baseResponse, [field]: null })

        expect(result.success).toBe(false)
      },
    )

    it('does not turn a null differential into 0', () => {
      const result = schemaInner.safeParse({ ...baseResponse, differential: null })

      expect(result.success).toBe(false)
      if (result.success) {
        expect(result.data.differential).not.toBe(0)
      }
    })

    it('still coerces a quoted id', () => {
      const result = schemaInner.safeParse({ ...baseResponse, id: '987654321' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(987654321)
      }
    })
  })
})
