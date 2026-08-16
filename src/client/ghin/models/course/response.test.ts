import { describe, expect, it } from 'vitest'
import { schemaCourseDetailsResponse } from './response'

describe('Course Response Schema', () => {
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
  })
})
