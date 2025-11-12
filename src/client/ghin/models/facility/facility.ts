import { z } from 'zod'
import { number, shortDate, string } from '../../../../models'
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
  Address1: string.nullable().optional(),
  Address2: string.nullable().optional(),
  Associations: z.array(z.unknown()).optional(),
  City: string.nullable(),
  Country: string.nullable(),
  Courses: z.array(schemaFacilityCourse).optional(),
  Email: string.email().nullable().optional(),
  EntCountryCode: number.nullable(),
  EntStateCode: number.nullable(),
  FacilityId: number,
  FacilityName: string,
  FacilityStatus: schemaStatus,
  GeoLocationLatitude: schemaGeoCoordinate.nullable().optional(),
  GeoLocationLongitude: schemaGeoCoordinate.nullable().optional(),
  State: string.nullable(),
  Telephone: string.nullable().optional(),
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
