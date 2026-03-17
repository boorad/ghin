import { z } from 'zod'
import { boolean, float, number, string } from '../../../../models'

const schemaTeeSetRatingForScorePostingRequest = z.object({
  course_id: number,
})

type TeeSetRatingForScorePostingRequest = z.infer<typeof schemaTeeSetRatingForScorePostingRequest>

const schemaTeeSetRatingForScorePostingEntry = z
  .object({
    tee_set_id: number,
    tee_name: string,
    gender: string,
    course_rating: float,
    slope_rating: float,
    bogey_rating: float.nullable().optional(),
    par: number,
    holes_number: number,
    tee_set_side: string,
  })
  .passthrough()

type TeeSetRatingForScorePostingEntry = z.infer<typeof schemaTeeSetRatingForScorePostingEntry>

const schemaTeeSetRatingsForScorePostingResponse = z.object({
  tee_set_ratings: z.array(schemaTeeSetRatingForScorePostingEntry),
})

type TeeSetRatingsForScorePostingResponse = z.infer<typeof schemaTeeSetRatingsForScorePostingResponse>

export {
  schemaTeeSetRatingForScorePostingEntry,
  schemaTeeSetRatingForScorePostingRequest,
  schemaTeeSetRatingsForScorePostingResponse,
}
export type {
  TeeSetRatingForScorePostingEntry,
  TeeSetRatingForScorePostingRequest,
  TeeSetRatingsForScorePostingResponse,
}
