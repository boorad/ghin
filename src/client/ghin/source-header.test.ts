import { describe, expect, it, vi } from 'vitest'
import type { CacheClient } from '../../models'
import { GhinClient } from './index'

// Deliberately does NOT `vi.mock('../request-client')` the way `index.test.ts`
// does: the whole point of #1178 is what reaches `fetch`, and a mocked
// RequestClient never builds a request. Lives in its own file because `vi.mock`
// is file-scoped, so this is the cheapest way to get the real client.
global.fetch = vi.fn()

vi.mock('jwt-decode', () => ({ jwtDecode: vi.fn() }))

describe('the `source` value on the wire (#1178)', () => {
  // A cache that hands back a token short-circuits session + login, so the
  // call under test is the only one `fetch` sees.
  const cache: CacheClient = { read: async () => 'cached-access-token', write: async () => undefined }

  const clientWithValidToken = async () => {
    const { jwtDecode } = await import('jwt-decode')
    vi.mocked(jwtDecode).mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 })

    return new GhinClient({ username: 'testuser', password: 'testpass', cache })
  }

  const jsonOk = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response

  const lastCall = () => vi.mocked(fetch).mock.calls.at(-1)
  const headersSent = () => lastCall()?.[1]?.headers as Record<string, string>
  const urlSent = () => String(lastCall()?.[0])
  const bodySent = () => lastCall()?.[1]?.body as string | undefined

  /**
   * Every byte we hand `fetch`, flattened. The single assertion most likely to
   * catch a transport someone adds later — if a new call site starts sending
   * `source` in a header, a query string or a body, `GHINcom` shows up here.
   */
  const everythingSent = () => `${urlSent()} ${JSON.stringify(headersSent())} ${bodySent() ?? ''}`

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
    // The rest of the defaults are untouched.
    expect(headersSent()).toMatchObject({ Authorization: 'Bearer cached-access-token' })
    expect(everythingSent()).not.toContain('GHINcom')
  })

  it.each([
    ['postHoleByHole', { ...validAdjustedRequest, hole_details: [{ hole_number: 1, raw_score: 4 }] }],
    ['post18h9and9', { ...validAdjustedRequest, front9_adjusted: 44, back9_adjusted: 44 }],
  ] as const)('should send no `source` on scores.%s either', async (method, request) => {
    const client = await clientWithValidToken()
    vi.mocked(fetch).mockResolvedValueOnce(scorePostOk())

    // biome-ignore lint/suspicious/noExplicitAny: the two request shapes differ; the wire is what's under test
    const result = await (client.scores[method] as (r: any) => ReturnType<typeof client.scores.postAdjusted>)(request)

    expect(result.isOk()).toBe(true)
    expect(headersSent()).not.toHaveProperty('source')
    expect(everythingSent()).not.toContain('GHINcom')
  })

  it('should send no `source` header and no `source` query param on a GET', async () => {
    const client = await clientWithValidToken()
    vi.mocked(fetch).mockResolvedValueOnce(jsonOk({ countries: [] }))

    const result = await client.courses.getCountries()

    expect(result.isOk()).toBe(true)
    expect(headersSent()).not.toHaveProperty('source')
    expect(new URL(urlSent()).searchParams.has('source')).toBe(false)
    expect(everythingSent()).not.toContain('GHINcom')
  })

  it('should send no `source` header and no `source` body field on POST /playing_handicaps.json', async () => {
    const client = await clientWithValidToken()
    vi.mocked(fetch).mockResolvedValueOnce(jsonOk([]))

    await client.handicaps.getCoursePlayerHandicaps([
      { ghin: 1234567, tee_set_id: 262908, tee_set_side: 'All 18' as const },
    ])

    expect(headersSent()).not.toHaveProperty('source')
    expect(new URL(urlSent()).searchParams.has('source')).toBe(false)
    expect(JSON.parse(bodySent() as string)).not.toHaveProperty('source')
    expect(everythingSent()).not.toContain('GHINcom')
  })

  // A GET that carries real query parameters, so the sweep below is not just
  // passing on an empty query string.
  it('should send no `source` on a GET that does have other query params', async () => {
    const client = await clientWithValidToken()
    vi.mocked(fetch).mockResolvedValueOnce(jsonOk({ golfers: [], invalid: [] }))

    await client.golfers.getOne(1234567)

    const url = new URL(urlSent())

    expect(url.searchParams.get('golfer_id')).toBe('1234567')
    expect(url.searchParams.has('source')).toBe(false)
    expect(headersSent()).not.toHaveProperty('source')
    expect(everythingSent()).not.toContain('GHINcom')
  })
})
