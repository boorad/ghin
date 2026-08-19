import { z } from 'zod'
import { boolean, dropInvalidRows, float, monthDay, number, partitionRows, string } from '../../../../models'
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
    const { valid, invalid } = partitionRows(schemaCourseSearchRow, courses)
    return { courses: valid, invalid }
  })

type CourseSearchResponse = z.infer<typeof schemaCourseSearchResponse>

// Only the id identifies the facility. Everything else is descriptive, and
// `buildCourseFromDetails` already defaults each one, so a dropped key must not
// cost the caller the course.
const schemaCourseDetailsFacility = z
  .object({
    FacilityId: number,
    FacilityName: string.nullish(),
    FacilityNumber: number.nullish(),
    FacilityStatus: string.nullish(),
    GeoLocationFormattedAddress: schemaGeoAddress.nullish(),
    GeoLocationLatitude: schemaGeoCoordinate.nullish(),
    GeoLocationLongitude: schemaGeoCoordinate.nullish(),
    GolfAssociationId: number.nullish(),
  })
  .passthrough()

const schemaCourseDetailsSeason = z.object({
  IsAllYear: boolean.nullish(),
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

// RatingType is the key `buildTeeFromDetails` slots the numbers under, so a row
// without it is unusable — but a rating row is per-tee-set decoration, so an
// unusable row drops itself rather than the tee set (see schemaCourseDetailsTeeSet).
const schemaCourseDetailsTeeSetRatings = z
  .object({
    BogeyRating: float.nullish(),
    CourseRating: float.nullish(),
    RatingType: z.enum(['Front', 'Back', 'Total']),
    SlopeRating: float.nullish(),
  })
  .passthrough()

// `Number` is the only field that can't be defaulted — it orders the hole and is
// the stroke-index fallback when GHIN publishes no allocation. Par and Length are
// nullish because GHIN nulls them on sparsely-rated courses and
// `buildTeeFromDetails` already substitutes DEFAULT_PAR / 0.
const schemaCourseDetailsTeeSetHole = z
  .object({
    // GHIN omits Allocation entirely when the tee set reports StrokeAllocation: false
    // (common outside the US — Irish/GB&I courses). See issue #46.
    Allocation: number.nullish(),
    HoleId: number.nullish(),
    Length: number.nullish(),
    Number: number,
    Par: number.nullish(),
  })
  .passthrough()

// Required here means "the tee is unusable without it": the id we key the Tee
// CoValue on, the name a player picks from a list, and at least one hole. Every
// other field is descriptive or defaulted downstream, so GHIN dropping one must
// not cost the player a playable tee.
//
// Rating rows drop individually — a malformed Front-9 rating shouldn't cost you
// the tee, and `buildTeeFromDetails` already zero-fills the slots it doesn't find.
const schemaCourseDetailsTeeSet = z
  .object({
    EligibleSides: z.unknown(),
    Gender: z.enum(['Male', 'Female', 'Mixed']).nullish(),
    // Holes are all-or-nothing on purpose. Dropping one bad hole would hand back a
    // 17-hole tee that scores silently wrong — far worse than losing the tee and
    // saying so. A tee set with an unparseable hole fails into `invalidTeeSets`.
    Holes: z.array(schemaCourseDetailsTeeSetHole).min(1),
    HolesNumber: number.nullish(),
    IsShorter: boolean.nullish(),
    // GHIN drops this legacy CRP identifier without warning — Druid Hills (13995)
    // returned all 22 tee sets without it. It identifies nothing we use, so a
    // missing key must not reject the whole course. Same class as issue #46 and
    // the search keys in #51; `schemaTeeSetRating` already had it nullable.
    LegacyCRPTeeId: number.nullish(),
    Ratings: z.array(z.unknown()).transform(dropInvalidRows(schemaCourseDetailsTeeSetRatings)),
    StrokeAllocation: boolean.nullish(),
    TeeSetRatingId: number,
    TeeSetRatingName: string,
    TotalMeters: number.nullish(),
    TotalPar: number.nullish(),
    TotalYardage: number.nullish(),
  })
  .passthrough()

// Only the identity of the course is required. Tee sets are parsed individually
// so one malformed tee can't cost the player the other 21 — the whole failure
// mode of the 2026-08-19 Druid Hills outage, where a legacy id nothing reads
// went missing and blanked the course.
//
// `invalidTeeSets` carries the rejects out raw. Degradation is always reported:
// a silently shorter tee list reads as "this course only has 3 tees", which is
// indistinguishable from working and is exactly how an outage hides.
const schemaCourseDetailsResponse = z
  .object({
    CourseCity: string.nullish(),
    CourseId: number,
    CourseName: string,
    CourseNumber: number.nullish(),
    CourseState: schemaCourseSearchState.nullish(),
    CourseStatus: schemaStatus.nullish(),
    Facility: schemaCourseDetailsFacility.nullish(),
    Season: schemaCourseDetailsSeason.nullish(),
    TeeSets: z.array(z.unknown()),
  })
  .passthrough()
  .transform(({ TeeSets, ...course }) => {
    const { valid, invalid } = partitionRows(schemaCourseDetailsTeeSet, TeeSets)
    return { ...course, TeeSets: valid, invalidTeeSets: invalid }
  })

type CourseDetailsResponse = z.infer<typeof schemaCourseDetailsResponse>

export { schemaCourseCountriesResponse, schemaCourseDetailsResponse, schemaCourseSearchResponse }
export type { CourseCountriesResponse, CourseDetailsResponse, CourseSearchResponse }
