import { z } from 'zod'
import { emptyStringToNull, float, number } from '../../../../models'
import { schemaRawScoreStatus } from './score'

// By the time this parses, the score is already posted at GHIN. This response is
// a single object, so there is no `partitionRows` salvage, and the library
// exposes no score-delete method — a rejected parse leaves the caller with a
// score they can neither read back nor undo. It is the most expensive parse
// failure in this library, so the schema is deliberately the most lenient.
//
// Required means "the caller cannot use the response without it": `id` and
// `golfer_id` say which score and whose, `status` says whether it counts, and
// `adjusted_gross_score` and `differential` are the numbers a consumer does
// arithmetic with. Everything else is descriptive — a `course_name` GHIN drops
// is missing information, not wrong information, and GHIN drops keys entirely
// rather than nulling them (#46, #51, #55, #56, and LegacyCRPTeeId in #57), so
// every one of them is `.nullish()` and never a bare `.nullable()`.
//
// That leaves `adjusted_gross_score` required while `number_of_holes` and
// `number_of_played_holes` are not, which reads inconsistent — an AGS of 44 and
// one of 88 are different scores, and nothing else in the response tells them
// apart. The asymmetry is deliberate: the hole counts are echoes of the request
// the caller just made, so it already knows whether it posted 9 or 18 and an
// absent count costs it nothing, while the AGS is a number GHIN computed and
// the caller cannot reconstruct.
//
// The descriptive strings use `emptyStringToNull`, not the `string` helper:
// `string` is `z.string().trim().min(1)`, so a `""` — GHIN's ordinary "no
// message" sentinel, above all on `validation_message` — would reject the whole
// response. `course.ts` and `tee-set-rating.ts` keep the stricter bare
// `string.nullish()` because their rows sit behind `partitionRows`, where a bad
// value costs one row and surfaces through `onDegraded`. This response has no
// such salvage, so an empty string is normalized to `null` instead.
//
// The 0.15.1 carve-out in `tee-set-rating.ts` — "a zero there is a fabricated
// rating that passes a `typeof x === 'number'` guard and yields a wrong Course
// Handicap" — does not bind `course_rating` / `slope_rating` here. On this
// response they are echoes of the values just posted, not inputs to a Course
// Handicap calculation, so an absent one cannot fabricate a handicap.
const schemaScorePostResponseInner = z
  .object({
    id: number,
    golfer_id: number,
    status: schemaRawScoreStatus,
    validation_message: emptyStringToNull.nullish(),
    adjusted_gross_score: number,
    number_of_holes: number.nullish(),
    number_of_played_holes: number.nullish(),
    differential: float,
    scaled_up_differential: float.nullish(),
    adjusted_scaled_up_differential: float.nullish(),
    course_id: emptyStringToNull.nullish(),
    course_name: emptyStringToNull.nullish(),
    facility_name: emptyStringToNull.nullish(),
    played_at: emptyStringToNull.nullish(),
    tee_name: emptyStringToNull.nullish(),
    tee_set_id: emptyStringToNull.nullish(),
    course_rating: float.nullish(),
    slope_rating: float.nullish(),
    score_type: emptyStringToNull.nullish(),
    // GHIN returns this on every successful score post — Spicy Golf renders it
    // as the pending Handicap Index® — but it was undeclared until now, so it
    // reached consumers only through `.passthrough()`, untyped and untested.
    // It is a string, not a number: `"NH"` comes back for a golfer with no
    // established index, and plus golfers are expected as `"+1.2"`. The union
    // accepts a number because the wire type is unconfirmed (observed values
    // print as `15.4`) and a parse failure on this response is unrecoverable —
    // the score is already posted at GHIN, `schemaScorePostResponse` is parsed
    // as a single object with no `partitionRows` salvage, and this library
    // exposes no score-delete method. Lenient every time.
    //
    // The number branch formats to one decimal because a Handicap Index always
    // displays as `15.0`, never `15`, and this is a `_display` field consumers
    // render as-is. Strings only get trimmed — `z.string()` does not trim on its
    // own, unlike every other string here — so `"NH"` and `"+1.2"` survive
    // verbatim and no sign convention is invented on either branch.
    //
    // ponytail: `.catch(undefined)` is the only one in `src/`, and deliberate.
    // Before this field was declared, `.passthrough()` let any value of it
    // through untouched; declaring it turned `true`, `{}` and `[]` into
    // whole-response rejections. Nothing computes on this string, so degrading
    // an unexpected shape to absent is always cheaper than failing the parse of
    // a score that is already posted and cannot be deleted.
    estimated_handicap_display: z
      .union([z.string(), z.number()])
      .transform((value) => (typeof value === 'number' ? value.toFixed(1) : value.trim()))
      .nullish()
      .catch(undefined),
  })
  .passthrough()

const schemaScorePostResponse = z.object({
  score: schemaScorePostResponseInner,
})

type ScorePostResponse = z.infer<typeof schemaScorePostResponseInner>

export { schemaScorePostResponse }
export type { ScorePostResponse }
