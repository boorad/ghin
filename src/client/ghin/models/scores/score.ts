import { z } from 'zod'
import {
  boolean,
  date,
  emptyStringToNull,
  float,
  gender,
  handicap,
  monthDay,
  number,
  strictFloat,
  string,
} from '../../../../models'
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
    // Both scaled-up differentials follow `post-response.ts` and are `float.nullish()`: they are
    // null on 73 of the 85 captured rows, and a bare `.nullable()` would cost the whole score row
    // the day GHIN drops the key rather than nulls it (#46, #51, #55, #56, #57).
    adjusted_scaled_up_differential: float.nullish(),
    adjustments: z.array(schemaScoringAdjustment),
    back9_adjusted: number.nullable(),
    back9_course_rating: float.nullable(),
    back9_slope_rating: float.nullable(),
    // Course Handicap comes off the wire as a *string* (`"-7"`, `"NH"`) and deliberately stays
    // one. Do not "fix" this into `handicap` / `number`: this repo represents a plus handicap as a
    // negative number (`playing_handicap: -4` beside `playing_handicap_display: '+4'` in
    // `handicaps/__fixtures__`), while `handicap` coerces the wire's `"+2"` to a positive 2 — the
    // result would be a sign-flipped Course Handicap, the confidently-wrong-number failure mode
    // #63 and #67 exist to prevent. Consumers render it; nothing here computes on it.
    course_handicap: emptyStringToNull.nullish(),
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
    // `999` is GHIN's no-handicap sentinel (`validation.ts:136`) and `handicap` maps it to null,
    // so a golfer with no established index (UAT golfer 13373258) never hands a consumer a
    // 999.0 index that passes a `typeof x === 'number'` guard. The display twin is the literal
    // string `"NH"` on those same rows and is kept verbatim — it is rendered, never parsed.
    //
    // Both are `.nullish()`, never bare/required, even though all 85 captured rows carry them:
    // "present across a UAT capture" is evidence, not a contract, and this branch exists because
    // the documented contract was wrong. A required key costs the whole score row the day GHIN
    // drops it (#46, #51, #55, #56, #57), and a score is not unusable without its index — that is
    // the same bar `course/tee-set-rating-for-score-posting.ts` applies. `handicap_index_display`
    // is `emptyStringToNull` rather than `string` for the same reason `validation_message` below
    // is: the bare `string` helper is `.min(1)` and would cost the row over GHIN's ordinary `""`.
    handicap_index: handicap.nullish(),
    handicap_index_display: emptyStringToNull.nullish(),
    hole_details: z.array(schemaHoleDetail),
    id: number,
    is_manual: boolean,
    is_recent: boolean,
    message_club_authorized: string.nullable(),
    // `handicap`, not `number`: `getScores` sends `net_score: 999` — the same no-handicap
    // sentinel, documented at `validation.ts:126` — on scores that predate the golfer's index.
    // 999 is not a reachable net score, so it maps to null instead of reaching a consumer as a
    // real one; every genuine value parses unchanged.
    net_score: handicap.nullish(),
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
    // `.nullish()` is load-bearing on this boolean and on `short_course` below: the shared
    // `boolean` helper folds `null` to `false` (`validation.ts:4-6`), and "not posted at the home
    // course" is a different claim from "GHIN didn't say" — the #63 fabrication hazard in boolean
    // form. `ZodNullable` short-circuits a null before the helper's transform ever runs.
    posted_on_home_course: boolean.nullish(),
    revision: boolean,
    scaled_up_differential: float.nullish(),
    score_day_order: number,
    score_type_display_full: string,
    score_type_display_short: string,
    score_type: schemaScoreTypeWithTransform,
    season_end_date_at: monthDay,
    season_start_date_at: monthDay,
    short_course: boolean.nullish(),
    slope_rating: strictFloat,
    statistics: schemaStatistics.nullable().optional(),
    status: schemaScoreStatusWithTransform,
    // `"-"` is GHIN's empty sentinel on this field — the same convention `schemaNumberOrDash`
    // handles on the envelope in `response.ts` — and is normalized to null so no consumer renders
    // a bare dash as a score. `""` normalizes to null too, via `emptyStringToNull`. Everything
    // else survives verbatim (`"+12"`): it is a display string with a sign convention of its own,
    // not a number. `.nullish()` for the same reason as `handicap_index` above — a missing key
    // must not cost the whole score row (#46, #51, #55, #56, #57).
    to_par_display_value: emptyStringToNull.transform((value) => (value === '-' ? null : value)).nullish(),
    unadjusted_differential: strictFloat,
    used: boolean,
    // Only sent on `UnderReview` rows (2 of the 85 captured), and `""` is GHIN's ordinary
    // "no message" value, so `emptyStringToNull.nullish()` covers absent, null and blank alike —
    // the same treatment `post-response.ts` already gives the identically named field.
    validation_message: emptyStringToNull.nullish(),
    validation_message_display: emptyStringToNull.nullish(),
  })
  // The scores list is where USGA surfaces new score attributes; `.passthrough()` keeps
  // any undeclared key reachable (typed `unknown`) instead of Zod silently stripping it (#64).
  //
  // `challenge_available` and `country_code` arrive on all 85 captured rows and are null on every
  // one of them, so their real type is unknowable from this data. They are left to passthrough on
  // purpose rather than declared `z.unknown()`, which would only add a useless `unknown` to
  // `Score` — the same reasoning as `eligible_sides` at `handicaps/course-handicap.ts:103-106`.
  .passthrough()

type Score = Prettify<z.infer<typeof schemaScore>>

export { rawScoreTypes, schemaRawScoreStatus, schemaScore }
export type { Score, ScoreType, ScoreStatus }
