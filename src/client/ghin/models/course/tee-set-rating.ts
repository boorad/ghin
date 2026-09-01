import { z } from 'zod'
import { boolean, float, number, strictFloat, string } from '../../../../models'
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
  SeasonName: schemaSeasonName.nullish(),
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

// Same policy as schemaCourseDetailsResponse: only identity is required, and a
// key GHIN drops must not cost the caller the whole tee set.
const schemaTeeSetRatingCourse = z
  .object({
    CourseId: number,
    CourseStatus: schemaStatus.nullish(),
    CourseName: string,
    CourseNumber: number.nullish(),
    CourseCity: string.nullish(),
    CourseState: schemaCourseSearchState.nullish(),
  })
  .passthrough()

const schemaTeeSetRatingFacility = z
  .object({
    FacilityId: number,
    FacilityStatus: string.nullish(),
    FacilityName: string.nullish(),
    FacilityNumber: number.nullish(),
    GolfAssociationId: number.nullish(),
    GeoLocationFormattedAddress: schemaGeoAddress.nullish(),
    GeoLocationLatitude: schemaGeoCoordinate.nullish(),
    GeoLocationLongitude: schemaGeoCoordinate.nullish(),
  })
  .passthrough()

const schemaTeeSetRatingHole = z
  .object({
    HoleId: number.nullish(),
    Number: number,
    Par: number.nullish(),
    Length: number.nullish(),
    // Omitted by GHIN when StrokeAllocation is false — see schemaCourseDetailsTeeSetHole.
    Allocation: number.nullish(),
  })
  .passthrough()

// Course Rating and Slope Rating stay required — see the note on
// schemaCourseDetailsTeeSetRatings. A zero there is a fabricated rating that
// passes a `typeof x === 'number'` guard and yields a wrong Course Handicap.
// Required-ness only caught a missing key; `strictFloat` also rejects an
// explicit `null`, which plain `float` coerced to that same fabricated 0 (#63).
const schemaTeeSetRatingRating = z
  .object({
    RatingType: z.enum(['Front', 'Back', 'Total']),
    CourseRating: strictFloat,
    SlopeRating: strictFloat,
    BogeyRating: float.nullish(),
  })
  .passthrough()

const schemaTeeSetRatingResponse = z
  .object({
    Season: schemaTeeSetRatingSeason.nullish(),
    Course: schemaTeeSetRatingCourse.nullish(),
    Facility: schemaTeeSetRatingFacility.nullish(),
    TeeSetRatingId: number,
    TeeSetRatingName: string,
    // The whole point of this endpoint for us: it is the only place GHIN
    // reports whether a tee is still active. Nothing else exposes it.
    TeeSetStatus: z
      .enum(['Active', 'Inactive', 'Deleted'])
      .transform((val) => val.toLowerCase() as 'active' | 'inactive' | 'deleted')
      .nullish(),
    Gender: z.enum(['Male', 'Female', 'Mixed']).nullish(),
    HolesNumber: number.nullish(),
    TotalPar: number.nullish(),
    TotalYardage: number.nullish(),
    TotalMeters: number.nullish(),
    StrokeAllocation: boolean.nullish(),
    IsShorter: boolean.nullish(),
    // `.nullable()` permitted null but not a MISSING key, and GHIN omits it —
    // which took this whole endpoint down. Fourth occurrence of that exact
    // class, after issue #46, #51 and LegacyCRPTeeId on course details.
    LegacyCRPTeeId: number.nullish(),
    EligibleSides: z.unknown(),
    Holes: z.array(schemaTeeSetRatingHole),
    Ratings: z.array(schemaTeeSetRatingRating),
  })
  .passthrough()

type TeeSetRatingResponse = z.infer<typeof schemaTeeSetRatingResponse>

export { schemaTeeSetRatingRequest, schemaTeeSetRatingResponse }
export type { TeeSetRatingRequest, TeeSetRatingResponse }
