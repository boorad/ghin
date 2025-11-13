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
  })
})
