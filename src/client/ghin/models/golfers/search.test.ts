import { describe, expect, it } from 'vitest'
import {
  schemaGolfer,
  schemaGolfersGetManyRequest,
  schemaGolfersGlobalSearchRequest,
  schemaGolfersSearchRequest,
  schemaGolfersSearchResponse,
} from './search'

describe('Golfer Search Schema', () => {
  // Only what makes a golfer usable: the number a handicap links against and
  // the name a human picks from a result list.
  const minimalGolfer = { ghin: 1234567, last_name: 'Doe' }

  describe('schemaGolfer', () => {
    it('should parse a golfer carrying only ghin and last_name', () => {
      const result = schemaGolfer.safeParse(minimalGolfer)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ghin).toBe(1234567)
        expect(result.data.first_name ?? null).toBe(null)
      }
    })

    // GHIN sends 999 where the display field says "NH" — observed on
    // api-uat.ghin.com for a golfer with no index, and for an established
    // golfer with no recorded low index. It must not reach consumers as 999.
    it('should map the 999 no-handicap sentinel to null', () => {
      const result = schemaGolfer.safeParse({
        ...minimalGolfer,
        handicap_index: 'NH',
        hi_display: 'NH',
        hi_value: 999,
        low_hi_value: 999,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.handicap_index).toBe(null)
        expect(result.data.hi_value).toBe(null)
        expect(result.data.low_hi_value).toBe(null)
      }
    })

    it('should reject a golfer with no ghin', () => {
      expect(schemaGolfer.safeParse({ last_name: 'Doe' }).success).toBe(false)
    })

    // Measured against `api-uat`, 2026-09-02: a name search with an empty status
    // returned `Archived` rows. The response enum has to accept them — `.nullish()`
    // does not, so these golfers were being dropped into `invalid`.
    it('should parse a golfer with an Archived status', () => {
      const result = schemaGolfer.safeParse({ ...minimalGolfer, status: 'Archived' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('Archived')
      }
    })

    // The response side was widened, not loosened: a status GHIN has never sent
    // still fails, so the next unknown value shows up in `invalid` to be logged.
    it('should reject a golfer with an unknown status', () => {
      expect(schemaGolfer.safeParse({ ...minimalGolfer, status: 'Suspended' }).success).toBe(false)
    })

    it('should preserve unknown keys GHIN adds', () => {
      const result = schemaGolfer.safeParse({ ...minimalGolfer, some_new_key: 'kept' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as unknown as { some_new_key?: string }).some_new_key).toBe('kept')
      }
    })
  })

  describe('schemaGolfersSearchResponse', () => {
    // The regression this schema exists for: one malformed golfer used to reject
    // every golfer beside them, turning partial data into "no search results".
    it('should keep the good golfers and return the bad ones raw in invalid', () => {
      const rejected = { first_name: 'No', last_name: 'Ghin' }
      const result = schemaGolfersSearchResponse.safeParse({
        golfers: [minimalGolfer, rejected, { ghin: 7654321, last_name: 'Roe' }],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.golfers.map((g) => g.ghin)).toEqual([1234567, 7654321])
        expect(result.data.invalid).toEqual([rejected])
      }
    })

    it('should report an empty invalid list when every golfer parses', () => {
      const result = schemaGolfersSearchResponse.safeParse({ golfers: [minimalGolfer] })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.golfers).toHaveLength(1)
        expect(result.data.invalid).toEqual([])
      }
    })

    it('should keep an Archived golfer in the valid partition', () => {
      const archived = { ghin: 2890015, last_name: 'Lapsed', status: 'Archived' }
      const result = schemaGolfersSearchResponse.safeParse({ golfers: [minimalGolfer, archived] })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.golfers.map((g) => g.ghin)).toEqual([1234567, 2890015])
        expect(result.data.invalid).toEqual([])
      }
    })

    it('should handle an empty golfers array', () => {
      const result = schemaGolfersSearchResponse.safeParse({ golfers: [] })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.golfers).toEqual([])
        expect(result.data.invalid).toEqual([])
      }
    })
  })

  // GHIN's only bulk golfer lookup for non-Admin-Portal credentials (#81). The
  // list has to reach the wire comma-separated: `golfer_id[]=a&golfer_id[]=b`
  // is a 500 and `golfer_ids[]` is a 400.
  describe('schemaGolfersSearchRequest golfer_id', () => {
    it('should join an array of GHIN numbers with commas', () => {
      const result = schemaGolfersSearchRequest.safeParse({ golfer_id: [1234567, 7654321] })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.golfer_id).toBe('1234567,7654321')
      }
    })

    it('should leave a single GHIN number alone', () => {
      const result = schemaGolfersSearchRequest.safeParse({ golfer_id: 1234567 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.golfer_id).toBe(1234567)
      }
    })

    it('should reject an empty array', () => {
      expect(schemaGolfersSearchRequest.safeParse({ golfer_id: [] }).success).toBe(false)
    })
  })

  // The response enum accepts `Archived`; the request enums must not. Only
  // `Active` and `Inactive` are proven to work as filters against GHIN, and these
  // schemas are caller-facing input types — offering a value that silently returns
  // nothing would be worse than rejecting it.
  describe('request status is narrower than response status', () => {
    it('should reject status Archived on every request schema', () => {
      expect(schemaGolfersSearchRequest.safeParse({ status: 'Archived' }).success).toBe(false)
      expect(schemaGolfersGetManyRequest.safeParse({ status: 'Archived' }).success).toBe(false)
      expect(schemaGolfersGlobalSearchRequest.safeParse({ status: 'Archived' }).success).toBe(false)
    })

    it('should still accept the two filters GHIN is known to honour', () => {
      expect(schemaGolfersSearchRequest.safeParse({ status: 'Active' }).success).toBe(true)
      expect(schemaGolfersGetManyRequest.safeParse({ status: 'Inactive' }).success).toBe(true)
      expect(schemaGolfersGlobalSearchRequest.safeParse({ status: 'Active' }).success).toBe(true)
    })
  })

  // `null` is a third filter value, not a missing one: the client deletes
  // `status` from the query string for it, and GHIN answers an omitted `status`
  // with both active and inactive golfers (api-uat, 2026-09-02, golfer 2890015).
  describe('status: null clears the filter', () => {
    it('should accept status null on the search and getMany requests', () => {
      const search = schemaGolfersSearchRequest.safeParse({ last_name: 'Doe', status: null })
      const getMany = schemaGolfersGetManyRequest.safeParse({ status: null })

      expect(search.success).toBe(true)
      expect(getMany.success).toBe(true)
      if (search.success) {
        expect(search.data.status).toBeNull()
      }
      if (getMany.success) {
        expect(getMany.data.status).toBeNull()
      }
    })

    // Nullable widened the union by exactly one value; it did not turn the enum
    // into a free-text field.
    it('should still reject an unknown status on both requests', () => {
      expect(schemaGolfersSearchRequest.safeParse({ status: 'Bogus' }).success).toBe(false)
      expect(schemaGolfersGetManyRequest.safeParse({ status: 'Bogus' }).success).toBe(false)
    })
  })
})
