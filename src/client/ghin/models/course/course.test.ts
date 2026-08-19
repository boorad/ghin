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

    // GHIN omits descriptive keys entirely on search results — Address1, Address2
    // and LegacyCRPCourseId were all absent (not null) on every row of a search.
    it('should handle course with descriptive keys omitted entirely', () => {
      const courseWithoutAddress = {
        // Address1: missing
        // Address2: missing
        // City, Country, Email, EntCountryCode, EntStateCode, State, Telephone,
        // UpdatedOn, Zip: missing
        CourseID: 13995,
        CourseName: 'Druid Hills Golf Club',
        CourseStatus: 'Active',
        FacilityID: 11807,
        FacilityName: 'Druid Hills Golf Club',
        FacilityStatus: 'Active',
        FullName: 'Druid Hills Golf Club - Druid Hills Golf Club',
        GeoLocationLatitude: 33.7756,
        GeoLocationLongitude: -84.3963,
        // LegacyCRPCourseId: missing
        Ratings: [],
      }

      const result = schemaCourse.safeParse(courseWithoutAddress)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Address1).toBeUndefined()
        expect(result.data.Address2).toBeUndefined()
        expect(result.data.LegacyCRPCourseId).toBeUndefined()
        expect(result.data.CourseName).toBe('Druid Hills Golf Club')
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
  // Production regression: GHIN returned "www.parkview18.com" in Email for
  // Parkview Fairways (course 3363). `.email()` rejected the row, so a real,
  // playable course disappeared from search results over a field nothing reads.
  // Found by the onDegraded reporter within hours of it shipping.
  it('should accept a non-email value in Email', () => {
    const result = schemaCourse.safeParse({
      CourseID: 3363,
      CourseName: 'Parkview Fairways Golf Course',
      CourseStatus: 'Active',
      FacilityID: 3196,
      FacilityName: 'Parkview Fairways Golf Course',
      FacilityStatus: 'Active',
      FullName: 'Parkview Fairways Golf Course - Parkview Fairways Golf Course',
      GeoLocationLatitude: 42.9292,
      GeoLocationLongitude: -77.4206,
      Email: 'www.parkview18.com',
      Ratings: [],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.Email).toBe('www.parkview18.com')
    }
  })
})
