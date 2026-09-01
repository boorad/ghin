import { z } from 'zod'
import { boolean, gender, handicap, number, partitionRows, strictFloat, string } from '../../../../models'
import { schemaTeeSetSide } from './request'

// `tee_set_side` must be `'All 18'` with a space. The shared `teeSetSide`
// (`src/models/validation.ts`) says `'All18'`, which this endpoint rejects with
// `{"errors":{"tee_set_side":["must be one of the following: 'All 18', 'F9', 'B9'"]}}`.
// That enum is shared with score posting, so it is left alone and this request
// points at `schemaTeeSetSide` instead.
const schemaCourseHandicapGetRequest = z.object({
  golfer_id: number,
  course_id: number,
  tee_set_id: number,
  tee_set_side: schemaTeeSetSide,
  played_at: string,
  gender,
})

type CourseHandicapGetRequest = z.infer<typeof schemaCourseHandicapGetRequest>

// Shape captured 2026-09-01 from api-uat.ghin.com — see `__fixtures__/index.ts`.
// `GET /course_handicaps.json` answers with `tee_sets`, each carrying its holes
// and one rating per side, with the Course Handicap nested at
// `tee_sets[].ratings[].course_handicap`. There is no `course_handicaps` array
// and no `handicap_index` anywhere in the payload, so the previous schema made
// this endpoint fail 100% of the time with `ValidationError: course_handicaps
// Required`.
//
// ponytail: the holes are a local schema rather than a shared one. The two
// existing near-identical hole schemas (`schemaCourseDetailsTeeSetHole`,
// `schemaTeeSetRatingHole`) are both private to the course models and shaped for
// their own endpoints; exporting one across model directories to save five lines
// buys coupling, not reuse.
const schemaCourseHandicapHole = z
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

type CourseHandicapHole = z.infer<typeof schemaCourseHandicapHole>

// `course_handicap` is `null` for a golfer with no established index, alongside
// `course_handicap_display: 'NH'`. Before #63 a bare `handicap` tried `float`
// (`z.coerce.number()`) first and `Number(null) === 0`, which handed back a
// fabricated scratch Course Handicap for a golfer who has none — a wrong number,
// not a missing one. `handicap` now maps null to null at the source; the
// `.nullable()` wrapper is kept so the intent is explicit at the field.
//
// Course Rating and Slope Rating are required `strictFloat`, matching
// `schemaCourseDetailsTeeSetRatings`. Required-ness alone only rejected a
// *missing* key: `float` is `z.coerce.number()` and `Number(null) === 0`, so an
// explicit `null` parsed to a fabricated scratch rating that passed a
// `typeof x === 'number'` guard (#63). `strictFloat` rejects the null too; the
// row sits behind `partitionRows`, so it costs one tee set and fires `onDegraded`.
//
// `tee_set_side` is a plain string rather than `schemaTeeSetSide` — the enum is
// right for the request, but pinning it on the response would drop an entire tee
// set the day GHIN publishes a side we haven't seen.
const schemaCourseHandicapRating = z
  .object({
    tee_set_side: string,
    course_rating: strictFloat,
    slope_rating: strictFloat,
    par: number.nullish(),
    course_handicap: handicap.nullable(),
    course_handicap_display: string.nullish(),
  })
  .passthrough()

type CourseHandicapRating = z.infer<typeof schemaCourseHandicapRating>

// Required means "the tee set is unusable without it": the id, the name a player
// picks from a list, and the ratings that carry the Course Handicap this
// endpoint exists to return.
//
// `ratings` is all-or-nothing on purpose, like `Holes`/`Ratings` on course
// details. Dropping one bad rating row would leave a side silently absent and be
// indistinguishable from a tee GHIN rates only partially; the whole tee set
// fails into `invalid` instead, which reports.
//
// `is_shorter` is `null` in both staging captures and gets `.nullish()`, never a
// bare `.nullable()` — GHIN drops keys entirely rather than nulling them (#46,
// #51, #55, #56, #57).
const schemaCourseHandicapTeeSet = z
  .object({
    tee_set_id: number,
    name: string,
    gender: gender.nullish(),
    holes_number: number.nullish(),
    // Nullish so a dropped `holes` key doesn't cost the caller the Course
    // Handicap they asked for. A hole list that is present but malformed still
    // fails the whole tee set into `invalid` — deliberate: a silently short hole
    // list is indistinguishable from a genuinely short one, and unlike a missing
    // key it reports.
    holes: z.array(schemaCourseHandicapHole).nullish(),
    is_shorter: boolean.nullish(),
    // `eligible_sides` is `null` in every staging capture and is left undeclared
    // on purpose: `.passthrough()` carries it through untouched, and declaring it
    // `z.unknown()` would only add a useless `unknown` to the inferred type.
    ratings: z.array(schemaCourseHandicapRating),
  })
  .passthrough()

type CourseHandicapTeeSet = z.infer<typeof schemaCourseHandicapTeeSet>

// Tee sets are parsed individually: a live course returns 15 of them, and one
// malformed tee set must not cost the caller the other fourteen. Rejects come
// back raw in `invalid` so the caller can log what GHIN actually sent rather
// than discovering it during an outage.
const schemaCourseHandicapsGetResponse = z
  .object({
    tee_sets: z.array(z.unknown()),
  })
  .transform(({ tee_sets }) => {
    const { valid, invalid } = partitionRows(schemaCourseHandicapTeeSet, tee_sets)
    return { tee_sets: valid, invalid }
  })

type CourseHandicapsGetResponse = z.infer<typeof schemaCourseHandicapsGetResponse>

export {
  schemaCourseHandicapGetRequest,
  schemaCourseHandicapHole,
  schemaCourseHandicapRating,
  schemaCourseHandicapsGetResponse,
  schemaCourseHandicapTeeSet,
}
export type {
  CourseHandicapGetRequest,
  CourseHandicapHole,
  CourseHandicapRating,
  CourseHandicapsGetResponse,
  CourseHandicapTeeSet,
}
