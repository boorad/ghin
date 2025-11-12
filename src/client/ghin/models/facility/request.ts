import { z } from 'zod'
import { number, string } from '../../../../models'
import { schemaCourseCountryCode } from '../course/country'
import { schemaCourseSearchState } from '../course/state'

const schemaFacilitySearchRequest = z
  .object({
    country: schemaCourseCountryCode.optional(),
    facility_id: number.optional(),
    name: string.optional(),
    state: schemaCourseSearchState.optional(),
  })
  .refine(
    ({ country, state, facility_id, name }) => {
      // At least one search parameter must be provided
      return Boolean(country || state || facility_id || name)
    },
    {
      message: 'At least one search parameter must be provided: country, state, facility_id, or name',
    },
  )

type FacilitySearchRequest = z.infer<typeof schemaFacilitySearchRequest>

export { schemaFacilitySearchRequest }
export type { FacilitySearchRequest }
