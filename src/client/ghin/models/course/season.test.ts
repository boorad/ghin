import { describe, expect, it } from 'vitest'
import { schemaSeasonDate, schemaSeasonName } from './season'

describe('Season Schema', () => {
  describe('schemaSeasonDate', () => {
    it('should parse valid date strings', () => {
      const result = schemaSeasonDate.safeParse('01/15')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('01/15')
      }
    })

    it('should convert undefined to null', () => {
      const result = schemaSeasonDate.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should convert null to null', () => {
      const result = schemaSeasonDate.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should convert empty string to null', () => {
      const result = schemaSeasonDate.safeParse('')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })
  })

  describe('schemaSeasonName', () => {
    it('should parse valid season names', () => {
      const result = schemaSeasonName.safeParse('Summer')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('Summer')
      }
    })

    it('should convert undefined to null', () => {
      const result = schemaSeasonName.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should convert null to null', () => {
      const result = schemaSeasonName.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })

    it('should convert empty string to null', () => {
      const result = schemaSeasonName.safeParse('')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(null)
      }
    })
  })
})
