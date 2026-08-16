import { z } from 'zod'
import { boolean, float, monthDay, number, string } from '../../../../models'
import { schemaCourseCountry } from './country'
import { schemaCourse } from './course'
import { schemaGeoAddress, schemaGeoCoordinate } from './geolocation'
import { schemaSeasonDate, schemaSeasonName } from './season'
import { schemaCourseSearchState } from './state'

const schemaStatus = string.transform((value) => value.toUpperCase()).pipe(z.enum(['ACTIVE', 'INACTIVE']))

const schemaCourseCountriesResponse = z.object({
  countries: z.array(schemaCourseCountry.passthrough()),
})

type CourseCountriesResponse = z.infer<typeof schemaCourseCountriesResponse>

// GHIN drops keys from search results without warning (see schemaCourse). A single
// malformed row used to reject the entire array and 500 the caller, so rows are
// parsed individually now — the good ones come back in `courses`, the rejects come
// back raw in `invalid` so callers can log what GHIN actually sent.
const schemaCourseSearchRow = schemaCourse.passthrough()

const schemaCourseSearchResponse = z
  .object({
    courses: z.array(z.unknown()),
  })
  .transform(({ courses }) => {
    const valid: z.infer<typeof schemaCourseSearchRow>[] = []
    const invalid: unknown[] = []

    for (const row of courses) {
      const result = schemaCourseSearchRow.safeParse(row)
      if (result.success) {
        valid.push(result.data)
      } else {
        invalid.push(row)
      }
    }

    return { courses: valid, invalid }
  })

type CourseSearchResponse = z.infer<typeof schemaCourseSearchResponse>

const schemaCourseDetailsFacility = z.object({
  FacilityId: number,
  FacilityName: string,
  FacilityNumber: number.nullable(),
  FacilityStatus: string,
  GeoLocationFormattedAddress: schemaGeoAddress,
  GeoLocationLatitude: schemaGeoCoordinate.nullable(),
  GeoLocationLongitude: schemaGeoCoordinate.nullable(),
  GolfAssociationId: number.nullable(),
})

const schemaCourseDetailsSeason = z.object({
  IsAllYear: boolean,
  SeasonEndDate: schemaSeasonDate.transform((value) => {
    if (!value) {
      return null
    }
    const [month, day] = value.split('/')
    return `${month?.toString().padStart(2, '0')}-${day?.toString().padStart(2, '0')}`
  }),
  SeasonName: schemaSeasonName,
  SeasonStartDate: schemaSeasonDate.transform((value) => {
    if (!value) {
      return null
    }
    const [month, day] = value.split('/')
    return `${month?.toString().padStart(2, '0')}-${day?.toString().padStart(2, '0')}`
  }),
})

const schemaCourseDetailsTeeSetRatings = z.object({
  BogeyRating: float,
  CourseRating: float,
  RatingType: z.enum(['Front', 'Back', 'Total']),
  SlopeRating: float,
})

const schemaCourseDetailsTeeSetHole = z.object({
  // GHIN omits Allocation entirely when the tee set reports StrokeAllocation: false
  // (common outside the US — Irish/GB&I courses). See issue #46.
  Allocation: number.nullish(),
  HoleId: number,
  Length: number,
  Number: number,
  Par: number,
})

const schemaCourseDetailsTeeSet = z.object({
  EligibleSides: z.unknown(),
  Gender: z.enum(['Male', 'Female', 'Mixed']).nullable(),
  Holes: z.array(schemaCourseDetailsTeeSetHole),
  HolesNumber: number,
  IsShorter: boolean.nullable(),
  LegacyCRPTeeId: number,
  Ratings: z.array(schemaCourseDetailsTeeSetRatings),
  StrokeAllocation: boolean,
  TeeSetRatingId: number,
  TeeSetRatingName: string,
  TotalMeters: number,
  TotalPar: number,
  TotalYardage: number,
})

const schemaCourseDetailsResponse = z.object({
  CourseCity: string,
  CourseId: number,
  CourseName: string,
  CourseNumber: number.nullable(),
  CourseState: schemaCourseSearchState,
  CourseStatus: schemaStatus,
  Facility: schemaCourseDetailsFacility,
  Season: schemaCourseDetailsSeason.nullable(),
  TeeSets: z.array(schemaCourseDetailsTeeSet),
})

type CourseDetailsResponse = z.infer<typeof schemaCourseDetailsResponse>

export { schemaCourseCountriesResponse, schemaCourseDetailsResponse, schemaCourseSearchResponse }
export type { CourseCountriesResponse, CourseDetailsResponse, CourseSearchResponse }
