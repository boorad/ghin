import { describe, expect, it } from 'vitest'
import { teeSetRatingsForScorePostingFixture } from './__fixtures__'
import {
  schemaTeeSetRatingForScorePostingEntry,
  schemaTeeSetRatingForScorePostingRequest,
  schemaTeeSetRatingsForScorePostingResponse,
} from './tee-set-rating-for-score-posting'

// A row shaped like the wire, built from the captured `Total` row so a test can
// break one field at a time without hand-writing fourteen keys.
const captured = teeSetRatingsForScorePostingFixture[0] as Record<string, unknown>
const row = (overrides: Record<string, unknown> = {}) => ({ ...captured, ...overrides })

describe('TeeSetRatingForScorePosting Schemas', () => {
  describe('schemaTeeSetRatingForScorePostingRequest', () => {
    it('should parse a valid request', () => {
      const result = schemaTeeSetRatingForScorePostingRequest.safeParse({ course_id: 7817 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.course_id).toBe(7817)
      }
    })

    it('should reject a request without a course_id', () => {
      expect(schemaTeeSetRatingForScorePostingRequest.safeParse({}).success).toBe(false)
    })

    it('should reject a non-positive course_id', () => {
      expect(schemaTeeSetRatingForScorePostingRequest.safeParse({ course_id: 0 }).success).toBe(false)
    })
  })

  describe('schemaTeeSetRatingsForScorePostingResponse', () => {
    it('should parse the captured bare array from api-uat.ghin.com', () => {
      const result = schemaTeeSetRatingsForScorePostingResponse.safeParse(teeSetRatingsForScorePostingFixture)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tee_set_ratings).toHaveLength(teeSetRatingsForScorePostingFixture.length)
        expect(result.data.invalid).toEqual([])
        expect(result.data.tee_set_ratings[0]).toMatchObject({
          TeeSetRatingId: 605066,
          TeeSetRatingName: 'Red',
          RatingType: 'Total',
          CourseRating: 67.3,
          SlopeRating: 124,
          BogeyRating: 90.3,
          DisplayName: 'Red',
          Gender: 'Male',
          TeeSetStatus: 'Active',
          TotalPar: 71,
        })
        expect(result.data.tee_set_ratings[0]?.Holes).toHaveLength(3)
      }
    })

    // The regression this schema exists for: the shipped schema expected an
    // envelope object, so every live call failed with
    // `ValidationError: Expected object, received array` (#73).
    it('should reject the object-wrapped shapes the swagger spec described', () => {
      expect(
        schemaTeeSetRatingsForScorePostingResponse.safeParse({ TeeSets: teeSetRatingsForScorePostingFixture }).success,
      ).toBe(false)

      expect(
        schemaTeeSetRatingsForScorePostingResponse.safeParse({
          tee_set_ratings: teeSetRatingsForScorePostingFixture,
        }).success,
      ).toBe(false)
    })

    // Every tee set arrives three times. A consumer posting an eighteen-hole score
    // has to filter on `RatingType`, because the `Front` row's 33.2 looks exactly
    // like a valid eighteen-hole Course Rating.
    it('should keep Total, Front and Back rows and let a consumer filter them', () => {
      const result = schemaTeeSetRatingsForScorePostingResponse.parse(teeSetRatingsForScorePostingFixture)

      expect(result.tee_set_ratings.map((entry) => entry.RatingType)).toEqual([
        'Total',
        'Front',
        'Back',
        'Total',
        'Total',
      ])

      const red = result.tee_set_ratings.filter((entry) => entry.TeeSetRatingId === 605066)
      expect(red).toHaveLength(3)

      const redTotal = red.filter((entry) => entry.RatingType === 'Total')
      expect(redTotal).toHaveLength(1)
      expect(redTotal[0]?.CourseRating).toBe(67.3)
      expect(red.find((entry) => entry.RatingType === 'Front')?.CourseRating).toBe(33.2)
      expect(red.find((entry) => entry.RatingType === 'Back')?.CourseRating).toBe(34.1)
    })

    // One bad row costs that row, not the other 44 a live course returns.
    it('should drop only the malformed row, raw and untransformed', () => {
      const busted = row({ CourseRating: null })
      const result = schemaTeeSetRatingsForScorePostingResponse.parse([...teeSetRatingsForScorePostingFixture, busted])

      expect(result.tee_set_ratings).toHaveLength(teeSetRatingsForScorePostingFixture.length)
      expect(result.invalid).toHaveLength(1)
      // Raw: the same object that came in, not a Zod issue list and not a
      // partially-transformed copy.
      expect(result.invalid[0]).toBe(busted)
    })

    it('should carry undeclared keys through passthrough', () => {
      const result = schemaTeeSetRatingsForScorePostingResponse.parse([row({ SomeNewGhinKey: 'surprise' })])

      expect(result.tee_set_ratings[0]).toHaveProperty('SomeNewGhinKey', 'surprise')
      // Type-level guard: this indexed read only compiles while the `.passthrough()`
      // index signature survives the transform (see `scores/response.ts:33-38`).
      const passthroughKey = 'SomeNewGhinKey'
      const passthroughValue: unknown = result.tee_set_ratings[0]?.[passthroughKey]
      expect(passthroughValue).toBe('surprise')
    })

    it('should parse an empty array', () => {
      expect(schemaTeeSetRatingsForScorePostingResponse.parse([])).toEqual({ tee_set_ratings: [], invalid: [] })
    })
  })

  describe('schemaTeeSetRatingForScorePostingEntry', () => {
    it('should parse a captured row', () => {
      expect(schemaTeeSetRatingForScorePostingEntry.safeParse(captured).success).toBe(true)
    })

    // GHIN drops keys entirely rather than nulling them (#46, #51, #55, #56, #57).
    it('should parse a row missing BogeyRating', () => {
      const { BogeyRating: _dropped, ...withoutBogeyRating } = captured

      expect(schemaTeeSetRatingForScorePostingEntry.safeParse(withoutBogeyRating).success).toBe(true)
    })

    // Same class as #46/#57: GHIN omits `Allocation` when a tee publishes no
    // stroke index, and that must not cost the caller the whole tee.
    it('should parse a row whose holes have no Allocation', () => {
      const holes = [
        { Number: 1, HoleId: 1470026, Length: 310, Par: 4 },
        { Number: 2, HoleId: 1470027, Length: 358, Par: 4 },
      ]

      const result = schemaTeeSetRatingForScorePostingEntry.safeParse(row({ Holes: holes }))
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Holes?.[0]?.Allocation).toBeUndefined()
      }
    })

    it('should parse a row with no Holes key at all', () => {
      const { Holes: _dropped, ...withoutHoles } = captured

      expect(schemaTeeSetRatingForScorePostingEntry.safeParse(withoutHoles).success).toBe(true)
    })

    // A hole list that is present but malformed fails the whole row on purpose: a
    // silently short hole list is indistinguishable from a genuinely short one.
    it('should reject a row whose holes are malformed', () => {
      expect(schemaTeeSetRatingForScorePostingEntry.safeParse(row({ Holes: [{ Par: 4 }] })).success).toBe(false)
    })

    // #63: `float` is `z.coerce.number()` and `Number(null) === 0`, so a plain
    // `float` turned an explicit null into a fabricated scratch rating that passed
    // a `typeof x === 'number'` guard. `strictFloat` rejects it instead.
    it('should reject an explicit null CourseRating rather than coercing it to 0', () => {
      const result = schemaTeeSetRatingForScorePostingEntry.safeParse(row({ CourseRating: null }))

      expect(result.success).toBe(false)
    })

    it('should reject an explicit null SlopeRating rather than coercing it to 0', () => {
      expect(schemaTeeSetRatingForScorePostingEntry.safeParse(row({ SlopeRating: null })).success).toBe(false)
    })

    it('should reject a blank-string CourseRating rather than coercing it to 0', () => {
      expect(schemaTeeSetRatingForScorePostingEntry.safeParse(row({ CourseRating: '  ' })).success).toBe(false)
    })

    it('should still coerce a genuine numeric string rating', () => {
      const result = schemaTeeSetRatingForScorePostingEntry.safeParse(row({ CourseRating: '67.3' }))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.CourseRating).toBe(67.3)
      }
    })

    it('should reject a row missing the identity fields', () => {
      const { TeeSetRatingId: _id, ...withoutId } = captured
      const { TeeSetRatingName: _name, ...withoutName } = captured
      const { RatingType: _type, ...withoutRatingType } = captured

      expect(schemaTeeSetRatingForScorePostingEntry.safeParse(withoutId).success).toBe(false)
      expect(schemaTeeSetRatingForScorePostingEntry.safeParse(withoutName).success).toBe(false)
      expect(schemaTeeSetRatingForScorePostingEntry.safeParse(withoutRatingType).success).toBe(false)
    })

    // A rating type this library has never seen must not cost the caller the row —
    // an enum here would drop it (see `handicaps/course-handicap.ts:62-64`).
    it('should accept an unfamiliar RatingType', () => {
      const result = schemaTeeSetRatingForScorePostingEntry.safeParse(row({ RatingType: 'Middle' }))

      expect(result.success).toBe(true)
    })

    it('should keep EligibleSides when GHIN sends a string for it', () => {
      const combo = teeSetRatingsForScorePostingFixture.find((entry) => entry.EligibleSides !== null)
      const result = schemaTeeSetRatingForScorePostingEntry.safeParse(combo)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.EligibleSides).toBe('All')
      }
    })
  })
})
