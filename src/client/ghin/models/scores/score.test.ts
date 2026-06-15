import { describe, expect, it } from 'vitest'
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
})
