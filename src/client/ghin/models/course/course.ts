import { z } from 'zod'
import { number, shortDate, string } from '../../../../models'
import { schemaGeoCoordinate } from './geolocation'

const schemaStatus = string.transform((value) => value.toUpperCase()).pipe(z.enum(['ACTIVE', 'INACTIVE']))

// GHIN omits descriptive keys entirely on `courses.search` results — Address1,
// Address2 and LegacyCRPCourseId were observed missing (not null) on every row of
// a search, which rejected the whole response. Every descriptive (non-identifying)
// field is `.nullish()` so the next key GHIN drops doesn't kill search too.
const schemaCourse = z.object({
  Address1: string.nullish(),
  Address2: string.nullish(),
  City: string.nullish(),
  Country: string.nullish(),
  CourseID: number,
  CourseName: string,
  CourseStatus: schemaStatus,
  Email: string.email().nullish(),
  EntCountryCode: number.nullish(),
  EntStateCode: number.nullish(),
  FacilityID: number,
  FacilityName: string,
  FacilityStatus: schemaStatus,
  FullName: string,
  GeoLocationLatitude: schemaGeoCoordinate.nullable(),
  GeoLocationLongitude: schemaGeoCoordinate.nullable(),
  LegacyCRPCourseId: number.nullish(),
  Ratings: z.array(z.unknown()),
  State: string.nullish(),
  Telephone: string.nullish(),
  UpdatedOn: shortDate.nullish(),
  Zip: z
    .string()
    .trim()
    .transform((zip) => zip?.trim() || null)
    .nullable()
    .or(z.array(z.unknown()))
    .nullish(),
})

type Course = z.infer<typeof schemaCourse>

export { schemaCourse }
export type { Course }
