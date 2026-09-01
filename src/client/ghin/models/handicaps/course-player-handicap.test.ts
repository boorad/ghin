import { describe, expect, it } from 'vitest'
import { playingHandicapsWithNhFixture } from './__fixtures__'
import { schemaCoursePercentPlayerHandicap, schemaPlayerCourseHandicap } from './course-player-handicap'

// The `100` and `5` buckets are parsed on their own rather than through
// `schemaCoursePlayerHandicapsResponse`, because the captured fixture was
// trimmed to two of the twenty percentage buckets.
describe('schemaCoursePercentPlayerHandicap', () => {
  it('should keep every golfer in the bucket when one of them has no established index', () => {
    const result = schemaCoursePercentPlayerHandicap.safeParse(playingHandicapsWithNhFixture['5'])

    expect(result.success).toBe(true)
    expect(Object.keys(result.data?.handicaps ?? {}).sort()).toEqual(['13373246', '13373247', '13373248', '13373258'])
  })

  // The NH golfer is a valid value now, not a degraded row: `playing_handicap:
  // null` and `shots_off: '-'` are what GHIN sends for a golfer with no index.
  it('should parse the real captured payload with nothing dropped', () => {
    const result = schemaCoursePercentPlayerHandicap.parse(playingHandicapsWithNhFixture['5'])

    expect(result.invalid).toEqual([])
  })

  it('should parse the NH golfer as missing rather than scratch', () => {
    const result = schemaCoursePercentPlayerHandicap.parse(playingHandicapsWithNhFixture['5'])

    expect(result.handicaps['13373258']).toEqual({
      playing_handicap: null,
      playing_handicap_display: 'NH',
      shots_off: null,
    })
  })

  it('should coerce the string shots_off of an established golfer', () => {
    const result = schemaCoursePercentPlayerHandicap.parse(playingHandicapsWithNhFixture['5'])

    expect(result.handicaps['13373247']).toEqual({
      playing_handicap: 1,
      playing_handicap_display: '1',
      shots_off: 1,
    })
  })

  it('should preserve a plus handicap as a negative number', () => {
    const result = schemaCoursePercentPlayerHandicap.parse(playingHandicapsWithNhFixture['100'])

    expect(result.handicaps['13373246']).toEqual({
      playing_handicap: -4,
      playing_handicap_display: '+4',
      shots_off: 0,
    })
  })

  // The regression this partitioning exists for. Fixing `null` and `'-'` only
  // covered the two values GHIN was known to send; the bucket itself was still
  // all-or-nothing, so the next unmodelled status string cost the caller the
  // whole foursome exactly like the original bug.
  describe('when GHIN sends one golfer a status string we have not modelled', () => {
    const bucket = {
      ...playingHandicapsWithNhFixture['5'],
      '13373258': {
        playing_handicap: null,
        playing_handicap_display: 'N/A',
        shots_off: 'N/A',
      },
    }

    it('should keep the other three golfers', () => {
      const result = schemaCoursePercentPlayerHandicap.parse(bucket)

      expect(Object.keys(result.handicaps).sort()).toEqual(['13373246', '13373247', '13373248'])
    })

    it('should surface the dropped golfer_id', () => {
      const result = schemaCoursePercentPlayerHandicap.parse(bucket)

      expect(result.invalid.map(({ golfer_id }) => golfer_id)).toEqual(['13373258'])
    })

    // Identity, not structural equality: "untransformed" means the caller can log
    // the very object GHIN sent, not a Zod issue list describing what we wanted.
    it('should return the rejected row raw', () => {
      const result = schemaCoursePercentPlayerHandicap.parse(bucket)

      expect(result.invalid[0]?.row).toBe(bucket['13373258'])
    })
  })
})

describe('schemaPlayerCourseHandicap', () => {
  it('should reject a genuinely malformed shots_off', () => {
    const result = schemaPlayerCourseHandicap.safeParse({
      playing_handicap: 1,
      playing_handicap_display: '1',
      shots_off: 'garbage',
    })

    expect(result.success).toBe(false)
  })
})
