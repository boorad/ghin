import { z } from 'zod'
import { boolean, float, number, string } from '../../../../models'
import { schemaGeoAddress, schemaGeoCoordinate } from './geolocation'
import { schemaSeasonDate, schemaSeasonName } from './season'
import { schemaCourseSearchState } from './state'

const schemaStatus = string.transform((value) => value.toUpperCase()).pipe(z.enum(['ACTIVE', 'INACTIVE']))

const schemaTeeSetRatingRequest = z.object({
  tee_set_rating_id: number,
  include_altered_tees: boolean.optional().default(true),
})

type TeeSetRatingRequest = z.input<typeof schemaTeeSetRatingRequest>

const schemaTeeSetRatingSeason = z.object({
  SeasonName: schemaSeasonName,
  SeasonStartDate: schemaSeasonDate.transform((value) => {
    if (!value) {
      return null
    }
    const [month, day] = value.split('/')
    return `${month?.toString().padStart(2, '0')}-${day?.toString().padStart(2, '0')}`
  }),
  SeasonEndDate: schemaSeasonDate.transform((value) => {
    if (!value) {
      return null
    }
    const [month, day] = value.split('/')
    return `${month?.toString().padStart(2, '0')}-${day?.toString().padStart(2, '0')}`
  }),
  IsAllYear: boolean,
})

const schemaTeeSetRatingCourse = z.object({
  CourseId: number,
  CourseStatus: schemaStatus,
  CourseName: string,
  CourseNumber: number.nullable(),
  CourseCity: string,
  CourseState: schemaCourseSearchState,
})

const schemaTeeSetRatingFacility = z.object({
  FacilityId: number,
  FacilityStatus: string,
  FacilityName: string,
  FacilityNumber: number.nullable(),
  GolfAssociationId: number.nullable().optional(),
  GeoLocationFormattedAddress: schemaGeoAddress.optional(),
  GeoLocationLatitude: schemaGeoCoordinate.nullable().optional(),
  GeoLocationLongitude: schemaGeoCoordinate.nullable().optional(),
})

const schemaTeeSetRatingHole = z.object({
  HoleId: number,
  Number: number,
  Par: number,
  Length: number,
  Allocation: number,
})

const schemaTeeSetRatingRating = z.object({
  RatingType: z.enum(['Front', 'Back', 'Total']),
  CourseRating: float,
  SlopeRating: float,
  BogeyRating: float,
})

const schemaTeeSetRatingResponse = z.object({
  Season: schemaTeeSetRatingSeason.nullable(),
  Course: schemaTeeSetRatingCourse,
  Facility: schemaTeeSetRatingFacility,
  TeeSetRatingId: number,
  TeeSetRatingName: string,
  TeeSetStatus: z
    .enum(['Active', 'Inactive', 'Deleted'])
    .transform((val) => val.toLowerCase() as 'active' | 'inactive' | 'deleted')
    .optional(),
  Gender: z.enum(['Male', 'Female', 'Mixed']).nullable(),
  HolesNumber: number,
  TotalPar: number,
  TotalYardage: number,
  TotalMeters: number,
  StrokeAllocation: boolean,
  IsShorter: boolean.nullable(),
  LegacyCRPTeeId: number.nullable(),
  EligibleSides: z.unknown(),
  Holes: z.array(schemaTeeSetRatingHole),
  Ratings: z.array(schemaTeeSetRatingRating),
})

type TeeSetRatingResponse = z.infer<typeof schemaTeeSetRatingResponse>

export { schemaTeeSetRatingRequest, schemaTeeSetRatingResponse }
export type { TeeSetRatingRequest, TeeSetRatingResponse }
