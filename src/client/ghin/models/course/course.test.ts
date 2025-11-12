import { describe, expect, it } from 'vitest'
import { schemaCourse } from './course'

describe('Course Schema', () => {
  describe('schemaCourse', () => {
    it('should parse a complete course with valid geolocation', () => {
      const validCourse = {
        Address1: '123 Golf Road',
        Address2: null,
        City: 'Atlanta',
        Country: 'USA',
        CourseID: 12345,
        CourseName: 'Test Golf Club',
        CourseStatus: 'Active',
        Email: 'test@example.com',
        EntCountryCode: 240,
        EntStateCode: 200011,
        FacilityID: 11807,
        FacilityName: 'Test Facility',
        FacilityStatus: 'Active',
        FullName: 'Test Facility - Test Golf Club',
        GeoLocationLatitude: 33.7756,
        GeoLocationLongitude: -84.3963,
        LegacyCRPCourseId: 29997,
        Ratings: [],
        State: 'US-GA',
        Telephone: '555-1234',
        UpdatedOn: '2018-12-06',
        Zip: '30307',
      }

      const result = schemaCourse.safeParse(validCourse)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.GeoLocationLatitude).toBe(33.7756)
        expect(result.data.GeoLocationLongitude).toBe(-84.3963)
      }
    })

    it('should handle course with missing geolocation fields (NaN issue)', () => {
      // This simulates the real API response where GeoLocationLatitude and
      // GeoLocationLongitude are missing from the JSON entirely
      const courseWithoutGeo = {
        Address1: '740 Clifton Road NE',
        Address2: null,
        City: 'Atlanta',
        Country: 'USA',
        CourseID: 13995,
        CourseName: 'Druid Hills Golf Club',
        CourseStatus: 'Active',
        Email: null,
        EntCountryCode: 240,
        EntStateCode: 200011,
        FacilityID: 11807,
        FacilityName: 'Druid Hills Golf Club',
        FacilityStatus: 'Active',
        FullName: 'Druid Hills Golf Club - Druid Hills Golf Club',
        // GeoLocationLatitude: missing
        // GeoLocationLongitude: missing
        LegacyCRPCourseId: 29997,
        Ratings: [],
        State: 'US-GA',
        Telephone: null,
        UpdatedOn: '2018-12-06',
        Zip: '30307',
      }

      const result = schemaCourse.safeParse(courseWithoutGeo)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.GeoLocationLatitude).toBe(null)
        expect(result.data.GeoLocationLongitude).toBe(null)
      }
    })

    it('should handle course with null geolocation fields', () => {
      const courseWithNullGeo = {
        Address1: '123 Golf Road',
        Address2: null,
        City: 'Atlanta',
        Country: 'USA',
        CourseID: 12345,
        CourseName: 'Test Golf Club',
        CourseStatus: 'Active',
        Email: null,
        EntCountryCode: 240,
        EntStateCode: 200011,
        FacilityID: 11807,
        FacilityName: 'Test Facility',
        FacilityStatus: 'Active',
        FullName: 'Test Facility - Test Golf Club',
        GeoLocationLatitude: null,
        GeoLocationLongitude: null,
        LegacyCRPCourseId: 29997,
        Ratings: [],
        State: 'US-GA',
        Telephone: null,
        UpdatedOn: '2018-12-06',
        Zip: '30307',
      }

      const result = schemaCourse.safeParse(courseWithNullGeo)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.GeoLocationLatitude).toBe(null)
        expect(result.data.GeoLocationLongitude).toBe(null)
      }
    })

    it('should handle course with empty string geolocation fields', () => {
      const courseWithEmptyGeo = {
        Address1: '123 Golf Road',
        Address2: null,
        City: 'Atlanta',
        Country: 'USA',
        CourseID: 12345,
        CourseName: 'Test Golf Club',
        CourseStatus: 'Active',
        Email: null,
        EntCountryCode: 240,
        EntStateCode: 200011,
        FacilityID: 11807,
        FacilityName: 'Test Facility',
        FacilityStatus: 'Active',
        FullName: 'Test Facility - Test Golf Club',
        GeoLocationLatitude: '',
        GeoLocationLongitude: '',
        LegacyCRPCourseId: 29997,
        Ratings: [],
        State: 'US-GA',
        Telephone: null,
        UpdatedOn: '2018-12-06',
        Zip: '30307',
      }

      const result = schemaCourse.safeParse(courseWithEmptyGeo)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.GeoLocationLatitude).toBe(null)
        expect(result.data.GeoLocationLongitude).toBe(null)
      }
    })

    it('should handle course with string geolocation fields', () => {
      const courseWithStringGeo = {
        Address1: '123 Golf Road',
        Address2: null,
        City: 'Atlanta',
        Country: 'USA',
        CourseID: 12345,
        CourseName: 'Test Golf Club',
        CourseStatus: 'Active',
        Email: null,
        EntCountryCode: 240,
        EntStateCode: 200011,
        FacilityID: 11807,
        FacilityName: 'Test Facility',
        FacilityStatus: 'Active',
        FullName: 'Test Facility - Test Golf Club',
        GeoLocationLatitude: '33.7756',
        GeoLocationLongitude: '-84.3963',
        LegacyCRPCourseId: 29997,
        Ratings: [],
        State: 'US-GA',
        Telephone: null,
        UpdatedOn: '2018-12-06',
        Zip: '30307',
      }

      const result = schemaCourse.safeParse(courseWithStringGeo)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.GeoLocationLatitude).toBe(33.7756)
        expect(result.data.GeoLocationLongitude).toBe(-84.3963)
      }
    })

    it('should handle course status case insensitivity', () => {
      const courseWithLowercaseStatus = {
        Address1: '123 Golf Road',
        Address2: null,
        City: 'Atlanta',
        Country: 'USA',
        CourseID: 12345,
        CourseName: 'Test Golf Club',
        CourseStatus: 'active',
        Email: null,
        EntCountryCode: 240,
        EntStateCode: 200011,
        FacilityID: 11807,
        FacilityName: 'Test Facility',
        FacilityStatus: 'inactive',
        FullName: 'Test Facility - Test Golf Club',
        GeoLocationLatitude: 33.7756,
        GeoLocationLongitude: -84.3963,
        LegacyCRPCourseId: 29997,
        Ratings: [],
        State: 'US-GA',
        Telephone: null,
        UpdatedOn: '2018-12-06',
        Zip: '30307',
      }

      const result = schemaCourse.safeParse(courseWithLowercaseStatus)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.CourseStatus).toBe('ACTIVE')
        expect(result.data.FacilityStatus).toBe('INACTIVE')
      }
    })
  })
})
