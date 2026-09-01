import { z } from 'zod'
import { boolean, date, float, gender, monthDay, number, strictFloat, string } from '../../../../models'
import { schemaScoringAdjustment } from './adjustment'
import { schemaHoleDetail } from './hole-detail'
import { schemaStatistics } from './statistics'

type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

const rawScoreTypes = ['A', 'C', 'E', 'H', 'N', 'P', 'T'] as const
const schemaRawScoreTypes = z.enum(rawScoreTypes)
type RawScoreType = z.infer<typeof schemaRawScoreTypes>

const scoreTypes = ['AWAY', 'COMBINED', 'COMPETITION', 'EXCEPTIONAL', 'HOME', '9_HOLE_ROUNDS', 'PENALTY'] as const
const schemaScoreType = z.enum(scoreTypes)
type ScoreType = z.infer<typeof schemaScoreType>

// GHIN sends two different letter alphabets on a score row and they collide (#59, #66):
//
//   score_type                      -> A C H T   GHIN's pre-2020 storage column, never migrated
//   score_type_display_short/_full  -> A C H N   the WHS/USGA published set
//
// The letter C is in both and means different things: Competition in the display fields,
// Combined in `score_type`. This map covers `score_type` only — the storage alphabet. Never
// re-derive a score type from the display fields; they are a different vocabulary.
const scoreTypesMap: Record<RawScoreType, ScoreType> = {
  A: 'AWAY',
  // C is COMBINED: two nine-hole scores combined into one 18-hole score. Confirmed
  // arithmetically against UAT golfer 13373254 (#66) — the one wire-C row in an 85-score sample
  // is the exact sum of that golfer's two nine-hole rows: AGS 48 + 46 = 94, course rating
  // 34.6 + 35.6 = 70.2, slope mean (132 + 122) / 2 = 127, same month. That is also why it
  // displays as N on an 18-hole score: the N marks it as derived from nines, not as nine-hole.
  //
  // #65 relabelled this to COMPETITION from the 2020 WHS naming alone, with no payload behind
  // it. That was the wrong direction and is reverted here; #65 never shipped. C and T are the
  // same pattern — GHIN keeps the legacy storage letter — but only T's *name* changed
  // (Tournament -> Competition). C's did not: it is still Combined.
  C: 'COMBINED',
  E: 'EXCEPTIONAL',
  H: 'HOME',
  // N is a *display*-alphabet letter that leaked into this storage-alphabet enum (#59, #66). It
  // never appears in wire `score_type`, only in the display fields, where it marks a score as
  // nine-hole or nine-hole-derived — the Combined row above displays N on 18 holes.
  // It stays accepted anyway: the evidence against it is absence across 85 UAT rows plus a
  // `score_types=N` filter returning nothing, and an empty filter result proves little (a
  // bogus letter returns 0 rows too). Narrowing `rawScoreTypes` would also narrow the
  // caller-facing `ScoresRequest['score_types']` input at `scores/request.ts:11`.
  N: '9_HOLE_ROUNDS',
  P: 'PENALTY',
  // T is Competition, not Tournament. Across 85 raw scores from all 13 UAT golfers every row
  // GHIN renders as C / CA / NCA carries `score_type: 'T'`, and none renders as T. Confirmed by
  // round-trip: a score posted as T reads back as wire T displayed CA. GHIN kept the pre-2020
  // storage letter and moved the display to the WHS name (#66).
  T: 'COMPETITION',
} as const

const schemaScoreTypeWithTransform: z.ZodType<ScoreType, z.ZodTypeDef, RawScoreType> = schemaRawScoreTypes.transform(
  (value) => scoreTypesMap[value],
)

const scoreStatuses = ['VALIDATED', 'UNDER_REVIEW', 'TEMPORARY'] as const
const schemaScoreStatus = z.enum(scoreStatuses)
type ScoreStatus = z.infer<typeof schemaScoreStatus>

const rawScoreStatuses = ['Validated', 'UnderReview', 'Temporary'] as const
const schemaRawScoreStatus = z.enum(rawScoreStatuses)

const scoreStatusesMap = {
  Validated: 'VALIDATED',
  UnderReview: 'UNDER_REVIEW',
  Temporary: 'TEMPORARY',
} as const

const schemaScoreStatusWithTransform = schemaRawScoreStatus.transform(
  (value) => scoreStatusesMap[value as keyof typeof scoreStatusesMap],
)

// The rating, slope and both differentials are `strictFloat` (#63): plain `float`
// coerced an explicit `null` to a fabricated 0 that a consumer would compute on.
// Blast radius is now one round, not the whole history — `schemaScoresResponse`
// partitions this schema with `partitionRows` (#66), so a null rating costs the
// row it arrived on and surfaces through `onDegraded` instead of rejecting every
// score beside it. Still not a nullable rating: a fabricated 0 differential is
// worse than a missing round.
const schemaScore = z
  .object({
    adjusted_gross_score: number,
    adjustments: z.array(schemaScoringAdjustment),
    back9_adjusted: number.nullable(),
    back9_course_rating: float.nullable(),
    back9_slope_rating: float.nullable(),
    course_id: z.union([string, number]).nullable().optional(),
    course_name: string.nullable().optional(),
    course_rating: strictFloat,
    differential: strictFloat,
    edited: boolean,
    exceptional: boolean,
    facility_name: string.nullable().optional(),
    front9_adjusted: number.nullable(),
    front9_course_rating: float.nullable(),
    front9_slope_rating: float.nullable(),
    gender,
    golfer_id: number,
    hole_details: z.array(schemaHoleDetail),
    id: number,
    is_manual: boolean,
    is_recent: boolean,
    message_club_authorized: string.nullable(),
    net_score_differential: float.nullable(),
    number_of_holes: number,
    number_of_played_holes: number,
    order_number: number,
    parent_id: number.nullable(),
    pcc: float,
    penalty_method: string.nullable(),
    penalty_type: string.nullable(),
    penalty: boolean.optional(),
    played_at: date,
    posted_at: date,
    revision: boolean,
    score_day_order: number,
    score_type_display_full: string,
    score_type_display_short: string,
    score_type: schemaScoreTypeWithTransform,
    season_end_date_at: monthDay,
    season_start_date_at: monthDay,
    slope_rating: strictFloat,
    statistics: schemaStatistics.nullable().optional(),
    status: schemaScoreStatusWithTransform,
    unadjusted_differential: strictFloat,
    used: boolean,
  })
  // The scores list is where USGA surfaces new score attributes; `.passthrough()` keeps
  // any undeclared key reachable (typed `unknown`) instead of Zod silently stripping it (#64).
  .passthrough()

type Score = Prettify<z.infer<typeof schemaScore>>

export { rawScoreTypes, schemaRawScoreStatus, schemaScore }
export type { Score, ScoreType, ScoreStatus }
