import { describe, expect, it } from 'vitest'
import { schemaGeoAddress, schemaGeoCoordinate } from './geolocation'

describe('Geolocation Schema', () => {
  describe('schemaGeoCoordinate', () => {
    it('should parse valid numeric coordinates', () => {
      const result = schemaGeoCoordinate.safeParse(33.7756)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(33.7756)
      }
    })

    it('should parse valid string coordinates', () => {
      const result = schemaGeoCoordinate.safeParse('-84.3963')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(-84.3963)
      }
    })

    it('should convert undefined to null', () => {
      const result = schemaGeoCoordinate.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should convert null to null', () => {
      const result = schemaGeoCoordinate.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should convert empty string to null', () => {
      const result = schemaGeoCoordinate.safeParse('')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should convert NaN to null', () => {
      const result = schemaGeoCoordinate.safeParse(Number.NaN)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should convert invalid string to null', () => {
      const result = schemaGeoCoordinate.safeParse('not a number')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should handle zero as valid coordinate', () => {
      const result = schemaGeoCoordinate.safeParse(0)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(0)
      }
    })

    it('should handle negative coordinates', () => {
      const result = schemaGeoCoordinate.safeParse(-122.4194)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(-122.4194)
      }
    })

    it('should handle coordinates at boundaries (90/-90, 180/-180)', () => {
      const latitude = schemaGeoCoordinate.safeParse(90)
      expect(latitude.success).toBe(true)
      if (latitude.success) {
        expect(latitude.data).toBe(90)
      }

      const longitude = schemaGeoCoordinate.safeParse(-180)
      expect(longitude.success).toBe(true)
      if (longitude.success) {
        expect(longitude.data).toBe(-180)
      }
    })
  })

  describe('schemaGeoAddress', () => {
    it('should parse valid address string', () => {
      const result = schemaGeoAddress.safeParse('123 Main St, Atlanta, GA 30307')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('123 Main St, Atlanta, GA 30307')
      }
    })

    it('should convert undefined to null', () => {
      const result = schemaGeoAddress.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should convert null to null', () => {
      const result = schemaGeoAddress.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should convert empty string to null', () => {
      const result = schemaGeoAddress.safeParse('')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })
  })
})
