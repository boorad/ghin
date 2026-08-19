import { describe, expect, it } from 'vitest'
import { schemaCourseDetailsResponse, schemaCourseSearchResponse } from './response'

describe('Course Response Schema', () => {
  describe('schemaCourseSearchResponse', () => {
    // GHIN omits Address1/Address2/LegacyCRPCourseId on search results; every row
    // failing meant the whole array was rejected and course search 500'd.
    it('should parse a courses array whose rows omit the address keys', () => {
      const searchResponse = {
        courses: [
          {
            City: 'Atlanta',
            CourseID: 13995,
            CourseName: 'Druid Hills Golf Club',
            CourseStatus: 'Active',
            FacilityID: 11807,
            FacilityName: 'Druid Hills Golf Club',
            FacilityStatus: 'Active',
            FullName: 'Druid Hills Golf Club - Druid Hills Golf Club',
            GeoLocationLatitude: 33.7756,
            GeoLocationLongitude: -84.3963,
            Ratings: [],
          },
        ],
      }

      const result = schemaCourseSearchResponse.safeParse(searchResponse)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.courses).toHaveLength(1)
        expect(result.data.courses[0]?.Address1).toBeUndefined()
        expect(result.data.courses[0]?.CourseID).toBe(13995)
        expect(result.data.invalid).toEqual([])
      }
    })

    it('should drop rows that fail validation and return them raw in invalid', () => {
      const goodCourse = {
        CourseID: 13995,
        CourseName: 'Druid Hills Golf Club',
        CourseStatus: 'Active',
        FacilityID: 11807,
        FacilityName: 'Druid Hills Golf Club',
        FacilityStatus: 'Active',
        FullName: 'Druid Hills Golf Club - Druid Hills Golf Club',
        Ratings: [],
      }
      // CourseName is load-bearing — a row missing it is genuinely unusable.
      const badCourse = { ...goodCourse, CourseID: 999, CourseName: undefined }

      const result = schemaCourseSearchResponse.safeParse({ courses: [goodCourse, badCourse] })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.courses).toHaveLength(1)
        expect(result.data.courses[0]?.CourseID).toBe(13995)
        expect(result.data.invalid).toEqual([badCourse])
      }
    })
  })

  describe('schemaCourseDetailsResponse', () => {
    it('should parse course details with valid Season', () => {
      const validCourseDetails = {
        CourseCity: 'Village of Pinehurst',
        CourseId: 12345,
        CourseName: 'No. 4',
        CourseNumber: 1,
        CourseState: 'US-NC',
        CourseStatus: 'ACTIVE',
        Facility: {
          FacilityId: 1,
          FacilityName: 'Pinehurst Resort',
          FacilityNumber: 1,
          FacilityStatus: 'ACTIVE',
          GeoLocationFormattedAddress: '123 Golf Road',
          GeoLocationLatitude: 35.1234,
          GeoLocationLongitude: -79.5678,
          GolfAssociationId: 1,
        },
        Season: {
          IsAllYear: true,
          SeasonEndDate: '12/31',
          SeasonName: 'Year Round',
          SeasonStartDate: '01/01',
        },
        TeeSets: [],
      }

      const result = schemaCourseDetailsResponse.safeParse(validCourseDetails)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Season).not.toBe(null)
        expect(result.data.Season?.SeasonName).toBe('Year Round')
        expect(result.data.Season?.SeasonStartDate).toBe('01-01')
        expect(result.data.Season?.SeasonEndDate).toBe('12-31')
      }
    })

    it('should handle course details with null Season', () => {
      const courseDetailsWithNullSeason = {
        CourseCity: 'Village of Pinehurst',
        CourseId: 12345,
        CourseName: 'No. 4',
        CourseNumber: 1,
        CourseState: 'US-NC',
        CourseStatus: 'ACTIVE',
        Facility: {
          FacilityId: 1,
          FacilityName: 'Pinehurst Resort',
          FacilityNumber: 1,
          FacilityStatus: 'ACTIVE',
          GeoLocationFormattedAddress: '123 Golf Road',
          GeoLocationLatitude: 35.1234,
          GeoLocationLongitude: -79.5678,
          GolfAssociationId: 1,
        },
        Season: null,
        TeeSets: [],
      }

      const result = schemaCourseDetailsResponse.safeParse(courseDetailsWithNullSeason)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Season).toBe(null)
      }
    })

    it('should handle course details with Season containing null date fields', () => {
      const courseDetailsWithNullDates = {
        CourseCity: 'Village of Pinehurst',
        CourseId: 12345,
        CourseName: 'No. 4',
        CourseNumber: 1,
        CourseState: 'US-NC',
        CourseStatus: 'ACTIVE',
        Facility: {
          FacilityId: 1,
          FacilityName: 'Pinehurst Resort',
          FacilityNumber: 1,
          FacilityStatus: 'ACTIVE',
          GeoLocationFormattedAddress: '123 Golf Road',
          GeoLocationLatitude: 35.1234,
          GeoLocationLongitude: -79.5678,
          GolfAssociationId: 1,
        },
        Season: {
          IsAllYear: true,
          SeasonEndDate: null,
          SeasonName: 'Year Round',
          SeasonStartDate: null,
        },
        TeeSets: [],
      }

      const result = schemaCourseDetailsResponse.safeParse(courseDetailsWithNullDates)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Season).not.toBe(null)
        expect(result.data.Season?.SeasonStartDate).toBe(null)
        expect(result.data.Season?.SeasonEndDate).toBe(null)
      }
    })

    it('should handle course details with Season containing empty string date fields', () => {
      const courseDetailsWithEmptyDates = {
        CourseCity: 'Village of Pinehurst',
        CourseId: 12345,
        CourseName: 'No. 4',
        CourseNumber: 1,
        CourseState: 'US-NC',
        CourseStatus: 'ACTIVE',
        Facility: {
          FacilityId: 1,
          FacilityName: 'Pinehurst Resort',
          FacilityNumber: 1,
          FacilityStatus: 'ACTIVE',
          GeoLocationFormattedAddress: '123 Golf Road',
          GeoLocationLatitude: 35.1234,
          GeoLocationLongitude: -79.5678,
          GolfAssociationId: 1,
        },
        Season: {
          IsAllYear: false,
          SeasonEndDate: '',
          SeasonName: 'Summer',
          SeasonStartDate: '',
        },
        TeeSets: [],
      }

      const result = schemaCourseDetailsResponse.safeParse(courseDetailsWithEmptyDates)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Season).not.toBe(null)
        expect(result.data.Season?.SeasonStartDate).toBe(null)
        expect(result.data.Season?.SeasonEndDate).toBe(null)
      }
    })

    // Issue #46: GB&I courses report StrokeAllocation: false and omit the per-hole
    // Allocation key. St. Patrick's Links (31291), tee set Granite.
    it('should parse a tee set whose holes omit Allocation', () => {
      const courseDetailsWithoutAllocation = {
        CourseCity: 'Downings',
        CourseId: 31291,
        CourseName: "St. Patrick's Links",
        CourseNumber: 1,
        CourseState: 'IE-DL',
        CourseStatus: 'ACTIVE',
        Facility: {
          FacilityId: 1,
          FacilityName: 'Rosapenna Hotel & Golf Resort',
          FacilityNumber: 1,
          FacilityStatus: 'ACTIVE',
          GeoLocationFormattedAddress: 'Downings, Co. Donegal',
          GeoLocationLatitude: 55.1901,
          GeoLocationLongitude: -7.8342,
          GolfAssociationId: 1,
        },
        Season: null,
        TeeSets: [
          {
            EligibleSides: null,
            Gender: 'Male',
            Holes: [
              { Number: 1, HoleId: 3915428, Length: 345, Par: 4 },
              { Number: 2, HoleId: 3915429, Length: 339, Par: 4 },
            ],
            HolesNumber: 18,
            IsShorter: false,
            LegacyCRPTeeId: 999,
            Ratings: [{ RatingType: 'Total', CourseRating: 68.7, SlopeRating: 121, BogeyRating: 91.1 }],
            StrokeAllocation: false,
            TeeSetRatingId: 612076,
            TeeSetRatingName: 'Granite',
            TotalMeters: 5412,
            TotalPar: 71,
            TotalYardage: 5919,
          },
        ],
      }

      const result = schemaCourseDetailsResponse.safeParse(courseDetailsWithoutAllocation)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.TeeSets[0]?.Holes[0]?.Allocation).toBeUndefined()
        expect(result.data.TeeSets[0]?.Holes[0]?.Par).toBe(4)
      }
    })

    // GHIN stopped sending LegacyCRPTeeId on Druid Hills (13995) — all 22 tee sets
    // lost the key at once, and `number` is z.coerce.number(), so an absent key
    // coerces to NaN and rejected the entire response with a ValidationError.
    it.each([
      [
        'omits',
        (teeSet: Record<string, unknown>) => {
          const { LegacyCRPTeeId: _omitted, ...rest } = teeSet
          return rest
        },
      ],
      ['nulls', (teeSet: Record<string, unknown>) => ({ ...teeSet, LegacyCRPTeeId: null })],
    ])('should parse a tee set that %s LegacyCRPTeeId', (_label, mutate) => {
      const teeSet = {
        EligibleSides: null,
        Gender: 'Male',
        Holes: [{ Allocation: 1, Number: 1, HoleId: 3915428, Length: 345, Par: 4 }],
        HolesNumber: 18,
        IsShorter: false,
        LegacyCRPTeeId: 999,
        Ratings: [{ RatingType: 'Total', CourseRating: 68.7, SlopeRating: 121, BogeyRating: 91.1 }],
        StrokeAllocation: true,
        TeeSetRatingId: 612076,
        TeeSetRatingName: 'Blue',
        TotalMeters: 5412,
        TotalPar: 71,
        TotalYardage: 5919,
      }

      const result = schemaCourseDetailsResponse.safeParse({
        CourseCity: 'Atlanta',
        CourseId: 13995,
        CourseName: 'Druid Hills Golf Club',
        CourseNumber: 1,
        CourseState: 'US-GA',
        CourseStatus: 'ACTIVE',
        Facility: {
          FacilityId: 1,
          FacilityName: 'Druid Hills Golf Club',
          FacilityNumber: 1,
          FacilityStatus: 'ACTIVE',
          GeoLocationFormattedAddress: 'Atlanta, GA',
          GeoLocationLatitude: 33.7748,
          GeoLocationLongitude: -84.3373,
          GolfAssociationId: 1,
        },
        Season: null,
        TeeSets: [mutate(teeSet)],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.TeeSets).toHaveLength(1)
        expect(result.data.TeeSets[0]?.TeeSetRatingName).toBe('Blue')
        expect(result.data.TeeSets[0]?.LegacyCRPTeeId ?? null).toBe(null)
      }
    })
  })

  describe('schemaCourseDetailsResponse leniency', () => {
    // A tee set carrying only what makes it usable: an id to key the CoValue on,
    // a name to pick from a list, and holes to score. Every other GHIN key is
    // absent — the shape we'd get if they dropped the lot tomorrow.
    const minimalTeeSet = {
      TeeSetRatingId: 612076,
      TeeSetRatingName: 'Blue',
      Holes: [
        { Number: 1, HoleId: 1, Length: 345, Par: 4 },
        { Number: 2, HoleId: 2, Length: 339, Par: 4 },
      ],
      Ratings: [{ RatingType: 'Total', CourseRating: 68.7, SlopeRating: 121, BogeyRating: 91.1 }],
    }

    const minimalCourse = (teeSets: unknown[]) => ({
      CourseId: 13995,
      CourseName: 'Druid Hills Golf Club',
      TeeSets: teeSets,
    })

    it('should parse a course carrying only CourseId, CourseName and tee sets', () => {
      const result = schemaCourseDetailsResponse.safeParse(minimalCourse([minimalTeeSet]))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.TeeSets).toHaveLength(1)
        expect(result.data.invalidTeeSets).toHaveLength(0)
        expect(result.data.TeeSets[0]?.TeeSetRatingName).toBe('Blue')
      }
    })

    // The 2026-08-19 shape generalized: whatever GHIN drops next, the tees that
    // still parse must reach the player.
    it('should keep the good tee sets and report the bad ones separately', () => {
      const unusable = { TeeSetRatingName: 'No Id', Holes: [{ Number: 1 }] }
      const result = schemaCourseDetailsResponse.safeParse(
        minimalCourse([minimalTeeSet, unusable, { ...minimalTeeSet, TeeSetRatingId: 99 }]),
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.TeeSets.map((t) => t.TeeSetRatingId)).toEqual([612076, 99])
        expect(result.data.invalidTeeSets).toEqual([unusable])
      }
    })

    // Dropping the bad hole instead would hand back a 17-hole tee that scores
    // silently wrong. Losing the tee is recoverable; a wrong scorecard is not.
    it('should reject the whole tee set when a hole is unparseable, not just that hole', () => {
      const brokenHole = {
        ...minimalTeeSet,
        Holes: [
          { Number: 1, HoleId: 1, Length: 345, Par: 4 },
          { HoleId: 2, Length: 339 },
        ],
      }
      const result = schemaCourseDetailsResponse.safeParse(minimalCourse([brokenHole]))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.TeeSets).toHaveLength(0)
        expect(result.data.invalidTeeSets).toEqual([brokenHole])
      }
    })

    // Course Rating and Slope Rating ARE the rating. Defaulting a missing one to
    // zero produced a confidently wrong Course Handicap rather than "unavailable",
    // because 0 passes the `typeof x === 'number'` guard downstream. Losing the
    // tee is recoverable; a fabricated handicap is not.
    it.each([
      ['CourseRating', { RatingType: 'Total', SlopeRating: 121 }],
      ['SlopeRating', { RatingType: 'Total', CourseRating: 68.7 }],
    ])('should reject the tee set when a rating row omits %s', (_label, rating) => {
      const teeSet = { ...minimalTeeSet, Ratings: [rating] }
      const result = schemaCourseDetailsResponse.safeParse(minimalCourse([teeSet]))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.TeeSets).toHaveLength(0)
        expect(result.data.invalidTeeSets).toEqual([teeSet])
      }
    })

    // Bogey Rating is absent from the Course Handicap formula, so a tee without
    // one is still perfectly playable — it must not cost the player the tee.
    it('should keep a tee set whose rating omits BogeyRating', () => {
      const result = schemaCourseDetailsResponse.safeParse(
        minimalCourse([{ ...minimalTeeSet, Ratings: [{ RatingType: 'Total', CourseRating: 68.7, SlopeRating: 121 }] }]),
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.TeeSets).toHaveLength(1)
        expect(result.data.TeeSets[0]?.Ratings[0]?.CourseRating).toBe(68.7)
        expect(result.data.TeeSets[0]?.Ratings[0]?.BogeyRating ?? null).toBe(null)
      }
    })

    it('should preserve unknown keys GHIN adds rather than stripping them', () => {
      const result = schemaCourseDetailsResponse.safeParse({
        ...minimalCourse([{ ...minimalTeeSet, SomeNewTeeKey: 'tee' }]),
        SomeNewCourseKey: 'course',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        const passthrough = result.data as unknown as {
          SomeNewCourseKey?: string
          TeeSets: { SomeNewTeeKey?: string }[]
        }
        expect(passthrough.SomeNewCourseKey).toBe('course')
        expect(passthrough.TeeSets[0]?.SomeNewTeeKey).toBe('tee')
      }
    })

    // A course with no id or name is genuinely unusable — leniency has a floor,
    // and this is it.
    it('should still reject a course with no identity', () => {
      expect(schemaCourseDetailsResponse.safeParse({ TeeSets: [] }).success).toBe(false)
    })
  })
})
