import { z } from 'zod'
import { float, gender, number, string } from '../../../../models'

const schemaPlayingHandicapRequest = z.object({
  golfer_id: number,
  course_id: number,
  tee_set_id: number,
  tee_set_side: z.enum(['All18', 'F9', 'B9']),
  played_at: string,
  gender,
})

type PlayingHandicapRequest = z.infer<typeof schemaPlayingHandicapRequest>

const schemaPlayingHandicapEntry = z
  .object({
    golfer_id: number,
    playing_handicap: number,
    course_handicap: float,
    handicap_index: float.nullable().optional(),
  })
  .passthrough()

type PlayingHandicapEntry = z.infer<typeof schemaPlayingHandicapEntry>

const schemaPlayingHandicapsResponse = z.object({
  playing_handicaps: z.array(schemaPlayingHandicapEntry),
})

type PlayingHandicapsResponse = z.infer<typeof schemaPlayingHandicapsResponse>

export { schemaPlayingHandicapEntry, schemaPlayingHandicapRequest, schemaPlayingHandicapsResponse }
export type { PlayingHandicapEntry, PlayingHandicapRequest, PlayingHandicapsResponse }
