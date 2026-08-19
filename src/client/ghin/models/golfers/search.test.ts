import { describe, expect, it } from 'vitest'
import { schemaGolfer, schemaGolfersSearchResponse } from './search'

describe('Golfer Search Schema', () => {
  // Only what makes a golfer usable: the number a handicap links against and
  // the name a human picks from a result list.
  const minimalGolfer = { ghin: 1234567, last_name: 'Doe' }

  describe('schemaGolfer', () => {
    it('should parse a golfer carrying only ghin and last_name', () => {
      const result = schemaGolfer.safeParse(minimalGolfer)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ghin).toBe(1234567)
        expect(result.data.first_name ?? null).toBe(null)
      }
    })

    it('should reject a golfer with no ghin', () => {
      expect(schemaGolfer.safeParse({ last_name: 'Doe' }).success).toBe(false)
    })

    it('should preserve unknown keys GHIN adds', () => {
      const result = schemaGolfer.safeParse({ ...minimalGolfer, some_new_key: 'kept' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as unknown as { some_new_key?: string }).some_new_key).toBe('kept')
      }
    })
  })

  describe('schemaGolfersSearchResponse', () => {
    // The regression this schema exists for: one malformed golfer used to reject
    // every golfer beside them, turning partial data into "no search results".
    it('should keep the good golfers and return the bad ones raw in invalid', () => {
      const rejected = { first_name: 'No', last_name: 'Ghin' }
      const result = schemaGolfersSearchResponse.safeParse({
        golfers: [minimalGolfer, rejected, { ghin: 7654321, last_name: 'Roe' }],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.golfers.map((g) => g.ghin)).toEqual([1234567, 7654321])
        expect(result.data.invalid).toEqual([rejected])
      }
    })

    it('should report an empty invalid list when every golfer parses', () => {
      const result = schemaGolfersSearchResponse.safeParse({ golfers: [minimalGolfer] })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.golfers).toHaveLength(1)
        expect(result.data.invalid).toEqual([])
      }
    })

    it('should handle an empty golfers array', () => {
      const result = schemaGolfersSearchResponse.safeParse({ golfers: [] })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.golfers).toEqual([])
        expect(result.data.invalid).toEqual([])
      }
    })
  })
})
