import { describe, expect, it, vi } from 'vitest'
import type { CacheClient } from '../../models'
import { GhinClient } from './index'

// Deliberately does NOT `vi.mock('../request-client')` the way `index.test.ts`
// does: the whole point of #1178 is which headers reach `fetch`, and a mocked
// RequestClient never builds them. Lives in its own file because `vi.mock` is
// file-scoped, so this is the cheapest way to get the real client.
global.fetch = vi.fn()

vi.mock('jwt-decode', () => ({ jwtDecode: vi.fn() }))

describe('the `source` request header (#1178)', () => {
  // A cache that hands back a token short-circuits session + login, so the
  // score post is the only call `fetch` sees.
  const cache: CacheClient = { read: async () => 'cached-access-token', write: async () => undefined }

  const clientWithValidToken = async () => {
    const { jwtDecode } = await import('jwt-decode')
    vi.mocked(jwtDecode).mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 })

    return new GhinClient({ username: 'testuser', password: 'testpass', cache })
  }

  const jsonOk = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response

  const headersSent = () => vi.mocked(fetch).mock.calls.at(-1)?.[1]?.headers as Record<string, string>

  const validAdjustedRequest = {
    golfer_id: '123',
    course_id: '2539',
    tee_set_id: '262908',
    tee_set_side: 'All18' as const,
    played_at: '2026-03-17',
    score_type: 'H' as const,
    adjusted_gross_score: 88,
    number_of_holes: '18' as const,
    gender: 'M' as const,
  }

  const scorePostOk = () =>
    jsonOk({
      score: {
        id: 1,
        golfer_id: 123,
        status: 'Validated',
        adjusted_gross_score: 88,
        differential: 15.4,
      },
    })

  it('should send no `source` header on a score post, not a blank one', async () => {
    const client = await clientWithValidToken()
    vi.mocked(fetch).mockResolvedValueOnce(scorePostOk())

    const result = await client.scores.postAdjusted(validAdjustedRequest)

    expect(result.isOk()).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    // Omitted outright — USGA stamp the real source server-side, and a blank
    // header is still a value we would be asserting.
    expect(headersSent()).not.toHaveProperty('source')
    // The sentinel is an internal marker; it must never reach the wire.
    expect(Object.values(headersSent())).not.toContain('__omit__')
    // The rest of the defaults are untouched.
    expect(headersSent()).toMatchObject({ Authorization: 'Bearer cached-access-token' })
  })

  it.each([
    ['postHoleByHole', { ...validAdjustedRequest, hole_details: [{ hole_number: 1, raw_score: 4 }] }],
    ['post18h9and9', { ...validAdjustedRequest, front9_adjusted: 44, back9_adjusted: 44 }],
  ] as const)('should send no `source` header on scores.%s either', async (method, request) => {
    const client = await clientWithValidToken()
    vi.mocked(fetch).mockResolvedValueOnce(scorePostOk())

    // biome-ignore lint/suspicious/noExplicitAny: the two request shapes differ; the header is what's under test
    const result = await (client.scores[method] as (r: any) => ReturnType<typeof client.scores.postAdjusted>)(request)

    expect(result.isOk()).toBe(true)
    expect(headersSent()).not.toHaveProperty('source')
  })

  // The regression guard that matters: #1178 is scoped to `/scores`, and GHIN
  // may genuinely key off `source` everywhere else.
  it('should still send `source: GHINcom` on a GET', async () => {
    const client = await clientWithValidToken()
    vi.mocked(fetch).mockResolvedValueOnce(jsonOk({ countries: [] }))

    const result = await client.courses.getCountries()

    expect(result.isOk()).toBe(true)
    expect(headersSent()).toMatchObject({ source: 'GHINcom' })
  })

  it('should still send `source: GHINcom` on POST /playing_handicaps.json', async () => {
    const client = await clientWithValidToken()
    vi.mocked(fetch).mockResolvedValueOnce(jsonOk([]))

    await client.handicaps.getCoursePlayerHandicaps([
      { ghin: 1234567, tee_set_id: 262908, tee_set_side: 'All 18' as const },
    ])

    expect(headersSent()).toMatchObject({ source: 'GHINcom' })
    // …and the body's own `source` field is untouched by this change.
    expect(JSON.parse(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body as string)).toMatchObject({
      source: 'GHINcom',
    })
  })
})
