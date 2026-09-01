import { z } from 'zod'
import { float, number, string } from '../../../../models'
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
    validation_message: string.nullish(),
    adjusted_gross_score: number,
    number_of_holes: number.nullish(),
    number_of_played_holes: number.nullish(),
    differential: float,
    scaled_up_differential: float.nullish(),
    adjusted_scaled_up_differential: float.nullish(),
    course_id: string.nullish(),
    course_name: string.nullish(),
    facility_name: string.nullish(),
    played_at: string.nullish(),
    tee_name: string.nullish(),
    tee_set_id: string.nullish(),
    course_rating: float.nullish(),
    slope_rating: float.nullish(),
    score_type: string.nullish(),
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
    estimated_handicap_display: z.union([z.string(), z.number()]).transform(String).nullish(),
  })
  .passthrough()

const schemaScorePostResponse = z.object({
  score: schemaScorePostResponseInner,
})

type ScorePostResponse = z.infer<typeof schemaScorePostResponseInner>

export { schemaScorePostResponse }
export type { ScorePostResponse }
