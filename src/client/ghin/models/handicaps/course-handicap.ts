import { z } from 'zod'
import { float, gender, number, string } from '../../../../models'

const schemaCourseHandicapGetRequest = z.object({
  golfer_id: number,
  course_id: number,
  tee_set_id: number,
  tee_set_side: z.enum(['All18', 'F9', 'B9']),
  played_at: string,
  gender,
})

type CourseHandicapGetRequest = z.infer<typeof schemaCourseHandicapGetRequest>

const schemaCourseHandicapEntry = z
  .object({
    golfer_id: number,
    course_handicap: float,
    handicap_index: float.nullable().optional(),
  })
  .passthrough()

type CourseHandicapEntry = z.infer<typeof schemaCourseHandicapEntry>

const schemaCourseHandicapsGetResponse = z.object({
  course_handicaps: z.array(schemaCourseHandicapEntry),
})

type CourseHandicapsGetResponse = z.infer<typeof schemaCourseHandicapsGetResponse>

export { schemaCourseHandicapEntry, schemaCourseHandicapGetRequest, schemaCourseHandicapsGetResponse }
export type { CourseHandicapEntry, CourseHandicapGetRequest, CourseHandicapsGetResponse }
