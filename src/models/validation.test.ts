import { describe, it, expect } from 'vitest'
import { string, number, boolean, handicap } from './validation'

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
}) 