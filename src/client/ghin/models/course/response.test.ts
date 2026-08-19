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
})
