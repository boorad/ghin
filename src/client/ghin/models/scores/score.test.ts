import { describe, expect, it } from 'vitest'
import { schemaScoresResponse } from './response'
import { schemaScore } from './score'

/**
 * A complete, valid raw score row (the shape the GHIN `getScores` endpoint
 * returns per score). Used to verify the optional course fields pass through
 * parsing without disturbing the rest of the schema.
 */
const baseScore = {
  adjusted_gross_score: 85,
  adjustments: [],
  back9_adjusted: null,
  back9_course_rating: null,
  back9_slope_rating: null,
  course_rating: 72.5,
  differential: 10.5,
  edited: false,
  exceptional: false,
  front9_adjusted: null,
  front9_course_rating: null,
  front9_slope_rating: null,
  gender: 'M',
  golfer_id: 1234567,
  hole_details: [],
  id: 1,
  is_manual: false,
  is_recent: true,
  message_club_authorized: null,
  net_score_differential: null,
  number_of_holes: 18,
  number_of_played_holes: 18,
  order_number: 1,
  parent_id: null,
  pcc: 0,
  penalty_method: null,
  penalty_type: null,
  played_at: '2026-03-17',
  posted_at: '2026-03-18',
  revision: false,
  score_day_order: 1,
  score_type_display_full: 'Home',
  score_type_display_short: 'H',
  score_type: 'H',
  season_end_date_at: '12/31',
  season_start_date_at: '01/01',
  slope_rating: 130,
  statistics: null,
  status: 'Validated',
  unadjusted_differential: 10.5,
  used: true,
}

/** A complete, valid raw hole-detail row, as nested under a score's `hole_details`. */
const baseHoleDetail = {
  adjusted_gross_score: 5,
  approach_shot_accuracy: null,
  drive_accuracy: null,
  fairway_hit: true,
  gir_flag: null,
  hole_number: 1,
  id: 10,
  most_likely_score: null,
  par: 4,
  putts: 2,
  raw_score: 5,
  stroke_allocation: 7,
  x_hole: false,
}

/** A complete, valid raw scoring-adjustment row, as nested under a score's `adjustments`. */
const baseAdjustment = {
  display: 'ESR',
  type: 'exceptional_score_reduction',
  value: -1,
}

/** A complete, valid raw statistics object, as nested under a score's `statistics`. */
const baseStatistics = {
  birdies_or_better_percent: 5,
  bogeys_percent: 40,
  double_bogeys_percent: 10,
  fairway_hits_percent: 50,
  gir_percent: 25,
  last_stats_update_date: '2026-03-18',
  last_stats_update_type: 'manual',
  missed_general_approach_shot_accuracy_percent: 10,
  missed_left_approach_shot_accuracy_percent: 10,
  missed_left_percent: 10,
  missed_long_approach_shot_accuracy_percent: 10,
  missed_long_percent: 10,
  missed_right_approach_shot_accuracy_percent: 10,
  missed_right_percent: 10,
  missed_short_approach_shot_accuracy_percent: 10,
  missed_short_percent: 10,
  one_putt_or_better_percent: 20,
  par3s_average: 3.5,
  par4s_average: 4.5,
  par5s_average: 5.5,
  pars_percent: 45,
  putts_total: 33,
  three_putt_or_worse_percent: 5,
  triple_bogeys_or_worse_percent: 0,
  two_putt_or_better_percent: 95,
  two_putt_percent: 75,
  up_and_downs_total: 4,
}

describe('schemaScore', () => {
  it('passes through course_id, course_name and facility_name when present', () => {
    const parsed = schemaScore.parse({
      ...baseScore,
      course_id: '2539',
      course_name: 'Test Course',
      facility_name: 'Test Facility',
    })

    expect(parsed.course_id).toBe('2539')
    expect(parsed.course_name).toBe('Test Course')
    expect(parsed.facility_name).toBe('Test Facility')
  })

  it('passes through undeclared keys (#64)', () => {
    const parsed = schemaScore.parse({ ...baseScore, some_future_ghin_key: 'kept' })
    // toHaveProperty avoids the TS4111 / biome useLiteralKeys conflict on index-signature access
    expect(parsed).toHaveProperty('some_future_ghin_key', 'kept')
  })

  it('passes through undeclared keys inside hole_details (#64)', () => {
    const parsed = schemaScore.parse({
      ...baseScore,
      hole_details: [{ ...baseHoleDetail, some_new_key: 'kept' }],
    })

    expect(parsed.hole_details[0]).toHaveProperty('some_new_key', 'kept')
  })

  it('passes through undeclared keys inside adjustments (#64)', () => {
    const parsed = schemaScore.parse({
      ...baseScore,
      adjustments: [{ ...baseAdjustment, some_new_key: 'kept' }],
    })

    expect(parsed.adjustments[0]).toHaveProperty('some_new_key', 'kept')
  })

  it('passes through undeclared keys inside statistics (#64)', () => {
    const parsed = schemaScore.parse({
      ...baseScore,
      statistics: { ...baseStatistics, some_new_key: 'kept' },
    })

    expect(parsed.statistics).toHaveProperty('some_new_key', 'kept')
  })

  it('accepts a numeric course_id', () => {
    const parsed = schemaScore.parse({ ...baseScore, course_id: 2539 })
    expect(parsed.course_id).toBe(2539)
  })

  it('treats the course fields as optional', () => {
    const parsed = schemaScore.parse(baseScore)
    expect(parsed.course_id).toBeUndefined()
    expect(parsed.course_name).toBeUndefined()
    expect(parsed.facility_name).toBeUndefined()
  })

  it('accepts null for the course fields', () => {
    const parsed = schemaScore.parse({
      ...baseScore,
      course_id: null,
      course_name: null,
      facility_name: null,
    })

    expect(parsed.course_id).toBeNull()
    expect(parsed.course_name).toBeNull()
    expect(parsed.facility_name).toBeNull()
  })

  // Issue #63: plain `float` coerced an explicit null differential to 0, a number
  // a consumer would then compute on as if it were real.
  it('rejects an explicit null differential rather than coercing it to 0', () => {
    expect(schemaScore.safeParse({ ...baseScore, differential: null }).success).toBe(false)
  })

  it.each([
    ['A', 'AWAY'],
    // C is COMBINED (two nines combined into an 18), NOT Competition — #65 relabelled it the
    // wrong way and #66 reverts that. Only T means Competition.
    ['C', 'COMBINED'],
    ['E', 'EXCEPTIONAL'],
    ['H', 'HOME'],
    ['N', '9_HOLE_ROUNDS'],
    ['P', 'PENALTY'],
    ['T', 'COMPETITION'],
  ])('transforms score_type %s to %s', (raw, meaning) => {
    const parsed = schemaScore.parse({ ...baseScore, score_type: raw })
    expect(parsed.score_type).toBe(meaning)
  })

  // A real nine-hole Competition Away row from the UAT sample in #66. The display fields are
  // compositional ([N] + [C] + [A]) and disagree with the wire letter on purpose; consumers must
  // read `score_type` and `number_of_holes`, never re-derive the type from the display strings.
  it('maps a wire T row displayed as NCA to COMPETITION and leaves the display fields untouched', () => {
    const parsed = schemaScore.parse({
      ...baseScore,
      score_type: 'T',
      score_type_display_short: 'C',
      score_type_display_full: 'NCA',
      number_of_holes: 9,
      number_of_played_holes: 9,
    })

    expect(parsed.score_type).toBe('COMPETITION')
    expect(parsed.score_type_display_short).toBe('C')
    expect(parsed.score_type_display_full).toBe('NCA')
    expect(parsed.number_of_holes).toBe(9)
  })

  // The real wire-C row from UAT golfer 13373254 (#66): an 18-hole score that is the exact sum of
  // that golfer's two nine-hole rounds (48 + 46 = 94, ratings 34.6 + 35.6 = 70.2). It displays as
  // N because it is *derived from* nines, not because it is a nine-hole round — which is why
  // `number_of_holes` is 18 and the display prefix must never be used to infer hole count.
  it('maps a wire C row displayed as N on 18 holes to COMBINED', () => {
    const parsed = schemaScore.parse({
      ...baseScore,
      score_type: 'C',
      score_type_display_short: 'N',
      score_type_display_full: 'N',
      number_of_holes: 18,
      number_of_played_holes: 18,
      adjusted_gross_score: 94,
      course_rating: 70.2,
      slope_rating: 127,
    })

    expect(parsed.score_type).toBe('COMBINED')
    expect(parsed.score_type_display_full).toBe('N')
    expect(parsed.number_of_holes).toBe(18)
  })
})

describe('schemaScoresResponse', () => {
  it('passes through undeclared sibling keys on the envelope (#64)', () => {
    const parsed = schemaScoresResponse.parse({
      average: 10.5,
      highest_score: 95,
      lowest_score: 78,
      scores: [baseScore],
      total_count: 1,
      some_new_key: 'kept',
    })

    expect(parsed).toHaveProperty('some_new_key', 'kept')
    expect(parsed.scores).toHaveLength(1)
  })

  // The exact failure mode #66 raised: a letter the map doesn't know used to reject
  // the golfer's entire history. It now costs the one round it arrived on.
  it('drops a row with an unrecognised score_type and keeps the rest (#66)', () => {
    const poison = { ...baseScore, id: 2, score_type: 'Z' }
    const parsed = schemaScoresResponse.parse({
      highest_score: 95,
      lowest_score: 78,
      scores: [baseScore, poison],
    })

    expect(parsed.scores).toHaveLength(1)
    expect(parsed.scores[0]?.id).toBe(1)
    // Rejects come back raw and untransformed — `score_type` is still the wire letter,
    // not the mapped enum, so a log of `invalid` shows exactly what GHIN sent.
    expect(parsed.invalid).toEqual([poison])
  })

  it('leaves invalid empty when every row parses', () => {
    const parsed = schemaScoresResponse.parse({
      highest_score: 95,
      lowest_score: 78,
      scores: [baseScore],
    })

    expect(parsed.scores).toHaveLength(1)
    expect(parsed.invalid).toEqual([])
    // `average` and `total_count` are omitted above on purpose: this pins the
    // `.default(0)`-through-`ZodDefault`-through-transform path, which would break silently
    // if the defaults were applied after the transform or stripped by it.
    expect(parsed.average).toBe(0)
    expect(parsed.total_count).toBe(0)
  })

  // Regression guard: a transform that destructured only `scores` would silently
  // drop the envelope fields and everything `.passthrough()` was added for (#64).
  it('preserves the envelope fields and passthrough keys across the partition transform', () => {
    const parsed = schemaScoresResponse.parse({
      average: 10.5,
      highest_score: 95,
      lowest_score: 78,
      scores: [baseScore, { ...baseScore, score_type: 'Z' }],
      total_count: 2,
      some_new_key: 'kept',
    })

    expect(parsed.average).toBe(10.5)
    expect(parsed.highest_score).toBe(95)
    expect(parsed.lowest_score).toBe(78)
    expect(parsed.total_count).toBe(2)
    expect(parsed).toHaveProperty('some_new_key', 'kept')
    // Type-level guard: this indexed read only compiles while the `.passthrough()` index signature
    // survives the transform, which a bare spread would drop from the inferred type (runtime alone
    // would not catch that). The key goes through a variable to satisfy both TS4111 and biome's
    // useLiteralKeys, per the convention noted above.
    const passthroughKey = 'some_new_key'
    const passthroughValue: unknown = parsed[passthroughKey]
    expect(passthroughValue).toBe('kept')
    expect(parsed.invalid).toHaveLength(1)
  })
})
