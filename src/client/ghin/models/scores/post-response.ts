import { z } from 'zod'
import { float, number, string } from '../../../../models'
import { schemaRawScoreStatus } from './score'

const schemaScorePostResponseInner = z
  .object({
    id: number,
    golfer_id: number,
    status: schemaRawScoreStatus,
    validation_message: string.nullable().optional(),
    adjusted_gross_score: number,
    number_of_holes: number,
    number_of_played_holes: number,
    differential: float,
    scaled_up_differential: float.nullable().optional(),
    adjusted_scaled_up_differential: float.nullable().optional(),
    course_id: string,
    course_name: string,
    facility_name: string,
    played_at: string,
    tee_name: string,
    tee_set_id: string,
    course_rating: float,
    slope_rating: float,
    score_type: string,
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
