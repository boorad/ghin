import { describe, expect, it } from 'vitest'
import { courseHandicapsGetFixture, courseHandicapsGetNhFixture } from './__fixtures__'
import { schemaCourseHandicapGetRequest, schemaCourseHandicapsGetResponse } from './course-handicap'

describe('Course Handicap Schemas', () => {
  describe('schemaCourseHandicapsGetResponse', () => {
    // The payload this endpoint actually returns, captured from
    // api-uat.ghin.com. Before this schema it was declared as
    // `{ course_handicaps: [...] }`, a key GHIN never sends, so every call threw
    // `ValidationError: course_handicaps Required`.
    it('should parse the real staging payload and expose the nested course handicap', () => {
      const result = schemaCourseHandicapsGetResponse.safeParse(courseHandicapsGetFixture)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tee_sets).toHaveLength(2)
        expect(result.data.tee_sets[0]?.name).toBe('Black Tees')
        expect(result.data.tee_sets[0]?.ratings[0]?.tee_set_side).toBe('All 18')
        expect(result.data.tee_sets[0]?.ratings[0]?.course_handicap).toBe(11)
        expect(result.data.tee_sets[0]?.holes?.[0]?.Allocation).toBe(15)
        expect(result.data.invalid).toEqual([])
      }
    })

    // A golfer with no established index gets `course_handicap: null`. It must
    // stay null: a bare `handicap` would coerce it to 0 via `z.coerce.number()`
    // and hand back a fabricated scratch Course Handicap.
    it('should keep a null course_handicap null for a golfer with no established index', () => {
      const result = schemaCourseHandicapsGetResponse.safeParse(courseHandicapsGetNhFixture)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tee_sets).toHaveLength(2)
        for (const teeSet of result.data.tee_sets) {
          for (const rating of teeSet.ratings) {
            expect(rating.course_handicap).toBeNull()
            expect(rating.course_handicap_display).toBe('NH')
          }
        }
        expect(result.data.invalid).toEqual([])
      }
    })

    // A live course returns 15 tee sets. One malformed tee set must not cost the
    // caller the other fourteen.
    it('should keep the good tee sets and return the bad one raw in invalid', () => {
      const rejected = { tee_set_id: 999, name: 'No Ratings' }
      const result = schemaCourseHandicapsGetResponse.safeParse({
        tee_sets: [...courseHandicapsGetFixture.tee_sets, rejected],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tee_sets.map((teeSet) => teeSet.tee_set_id)).toEqual([161278, 161279])
        // toBe, not toEqual: the point of the policy is that the row is the
        // object GHIN sent, not a structurally equal reconstruction of it.
        expect(result.data.invalid).toHaveLength(1)
        expect(result.data.invalid[0]).toBe(rejected)
      }
    })

    it('should report an empty invalid list when every tee set parses', () => {
      const result = schemaCourseHandicapsGetResponse.safeParse(courseHandicapsGetFixture)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.invalid).toEqual([])
      }
    })

    it('should preserve unknown keys GHIN adds', () => {
      const result = schemaCourseHandicapsGetResponse.safeParse({
        tee_sets: [{ ...courseHandicapsGetFixture.tee_sets[0], some_new_key: 'kept' }],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data.tee_sets[0] as unknown as { some_new_key?: string }).some_new_key).toBe('kept')
      }
    })
  })

  describe('schemaCourseHandicapGetRequest', () => {
    const request = {
      golfer_id: 13373246,
      course_id: 2539,
      tee_set_id: 161278,
      played_at: '2026-03-17',
      gender: 'M',
    }

    // GHIN answers `'All18'` with
    // `{"errors":{"tee_set_side":["must be one of the following: 'All 18', 'F9', 'B9'"]}}`.
    it("should accept 'All 18' and reject the spaceless 'All18'", () => {
      expect(schemaCourseHandicapGetRequest.safeParse({ ...request, tee_set_side: 'All 18' }).success).toBe(true)
      expect(schemaCourseHandicapGetRequest.safeParse({ ...request, tee_set_side: 'All18' }).success).toBe(false)
    })

    it('should accept the nine-hole sides', () => {
      expect(schemaCourseHandicapGetRequest.safeParse({ ...request, tee_set_side: 'F9' }).success).toBe(true)
      expect(schemaCourseHandicapGetRequest.safeParse({ ...request, tee_set_side: 'B9' }).success).toBe(true)
    })
  })
})
