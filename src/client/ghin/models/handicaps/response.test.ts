import { describe, expect, it } from 'vitest'
import { playingHandicapsWithNhFixture } from './__fixtures__'
import { schemaCoursePlayerHandicapsResponse, schemaGolferHandicapResponse } from './response'

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

    // GHIN sends an explicit `null` for a golfer with no established index
    // (staging golfer 13373258). It must stay `null` — a fabricated `0` is a
    // scratch golfer, not a missing handicap (#63).
    it('should keep a null handicap_index as null, not scratch', () => {
      const result = schemaGolferHandicapResponse.parse({ golfer: { handicap_index: null, clubs: [] } })

      expect(result.golfer.handicap_index).toBeNull()
    })

    it('should map an empty handicap_index to null', () => {
      const result = schemaGolferHandicapResponse.parse({ golfer: { handicap_index: '', clubs: [] } })

      expect(result.golfer.handicap_index).toBeNull()
    })

    it('should reject response without golfer', () => {
      const invalidResponse = {}

      const result = schemaGolferHandicapResponse.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })
})

describe('schemaCoursePlayerHandicapsResponse', () => {
  const percentages = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]
  const buildResponse = (bucket: unknown) => Object.fromEntries(percentages.map((percent) => [percent, bucket]))

  it('should keep the percentage buckets indexed the way GHIN sends them', () => {
    const result = schemaCoursePlayerHandicapsResponse.parse(buildResponse(playingHandicapsWithNhFixture['100']))

    expect(result[100]['13373246']).toEqual({
      playing_handicap: -4,
      playing_handicap_display: '+4',
      shots_off: 0,
    })
    expect(result[5]['13373258']?.playing_handicap).toBeNull()
    expect(result.invalid).toEqual([])
  })

  // A golfer GHIN sends malformed is malformed in all twenty buckets. That is one
  // dropped golfer, not twenty, and `onDegraded` has to be able to say so.
  it('should report a golfer that failed in every bucket once', () => {
    const bucket = {
      ...playingHandicapsWithNhFixture['5'],
      '13373258': { playing_handicap: null, playing_handicap_display: 'N/A', shots_off: 'N/A' },
    }

    const result = schemaCoursePlayerHandicapsResponse.parse(buildResponse(bucket))

    expect(result.invalid).toHaveLength(1)
    expect(result.invalid[0]?.golfer_id).toBe('13373258')
    expect(result.invalid[0]?.row).toBe(bucket['13373258'])
    expect(Object.keys(result[100]).sort()).toEqual(['13373246', '13373247', '13373248'])
  })

  // Deliberate: a missing bucket is the endpoint changing shape, not row-level
  // data variance, and `GhinDegradation` has no raw row to report it with. It
  // fails loudly rather than handing back a silent `undefined`.
  it('should reject a response that is missing a percentage bucket', () => {
    const { 35: _dropped, ...missingBucket } = buildResponse(playingHandicapsWithNhFixture['5'])

    expect(schemaCoursePlayerHandicapsResponse.safeParse(missingBucket).success).toBe(false)
  })
})
