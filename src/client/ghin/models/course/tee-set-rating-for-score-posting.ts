import { z } from 'zod'
import { boolean, float, number, partitionRows, strictFloat, string } from '../../../../models'

const schemaTeeSetRatingForScorePostingRequest = z.object({
  course_id: number.positive(),
})

type TeeSetRatingForScorePostingRequest = z.infer<typeof schemaTeeSetRatingForScorePostingRequest>

// ponytail: the holes are a local schema rather than a shared one, for the same
// reason as `handicaps/course-handicap.ts:29` — the near-identical hole schemas
// (`schemaCourseDetailsTeeSetHole`, `schemaTeeSetRatingHole`,
// `schemaCourseHandicapHole`) are each shaped for their own endpoint, and
// exporting one to save five lines buys coupling, not reuse.
const schemaTeeSetRatingForScorePostingHole = z
  .object({
    // The only field that can't be defaulted: it orders the hole and is the
    // stroke-index fallback when GHIN publishes no allocation (issue #46).
    Number: number,
    HoleId: number.nullish(),
    Length: number.nullish(),
    Par: number.nullish(),
    Allocation: number.nullish(),
  })
  .passthrough()

// Shape captured 2026-09-01 from api-uat.ghin.com — see `__fixtures__/index.ts`.
// `GET /Courses/{course_id}/TeeSetRatingsForScorePosting.json` answers with a bare
// array of PascalCase rows. The snake_case `{ tee_set_ratings: [{ tee_set_id,
// tee_name, course_rating, tee_set_side, ... }] }` shape this file shipped is
// swagger fiction and does not exist on the wire, so the endpoint failed 100% of
// the time with `ValidationError: Expected object, received array` (issue #73).
//
// Required means "the row is unusable without it": the id, the name a player picks
// from a list, the rating type that says which nine (or eighteen) the rating covers,
// and the two ratings a Course Handicap is computed from. Everything else is
// `.nullish()`, never a bare `.nullable()` — GHIN drops keys entirely rather than
// nulling them (#46, #51, #55, #56, #57).
//
// `RatingType` is required and is the whole reason a consumer cannot just index
// this array: every tee set arrives three times, as `Total`, `Front` and `Back`
// (15 tee sets = 45 rows on course 7817), and a `Front` row's `CourseRating: 33.2`
// is indistinguishable from an eighteen-hole rating without it. `TeeSetRatingId` is
// shared by all three rows of a tee set, so it does not identify a row either.
//
// It is a plain `string`, not a `z.enum([...])`, for the reason given at
// `handicaps/course-handicap.ts:62-64`: an enum is right on a request, but pinning
// one on a response drops the whole row the day GHIN publishes a type we haven't
// seen. `TeeSetStatus` and `Gender` are plain strings for the same reason.
//
// Course Rating and Slope Rating are required `strictFloat`, matching
// `schemaTeeSetRatingRating` and `schemaCourseHandicapRating`. Required-ness alone
// only rejected a *missing* key: `float` is `z.coerce.number()` and
// `Number(null) === 0`, so an explicit `null` parsed to a fabricated scratch rating
// that passed a `typeof x === 'number'` guard (#63). The row sits behind
// `partitionRows`, so a rejection costs one row and fires `onDegraded`.
//
// `EligibleSides` is declared — unlike `handicaps/course-handicap.ts:103-106`,
// where it is always null — because this endpoint really does send a string for it
// (`'All'`, on four of the 45 captured rows).
const schemaTeeSetRatingForScorePostingEntry = z
  .object({
    TeeSetRatingId: number,
    TeeSetRatingName: string,
    RatingType: string,
    CourseRating: strictFloat,
    SlopeRating: strictFloat,
    BogeyRating: float.nullish(),
    DisplayName: string.nullish(),
    Gender: string.nullish(),
    TeeSetStatus: string.nullish(),
    StrokeAllocation: boolean.nullish(),
    TotalPar: number.nullish(),
    IsShorter: boolean.nullish(),
    EligibleSides: string.nullish(),
    // Nullish so a dropped `Holes` key doesn't cost the caller the ratings they
    // asked for. A hole list that is present but malformed still fails the whole
    // row into `invalid` — deliberate: a silently short hole list is
    // indistinguishable from a genuinely short one, and unlike a missing key it
    // reports.
    Holes: z.array(schemaTeeSetRatingForScorePostingHole).nullish(),
  })
  .passthrough()

type TeeSetRatingForScorePostingEntry = z.infer<typeof schemaTeeSetRatingForScorePostingEntry>

// Rows are parsed individually: a live course returns 45 of them, and one malformed
// row must not cost the caller the other 44. Rejects come back raw in `invalid` so
// the caller can log what GHIN actually sent rather than discovering it during an
// outage.
//
// The wire payload is a bare array with nowhere to hang that `invalid` key, so the
// transform builds the envelope: `{ tee_set_ratings, invalid }`, the same shape as
// `schemaCourseSearchResponse`, `schemaGolfersSearchResponse` and
// `schemaCourseHandicapsGetResponse`. Returning a bare `Entry[]` would throw the
// degradation signal away, and there is no consumer shape to preserve — this
// method never once succeeded.
const schemaTeeSetRatingsForScorePostingResponse = z.array(z.unknown()).transform((rows) => {
  const { valid, invalid } = partitionRows(schemaTeeSetRatingForScorePostingEntry, rows)
  return { tee_set_ratings: valid, invalid }
})

type TeeSetRatingsForScorePostingResponse = z.infer<typeof schemaTeeSetRatingsForScorePostingResponse>

export {
  schemaTeeSetRatingForScorePostingEntry,
  schemaTeeSetRatingForScorePostingHole,
  schemaTeeSetRatingForScorePostingRequest,
  schemaTeeSetRatingsForScorePostingResponse,
}
export type {
  TeeSetRatingForScorePostingEntry,
  TeeSetRatingForScorePostingRequest,
  TeeSetRatingsForScorePostingResponse,
}
