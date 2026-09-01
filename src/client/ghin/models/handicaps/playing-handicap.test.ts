import { describe, expect, it } from 'vitest'
import { schemaPlayingHandicapEntry, schemaPlayingHandicapsResponse } from './playing-handicap'

describe('Playing Handicap Schemas', () => {
  const entry = { golfer_id: 1, playing_handicap: 15, course_handicap: 14 }

  describe('schemaPlayingHandicapEntry', () => {
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
      const result = schemaPlayingHandicapEntry.safeParse({ ...entry, handicap_index: input })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.handicap_index).toBe(expected)
      }
    })

    it('should still parse a plain numeric handicap_index', () => {
      const result = schemaPlayingHandicapEntry.safeParse({ ...entry, handicap_index: 12.5 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.handicap_index).toBe(12.5)
      }
    })

    // `.nullish()`, not a bare `.nullable()` — GHIN drops keys entirely rather
    // than nulling them.
    it('should parse with handicap_index absent or explicitly null', () => {
      expect(schemaPlayingHandicapEntry.safeParse(entry).success).toBe(true)

      const nulled = schemaPlayingHandicapEntry.safeParse({ ...entry, handicap_index: null })
      expect(nulled.success).toBe(true)
      if (nulled.success) {
        expect(nulled.data.handicap_index).toBeNull()
      }
    })

    it('should reject a handicap_index that is not a handicap at all', () => {
      expect(schemaPlayingHandicapEntry.safeParse({ ...entry, handicap_index: 'not a handicap' }).success).toBe(false)
    })

    it('should parse plain numeric or numeric-string playing_handicap and course_handicap', () => {
      expect(
        schemaPlayingHandicapEntry.safeParse({ golfer_id: 1, playing_handicap: 15, course_handicap: 14 }),
      ).toMatchObject({
        success: true,
        data: { playing_handicap: 15, course_handicap: 14 },
      })
      expect(
        schemaPlayingHandicapEntry.safeParse({ golfer_id: 1, playing_handicap: '15', course_handicap: '14.2' }),
      ).toMatchObject({
        success: true,
        data: { playing_handicap: 15, course_handicap: 14.2 },
      })
    })

    // Documents today's behaviour, not desired behaviour. `number`/`float` are
    // `z.coerce.number()` underneath and `Number(null) === 0`, so an explicit
    // null becomes a *fabricated* scratch handicap for a golfer who has none.
    // Issue #63 owns the repo-wide decision here — it proposes rejecting null so
    // it fails loudly — and this test is the landing spot that flips when #63
    // lands.
    it('should coerce null playing_handicap and course_handicap to 0 (#63 null-coercion hazard)', () => {
      const result = schemaPlayingHandicapEntry.safeParse({
        golfer_id: 1,
        playing_handicap: null,
        course_handicap: null,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.playing_handicap).toBe(0)
        expect(result.data.course_handicap).toBe(0)
      }
    })

    it('should reject garbage or absent playing_handicap and course_handicap', () => {
      expect(schemaPlayingHandicapEntry.safeParse({ ...entry, playing_handicap: 'garbage' }).success).toBe(false)
      expect(schemaPlayingHandicapEntry.safeParse({ ...entry, course_handicap: 'garbage' }).success).toBe(false)
      expect(schemaPlayingHandicapEntry.safeParse({ golfer_id: 1, course_handicap: 14 }).success).toBe(false)
      expect(schemaPlayingHandicapEntry.safeParse({ golfer_id: 1, playing_handicap: 15 }).success).toBe(false)
    })

    it('should preserve unknown keys GHIN adds', () => {
      const result = schemaPlayingHandicapEntry.safeParse({ ...entry, some_new_key: 'kept' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as unknown as { some_new_key?: string }).some_new_key).toBe('kept')
      }
    })
  })

  describe('schemaPlayingHandicapsResponse', () => {
    // The point of the issue: this response is a plain array, so one suffixed
    // index used to fail the entire batch — a foursome with one `M`/`WD` player
    // returned nothing for anyone.
    it('should keep every entry when one carries a suffixed handicap_index', () => {
      const result = schemaPlayingHandicapsResponse.safeParse({
        playing_handicaps: [
          { golfer_id: 1, playing_handicap: 13, course_handicap: 12 },
          { golfer_id: 2, playing_handicap: 15, course_handicap: 14, handicap_index: '19.1M' },
          { golfer_id: 3, playing_handicap: 17, course_handicap: 16 },
        ],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.playing_handicaps).toHaveLength(3)
        expect(result.data.playing_handicaps[1]?.handicap_index).toBe(19.1)
      }
    })
  })
})
