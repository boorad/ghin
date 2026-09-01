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
    expect(Object.keys(result.data ?? {}).sort()).toEqual(['13373246', '13373247', '13373248', '13373258'])
  })

  it('should parse the NH golfer as missing rather than scratch', () => {
    const result = schemaCoursePercentPlayerHandicap.parse(playingHandicapsWithNhFixture['5'])

    expect(result['13373258']).toEqual({
      playing_handicap: null,
      playing_handicap_display: 'NH',
      shots_off: null,
    })
  })

  it('should coerce the string shots_off of an established golfer', () => {
    const result = schemaCoursePercentPlayerHandicap.parse(playingHandicapsWithNhFixture['5'])

    expect(result['13373247']).toEqual({
      playing_handicap: 1,
      playing_handicap_display: '1',
      shots_off: 1,
    })
  })

  it('should preserve a plus handicap as a negative number', () => {
    const result = schemaCoursePercentPlayerHandicap.parse(playingHandicapsWithNhFixture['100'])

    expect(result['13373246']).toEqual({
      playing_handicap: -4,
      playing_handicap_display: '+4',
      shots_off: 0,
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
