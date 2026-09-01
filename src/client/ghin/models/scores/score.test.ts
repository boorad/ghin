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
    // C and T both mean COMPETITION (#66) — the duplicate is intentional, not a typo to clean up.
    ['C', 'COMPETITION'],
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
})
