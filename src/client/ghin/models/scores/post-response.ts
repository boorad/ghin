import { z } from 'zod'
import { float, number, string } from '../../../../models'

const schemaScorePostResponse = z
  .object({
    id: number,
    golfer_id: number,
    status: z.enum(['Validated', 'UnderReview']),
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
  })
  .passthrough()

type ScorePostResponse = z.infer<typeof schemaScorePostResponse>

export { schemaScorePostResponse }
export type { ScorePostResponse }
