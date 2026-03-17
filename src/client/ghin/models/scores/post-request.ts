import { z } from 'zod'
import { boolean, gender, number, string, teeSetSide } from '../../../../models'

const schemaScorePostHoleDetail = z.object({
  hole_number: number.min(1).max(18),
  raw_score: number,
  x_hole: boolean.optional(),
})

type ScorePostHoleDetail = z.infer<typeof schemaScorePostHoleDetail>
const schemaScoreType = z.enum(['H', 'A', 'T'])
const schemaNumberOfHoles = z.enum(['9', '18'])

const schemaScorePostHbhRequest = z.object({
  golfer_id: string,
  course_id: string,
  tee_set_id: string,
  tee_set_side: teeSetSide,
  played_at: string,
  score_type: schemaScoreType,
  hole_details: z.array(schemaScorePostHoleDetail).min(1),
  number_of_holes: schemaNumberOfHoles,
  number_of_played_holes: number.optional(),
  gender,
  override_confirmation: boolean.optional(),
  is_manual: boolean.optional(),
})

type ScorePostHbhRequest = z.infer<typeof schemaScorePostHbhRequest>

const schemaScorePostAdjustedRequest = z.object({
  golfer_id: string,
  course_id: string,
  tee_set_id: string,
  tee_set_side: teeSetSide,
  played_at: string,
  score_type: schemaScoreType,
  adjusted_gross_score: number,
  number_of_holes: schemaNumberOfHoles,
  number_of_played_holes: number.optional(),
  gender,
  override_confirmation: boolean.optional(),
  is_manual: boolean.optional(),
})

type ScorePostAdjustedRequest = z.infer<typeof schemaScorePostAdjustedRequest>

const schemaScorePost18h9and9Request = z.object({
  golfer_id: string,
  course_id: string,
  tee_set_id: string,
  played_at: string,
  score_type: schemaScoreType,
  front9_adjusted: number,
  back9_adjusted: number,
  number_of_holes: z.literal('18'),
  gender,
  override_confirmation: boolean.optional(),
  is_manual: boolean.optional(),
})

type ScorePost18h9and9Request = z.infer<typeof schemaScorePost18h9and9Request>

export {
  schemaScorePost18h9and9Request,
  schemaScorePostAdjustedRequest,
  schemaScorePostHbhRequest,
  schemaScorePostHoleDetail,
}
export type { ScorePost18h9and9Request, ScorePostAdjustedRequest, ScorePostHbhRequest, ScorePostHoleDetail }
