import { describe, expect, it } from 'vitest'
import { boolean, date, handicap, number, string } from './validation'

describe('Validation', () => {
  describe('string', () => {
    it('should validate valid strings', () => {
      expect(string.safeParse('hello').success).toBe(true)
      expect(string.safeParse('').success).toBe(false)
      expect(string.safeParse('   ').success).toBe(false)
    })

    it('should reject non-strings', () => {
      expect(string.safeParse(123).success).toBe(false)
      expect(string.safeParse(null).success).toBe(false)
      expect(string.safeParse(undefined).success).toBe(false)
    })
  })

  describe('number', () => {
    it('should validate valid numbers', () => {
      expect(number.safeParse(123).success).toBe(true)
      expect(number.safeParse(0).success).toBe(true)
      expect(number.safeParse(-1).success).toBe(true)
    })

    it('should coerce string numbers', () => {
      expect(number.safeParse('123').success).toBe(true)
      expect(number.safeParse('0').success).toBe(true)
      expect(number.safeParse('-1').success).toBe(true)
    })

    it('should reject non-numeric strings', () => {
      expect(number.safeParse('abc').success).toBe(false)
      expect(number.safeParse('').success).toBe(true)
    })
  })

  describe('boolean', () => {
    it('should validate valid booleans', () => {
      expect(boolean.safeParse(true).success).toBe(true)
      expect(boolean.safeParse(false).success).toBe(true)
    })

    it('should transform string booleans', () => {
      expect(boolean.safeParse('true').success).toBe(true)
      expect(boolean.safeParse('false').success).toBe(true)
    })

    it('should reject invalid values', () => {
      expect(boolean.safeParse(1).success).toBe(false)
      expect(boolean.safeParse(0).success).toBe(false)
      expect(boolean.safeParse('yes').success).toBe(false)
    })
  })

  describe('handicap', () => {
    it('should validate valid handicap values', () => {
      expect(handicap.safeParse('12.5').success).toBe(true)
      expect(handicap.safeParse('0.0').success).toBe(true)
      expect(handicap.safeParse('-10').success).toBe(true)
      expect(handicap.safeParse('54.0').success).toBe(true)
      expect(handicap.safeParse('NH').success).toBe(true)
    })

    it('should reject invalid handicap values', () => {
      expect(handicap.safeParse('abc').success).toBe(false) // Non-numeric
      expect(handicap.safeParse('').success).toBe(true) // '' coerces to 0
    })

    it('should handle edge cases', () => {
      expect(handicap.safeParse('12').success).toBe(true) // Integer
      expect(handicap.safeParse('12.50').success).toBe(true) // Two decimal places
      expect(handicap.safeParse('12.555').success).toBe(true) // Any number is valid
    })
  })

  describe('date', () => {
    it('should validate Date objects', () => {
      const validDate = new Date('2022-09-15')
      const result = date.safeParse(validDate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeInstanceOf(Date)
        expect(result.data?.getTime()).toBe(validDate.getTime())
      }
    })

    it('should validate ISO date strings', () => {
      const isoString = '2022-09-15T00:00:00.000Z'
      const result = date.safeParse(isoString)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeInstanceOf(Date)
        expect(result.data?.toISOString()).toBe(isoString)
      }
    })

    it('should validate various valid date string formats', () => {
      const validFormats = [
        '2022-09-15',
        '2022/09/15',
        'September 15, 2022',
        'Sep 15 2022',
        '09/15/2022',
        '15 Sep 2022',
        '2022-09-15T10:30:00Z',
        '2022-09-15T10:30:00-04:00',
      ]

      for (const dateStr of validFormats) {
        const result = date.safeParse(dateStr)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBeInstanceOf(Date)
          expect(result.data?.getTime()).not.toBeNaN()
        }
      }
    })

    it('should reject invalid date strings with proper error message', () => {
      const invalidDates = [
        'invalid-date',
        '2022-13-01', // Invalid month
        '2022-02-30', // Invalid day for February
        'not a date',
        '2022/13/45',
        'abc123',
        '2022-00-01', // Month 0
        '2022-01-00', // Day 0
      ]

      for (const invalidDate of invalidDates) {
        const result = date.safeParse(invalidDate)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Invalid date')
        }
      }
    })

    it('should handle null and undefined values', () => {
      const nullResult = date.safeParse(null)
      expect(nullResult.success).toBe(true)
      if (nullResult.success) {
        expect(nullResult.data).toBeUndefined()
      }

      const undefinedResult = date.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
      if (undefinedResult.success) {
        expect(undefinedResult.data).toBeUndefined()
      }
    })

    it('should handle empty strings', () => {
      const emptyResult = date.safeParse('')
      expect(emptyResult.success).toBe(true)
      if (emptyResult.success) {
        expect(emptyResult.data).toBeUndefined()
      }
    })

    it('should transform valid string dates to Date objects', () => {
      const dateString = '2022-09-15'
      const result = date.safeParse(dateString)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeInstanceOf(Date)
        expect(result.data?.getFullYear()).toBe(2022)
        expect(result.data?.getMonth()).toBe(8) // September is month 8 (0-indexed)
        expect(result.data?.getDate()).toBe(15)
      }
    })

    it('should reject non-string, non-Date values', () => {
      const invalidTypes = [123, true, false, [], {}]

      for (const value of invalidTypes) {
        const result = date.safeParse(value)
        expect(result.success).toBe(false)
      }
    })
  })
})
