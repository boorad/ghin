import { z } from 'zod'
import { boolean, date, number, string } from '../../../../models'
import { schemaCourseCountryCode } from './country'
import { schemaCourseSearchState } from './state'

const schemaCourseSearchRequest = z
  .object({
    country: schemaCourseCountryCode.optional(),
    facility_id: number.optional(),
    name: string.optional(),
    state: schemaCourseSearchState.optional(),
    updated_at: date.optional(),
  })
  .refine(
    ({ country, state, facility_id, updated_at, name }) => {
      switch (true) {
        case Boolean(name):
          return true
        case Boolean(country && state):
          return true
        case Boolean(facility_id):
          return true
        case Boolean(updated_at):
          return true
        default:
          return false
      }
    },
    {
      message:
        'At least one of the following are required: name, country + state, facility_id, or updated_at must be provided',
    },
  )

type CourseSearchRequest = z.infer<typeof schemaCourseSearchRequest>

const schemaTeeSetStatus = z.enum(['Active', 'Deleted', 'All'])

const schemaCourseDetailsRequest = z
  .object({
    course_id: number,
    gender: z.enum(['M', 'm', 'F', 'f']).optional(),
    number_of_holes: z.union([z.literal(9), z.literal(18)]).optional(),
    tee_set_status: schemaTeeSetStatus.optional(),
  })
  .transform((data) => ({
    ...data,
    tee_set_status: data.tee_set_status ?? ('Active' as const),
  }))

type CourseDetailsRequest = z.input<typeof schemaCourseDetailsRequest>
type TeeSetStatus = z.infer<typeof schemaTeeSetStatus>

export { schemaCourseSearchRequest, schemaCourseDetailsRequest }
export type { CourseSearchRequest, CourseDetailsRequest, TeeSetStatus }
