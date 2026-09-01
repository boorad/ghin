import { describe, expect, it } from 'vitest'
import { schemaCourseHandicapEntry, schemaCourseHandicapsGetResponse } from './course-handicap'

describe('Course Handicap Schemas', () => {
  const entry = { golfer_id: 1, course_handicap: 14 }

  describe('schemaCourseHandicapEntry', () => {
    // Production: GHIN returned handicap_index "19.1M" for a real golfer and the
    // `float` coercion turned it into NaN, dropping that golfer from
    // `golfers.search` (#56). The suffix is a status marker (M = modified by the
    // Handicap Committee, WD = withdrawn), not malformed data.
    it.each([
      ['19.1M', 19.1],
      ['12.4WD', 12.4],
      ['NH', null],
      ['-', null],
      ['12.5', 12.5],
    ])('parses a handicap_index of %s as %s', (input, expected) => {
      const result = schemaCourseHandicapEntry.safeParse({ ...entry, handicap_index: input })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.handicap_index).toBe(expected)
      }
    })

    it('should still parse a plain numeric handicap_index', () => {
      const result = schemaCourseHandicapEntry.safeParse({ ...entry, handicap_index: 12.5 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.handicap_index).toBe(12.5)
      }
    })

    // `.nullish()`, not a bare `.nullable()` — GHIN drops keys entirely rather
    // than nulling them.
    it('should parse with handicap_index absent or explicitly null', () => {
      expect(schemaCourseHandicapEntry.safeParse(entry).success).toBe(true)

      const nulled = schemaCourseHandicapEntry.safeParse({ ...entry, handicap_index: null })
      expect(nulled.success).toBe(true)
      if (nulled.success) {
        expect(nulled.data.handicap_index).toBeNull()
      }
    })

    it('should reject a handicap_index that is not a handicap at all', () => {
      expect(schemaCourseHandicapEntry.safeParse({ ...entry, handicap_index: 'not a handicap' }).success).toBe(false)
    })

    it('should parse a plain numeric or numeric-string course_handicap', () => {
      expect(schemaCourseHandicapEntry.safeParse({ golfer_id: 1, course_handicap: 14 })).toMatchObject({
        success: true,
        data: { course_handicap: 14 },
      })
      expect(schemaCourseHandicapEntry.safeParse({ golfer_id: 1, course_handicap: '14.2' })).toMatchObject({
        success: true,
        data: { course_handicap: 14.2 },
      })
    })

    // Documents today's behaviour, not desired behaviour. `float` is
    // `z.coerce.number()` and `Number(null) === 0`, so an explicit null becomes
    // a *fabricated* scratch handicap for a golfer who has none. Issue #63 owns
    // the repo-wide decision here — it proposes rejecting null so it fails
    // loudly — and this test is the landing spot that flips when #63 lands.
    it('should coerce a null course_handicap to 0 (#63 null-coercion hazard)', () => {
      const result = schemaCourseHandicapEntry.safeParse({ golfer_id: 1, course_handicap: null })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.course_handicap).toBe(0)
      }
    })

    it('should reject a garbage or absent course_handicap', () => {
      expect(schemaCourseHandicapEntry.safeParse({ golfer_id: 1, course_handicap: 'garbage' }).success).toBe(false)
      expect(schemaCourseHandicapEntry.safeParse({ golfer_id: 1 }).success).toBe(false)
    })

    it('should preserve unknown keys GHIN adds', () => {
      const result = schemaCourseHandicapEntry.safeParse({ ...entry, some_new_key: 'kept' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as unknown as { some_new_key?: string }).some_new_key).toBe('kept')
      }
    })
  })

  describe('schemaCourseHandicapsGetResponse', () => {
    // The point of the issue: this response is a plain array, so one suffixed
    // index used to fail the entire batch — a foursome with one `M`/`WD` player
    // returned nothing for anyone.
    it('should keep every entry when one carries a suffixed handicap_index', () => {
      const result = schemaCourseHandicapsGetResponse.safeParse({
        course_handicaps: [
          { golfer_id: 1, course_handicap: 12 },
          { golfer_id: 2, course_handicap: 14, handicap_index: '19.1M' },
          { golfer_id: 3, course_handicap: 16 },
        ],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.course_handicaps).toHaveLength(3)
        expect(result.data.course_handicaps[1]?.handicap_index).toBe(19.1)
        // A suffixed index is a valid value now, not a degraded row.
        expect(result.data.invalid).toEqual([])
      }
    })

    // Rejects come back untouched rather than as Zod issues so callers can log
    // exactly what GHIN sent — that log is the early warning that GHIN changed
    // a payload again.
    it('should keep the good entries and return the bad ones raw in invalid', () => {
      const rejected = { course_handicap: 14 }
      const result = schemaCourseHandicapsGetResponse.safeParse({
        course_handicaps: [{ golfer_id: 1, course_handicap: 12 }, rejected, { golfer_id: 3, course_handicap: 16 }],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.course_handicaps.map((row) => row.golfer_id)).toEqual([1, 3])
        expect(result.data.invalid).toEqual([rejected])
      }
    })

    it('should report an empty invalid list when every entry parses', () => {
      const result = schemaCourseHandicapsGetResponse.safeParse({
        course_handicaps: [{ golfer_id: 1, course_handicap: 12 }],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.course_handicaps).toHaveLength(1)
        expect(result.data.invalid).toEqual([])
      }
    })
  })
})
