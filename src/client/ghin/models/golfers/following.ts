import { z } from 'zod'
import { number, string } from '../../../../models'

const schemaFollowingGolfer = z.object({
  ghin: number,
  first_name: string,
  last_name: string,
  email: z.string().email().nullable().optional(),
  status: string,
  handicap_index: z.union([z.number(), z.string()]).nullable().optional(),
  association_id: number.nullable().optional(),
  association_name: string.nullable().optional(),
  club_id: number.nullable().optional(),
  club_name: string.nullable().optional(),
  state: string.nullable().optional(),
  country: string.nullable().optional(),
})

const schemaFollowingResponse = z.object({
  golfers: z.array(schemaFollowingGolfer),
})

type FollowingGolfer = z.infer<typeof schemaFollowingGolfer>
type FollowingResponse = z.infer<typeof schemaFollowingResponse>

export { schemaFollowingGolfer, schemaFollowingResponse }
export type { FollowingGolfer, FollowingResponse }
