import { describe, expect, it } from 'vitest'
import {
  getAccessesResponseFixture,
  requestAccessResponseFixture,
  revokeAccessResponseFixture,
  updateStatusResponseFixture,
} from './__fixtures__'
import {
  schemaGpaRequestAccessRequest,
  schemaGpaSuccessResponse,
  schemaGpaUpdateStatusRequest,
  schemaUserAccessesResponse,
} from './access'

describe('schemaUserAccessesResponse', () => {
  it('parses the real staging response and coerces string IDs to numbers', () => {
    const parsed = schemaUserAccessesResponse.parse(getAccessesResponseFixture)

    expect(parsed.golfers).toHaveLength(1)
    const entry = parsed.golfers[0]
    expect(entry?.golfer.id).toBe(13373246)
    expect(entry?.user_access.id).toBe(6863457)
    expect(entry?.user_access.golfer_name).toBe('Test Golfer1019')
    expect(entry?.user_access.gpa_status).toBe('pending')
  })

  it('preserves unrelated outer fields via passthrough', () => {
    // The endpoint also returns federations / associations / clubs / super_user
    // / subtype. The wrapper ignores them, but the schema must not reject them.
    const parsed = schemaUserAccessesResponse.parse(getAccessesResponseFixture)

    expect(parsed).toMatchObject({
      super_user: 'false',
      subtype: null,
      federations: [],
      associations: [],
      clubs: [],
    })
  })

  it('defaults golfers to [] when the response omits it', () => {
    const parsed = schemaUserAccessesResponse.parse({})
    expect(parsed.golfers).toEqual([])
  })

  it('accepts every observed gpa_status value', () => {
    for (const status of ['pending', 'approved', 'inactive', 'denied'] as const) {
      const parsed = schemaUserAccessesResponse.parse({
        golfers: [
          {
            golfer: { id: '1' },
            user_access: { id: '2', golfer_name: 'X', gpa_status: status },
          },
        ],
      })
      expect(parsed.golfers[0]?.user_access.gpa_status).toBe(status)
    }
  })
})

describe('schemaGpaSuccessResponse', () => {
  it('parses the requestAccess success envelope', () => {
    expect(schemaGpaSuccessResponse.parse(requestAccessResponseFixture).success).toMatch(/successfully sent/)
  })

  it('parses the updateStatus success envelope', () => {
    expect(schemaGpaSuccessResponse.parse(updateStatusResponseFixture).success).toMatch(/acknowledged/)
  })

  it('parses the revokeAccess success envelope (including trailing whitespace)', () => {
    const parsed = schemaGpaSuccessResponse.parse(revokeAccessResponseFixture)
    expect(parsed.success).toMatch(/^You successfully revoked/)
    expect(parsed.success.endsWith(' ')).toBe(true)
  })
})

describe('schemaGpaRequestAccessRequest', () => {
  it('requires a non-empty email', () => {
    expect(() => schemaGpaRequestAccessRequest.parse({})).toThrow()
    expect(() => schemaGpaRequestAccessRequest.parse({ email: '' })).toThrow()
  })

  it('accepts any non-empty string (USGA-side validation not duplicated here)', () => {
    expect(schemaGpaRequestAccessRequest.parse({ email: 'a@b.com' }).email).toBe('a@b.com')
  })
})

describe('schemaGpaUpdateStatusRequest', () => {
  it('only accepts approved or denied as status', () => {
    expect(() => schemaGpaUpdateStatusRequest.parse({ user_id: 1, golfer_id: 2, status: 'pending' })).toThrow()
    expect(schemaGpaUpdateStatusRequest.parse({ user_id: 1, golfer_id: 2, status: 'approved' }).status).toBe('approved')
    expect(schemaGpaUpdateStatusRequest.parse({ user_id: 1, golfer_id: 2, status: 'denied' }).status).toBe('denied')
  })
})
