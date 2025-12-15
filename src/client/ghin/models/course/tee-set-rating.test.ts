import { describe, expect, it } from 'vitest'
import { schemaTeeSetRatingRequest, schemaTeeSetRatingResponse } from './tee-set-rating'

describe('TeeSetRating Schemas', () => {
  describe('schemaTeeSetRatingRequest', () => {
    it('should parse valid request with tee_set_rating_id only', () => {
      const validRequest = {
        tee_set_rating_id: 12345,
      }

      const result = schemaTeeSetRatingRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tee_set_rating_id).toBe(12345)
        expect(result.data.include_altered_tees).toBe(true)
      }
    })

    it('should parse request with include_altered_tees set to false', () => {
      const validRequest = {
        tee_set_rating_id: 12345,
        include_altered_tees: false,
      }

      const result = schemaTeeSetRatingRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.include_altered_tees).toBe(false)
      }
    })

    it('should default include_altered_tees to true', () => {
      const validRequest = {
        tee_set_rating_id: 12345,
      }

      const result = schemaTeeSetRatingRequest.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.include_altered_tees).toBe(true)
      }
    })

    it('should reject request without tee_set_rating_id', () => {
      const invalidRequest = {}

      const result = schemaTeeSetRatingRequest.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject request with invalid tee_set_rating_id type', () => {
      const invalidRequest = {
        tee_set_rating_id: 'not-a-number',
      }

      const result = schemaTeeSetRatingRequest.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  describe('schemaTeeSetRatingResponse', () => {
    const validCourse = {
      CourseId: 12345,
      CourseStatus: 'Active',
      CourseName: 'Championship Course',
      CourseNumber: 1,
      CourseCity: 'Pinehurst',
      CourseState: 'US-NC',
    }

    const validFacility = {
      FacilityId: 1,
      FacilityStatus: 'ACTIVE',
      FacilityName: 'Pinehurst Resort',
      FacilityNumber: 1,
      GolfAssociationId: 1,
      GeoLocationFormattedAddress: '123 Golf Road',
      GeoLocationLatitude: 35.1234,
      GeoLocationLongitude: -79.5678,
    }

    const validSeason = {
      SeasonName: 'Year Round',
      SeasonStartDate: '01/01',
      SeasonEndDate: '12/31',
      IsAllYear: true,
    }

    const validHole = {
      HoleId: 1,
      Number: 1,
      Par: 4,
      Length: 425,
      Allocation: 5,
    }

    const validRating = {
      RatingType: 'Total' as const,
      CourseRating: 72.5,
      SlopeRating: 135,
      BogeyRating: 95.2,
    }

    it('should parse valid tee set rating response', () => {
      const validResponse = {
        Season: validSeason,
        Course: validCourse,
        Facility: validFacility,
        TeeSetRatingId: 12345,
        TeeSetRatingName: 'Blue Tees',
        Gender: 'Male',
        HolesNumber: 18,
        TotalPar: 72,
        TotalYardage: 7200,
        TotalMeters: 6584,
        StrokeAllocation: true,
        IsShorter: false,
        LegacyCRPTeeId: 999,
        EligibleSides: null,
        Holes: [validHole],
        Ratings: [validRating],
      }

      const result = schemaTeeSetRatingResponse.safeParse(validResponse)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.TeeSetRatingId).toBe(12345)
        expect(result.data.TeeSetRatingName).toBe('Blue Tees')
        expect(result.data.Gender).toBe('Male')
        expect(result.data.HolesNumber).toBe(18)
      }
    })

    it('should parse response with null Season', () => {
      const responseWithNullSeason = {
        Season: null,
        Course: validCourse,
        Facility: validFacility,
        TeeSetRatingId: 12345,
        TeeSetRatingName: 'Blue Tees',
        Gender: 'Male',
        HolesNumber: 18,
        TotalPar: 72,
        TotalYardage: 7200,
        TotalMeters: 6584,
        StrokeAllocation: true,
        IsShorter: null,
        LegacyCRPTeeId: 999,
        EligibleSides: null,
        Holes: [],
        Ratings: [],
      }

      const result = schemaTeeSetRatingResponse.safeParse(responseWithNullSeason)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Season).toBe(null)
      }
    })

    it('should parse response with Female gender', () => {
      const responseWithFemaleGender = {
        Season: validSeason,
        Course: validCourse,
        Facility: validFacility,
        TeeSetRatingId: 12345,
        TeeSetRatingName: 'Red Tees',
        Gender: 'Female',
        HolesNumber: 18,
        TotalPar: 72,
        TotalYardage: 5800,
        TotalMeters: 5304,
        StrokeAllocation: true,
        IsShorter: false,
        LegacyCRPTeeId: 999,
        EligibleSides: null,
        Holes: [],
        Ratings: [],
      }

      const result = schemaTeeSetRatingResponse.safeParse(responseWithFemaleGender)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Gender).toBe('Female')
      }
    })

    it('should parse response with null Gender', () => {
      const responseWithNullGender = {
        Season: validSeason,
        Course: validCourse,
        Facility: validFacility,
        TeeSetRatingId: 12345,
        TeeSetRatingName: 'Forward Tees',
        Gender: null,
        HolesNumber: 18,
        TotalPar: 72,
        TotalYardage: 5500,
        TotalMeters: 5029,
        StrokeAllocation: true,
        IsShorter: true,
        LegacyCRPTeeId: 999,
        EligibleSides: null,
        Holes: [],
        Ratings: [],
      }

      const result = schemaTeeSetRatingResponse.safeParse(responseWithNullGender)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Gender).toBe(null)
      }
    })

    it('should parse response with multiple holes', () => {
      const holes = Array.from({ length: 18 }, (_, i) => ({
        HoleId: i + 1,
        Number: i + 1,
        Par: i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : 3,
        Length: 300 + i * 20,
        Allocation: ((i * 2) % 18) + 1,
      }))

      const responseWithMultipleHoles = {
        Season: validSeason,
        Course: validCourse,
        Facility: validFacility,
        TeeSetRatingId: 12345,
        TeeSetRatingName: 'Blue Tees',
        Gender: 'Male',
        HolesNumber: 18,
        TotalPar: 72,
        TotalYardage: 7200,
        TotalMeters: 6584,
        StrokeAllocation: true,
        IsShorter: false,
        LegacyCRPTeeId: 999,
        EligibleSides: null,
        Holes: holes,
        Ratings: [],
      }

      const result = schemaTeeSetRatingResponse.safeParse(responseWithMultipleHoles)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Holes).toHaveLength(18)
      }
    })

    it('should parse response with multiple ratings (Front, Back, Total)', () => {
      const ratings = [
        { RatingType: 'Front' as const, CourseRating: 35.5, SlopeRating: 130, BogeyRating: 47.2 },
        { RatingType: 'Back' as const, CourseRating: 37.0, SlopeRating: 140, BogeyRating: 48.0 },
        { RatingType: 'Total' as const, CourseRating: 72.5, SlopeRating: 135, BogeyRating: 95.2 },
      ]

      const responseWithMultipleRatings = {
        Season: validSeason,
        Course: validCourse,
        Facility: validFacility,
        TeeSetRatingId: 12345,
        TeeSetRatingName: 'Blue Tees',
        Gender: 'Male',
        HolesNumber: 18,
        TotalPar: 72,
        TotalYardage: 7200,
        TotalMeters: 6584,
        StrokeAllocation: true,
        IsShorter: false,
        LegacyCRPTeeId: 999,
        EligibleSides: null,
        Holes: [],
        Ratings: ratings,
      }

      const result = schemaTeeSetRatingResponse.safeParse(responseWithMultipleRatings)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Ratings).toHaveLength(3)
        expect(result.data.Ratings[0]?.RatingType).toBe('Front')
        expect(result.data.Ratings[1]?.RatingType).toBe('Back')
        expect(result.data.Ratings[2]?.RatingType).toBe('Total')
      }
    })

    it('should transform Season dates to MM-DD format', () => {
      const responseWithSeason = {
        Season: {
          SeasonName: 'Summer',
          SeasonStartDate: '4/15',
          SeasonEndDate: '10/31',
          IsAllYear: false,
        },
        Course: validCourse,
        Facility: validFacility,
        TeeSetRatingId: 12345,
        TeeSetRatingName: 'Blue Tees',
        Gender: 'Male',
        HolesNumber: 18,
        TotalPar: 72,
        TotalYardage: 7200,
        TotalMeters: 6584,
        StrokeAllocation: true,
        IsShorter: false,
        LegacyCRPTeeId: 999,
        EligibleSides: null,
        Holes: [],
        Ratings: [],
      }

      const result = schemaTeeSetRatingResponse.safeParse(responseWithSeason)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Season?.SeasonStartDate).toBe('04-15')
        expect(result.data.Season?.SeasonEndDate).toBe('10-31')
      }
    })

    it('should transform course status to uppercase', () => {
      const responseWithLowercaseStatus = {
        Season: null,
        Course: {
          ...validCourse,
          CourseStatus: 'active',
        },
        Facility: validFacility,
        TeeSetRatingId: 12345,
        TeeSetRatingName: 'Blue Tees',
        Gender: 'Male',
        HolesNumber: 18,
        TotalPar: 72,
        TotalYardage: 7200,
        TotalMeters: 6584,
        StrokeAllocation: true,
        IsShorter: false,
        LegacyCRPTeeId: 999,
        EligibleSides: null,
        Holes: [],
        Ratings: [],
      }

      const result = schemaTeeSetRatingResponse.safeParse(responseWithLowercaseStatus)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.Course.CourseStatus).toBe('ACTIVE')
      }
    })

    it('should reject response with invalid Gender', () => {
      const invalidResponse = {
        Season: null,
        Course: validCourse,
        Facility: validFacility,
        TeeSetRatingId: 12345,
        TeeSetRatingName: 'Blue Tees',
        Gender: 'Other',
        HolesNumber: 18,
        TotalPar: 72,
        TotalYardage: 7200,
        TotalMeters: 6584,
        StrokeAllocation: true,
        IsShorter: false,
        LegacyCRPTeeId: 999,
        EligibleSides: null,
        Holes: [],
        Ratings: [],
      }

      const result = schemaTeeSetRatingResponse.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('should reject response with invalid RatingType', () => {
      const invalidResponse = {
        Season: null,
        Course: validCourse,
        Facility: validFacility,
        TeeSetRatingId: 12345,
        TeeSetRatingName: 'Blue Tees',
        Gender: 'Male',
        HolesNumber: 18,
        TotalPar: 72,
        TotalYardage: 7200,
        TotalMeters: 6584,
        StrokeAllocation: true,
        IsShorter: false,
        LegacyCRPTeeId: 999,
        EligibleSides: null,
        Holes: [],
        Ratings: [{ RatingType: 'Invalid', CourseRating: 72.5, SlopeRating: 135, BogeyRating: 95.2 }],
      }

      const result = schemaTeeSetRatingResponse.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })
})
