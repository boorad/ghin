import { z } from 'zod'
import { emptyStringToNull, number, shortDate, string } from '../../../../models'
import { schemaGeoCoordinate } from '../course/geolocation'

const schemaStatus = string.transform((value) => value.toUpperCase()).pipe(z.enum(['ACTIVE', 'INACTIVE']))

const schemaFacilityCourse = z.object({
  CourseId: number,
  CourseStatus: schemaStatus,
  CourseName: string,
  NumberOfHoles: number,
})

type FacilityCourse = z.infer<typeof schemaFacilityCourse>

const schemaFacility = z.object({
  Address1: emptyStringToNull.optional(),
  Address2: emptyStringToNull.optional(),
  Associations: z.array(z.unknown()).optional(),
  City: emptyStringToNull,
  Country: emptyStringToNull,
  Courses: z.array(schemaFacilityCourse).optional(),
  // Not validated — see the note on schemaCourse.Email. GHIN stores websites
  // and free text here, and a bad value must not cost the caller the facility.
  Email: emptyStringToNull.nullish(),
  EntCountryCode: number.nullable(),
  EntStateCode: number.nullable(),
  FacilityId: number,
  FacilityName: string,
  FacilityStatus: schemaStatus,
  GeoLocationLatitude: schemaGeoCoordinate.nullable().optional(),
  GeoLocationLongitude: schemaGeoCoordinate.nullable().optional(),
  State: emptyStringToNull,
  Telephone: emptyStringToNull.optional(),
  UpdatedOn: shortDate.nullable().optional(),
  Zip: z
    .string()
    .trim()
    .transform((zip) => zip?.trim() || null)
    .nullable()
    .optional()
    .or(z.array(z.unknown())),
})

type Facility = z.infer<typeof schemaFacility>

export { schemaFacility, schemaFacilityCourse }
export type { Facility, FacilityCourse }
