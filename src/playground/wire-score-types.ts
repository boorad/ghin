/**
 * Raw-wire probe for #66. Read-only. Kept because the one open verification item is
 * re-running this against production once prod credentials land.
 *
 * Fetches /scores.json with a `z.any()` schema so nothing is transformed, and tallies the
 * RAW wire `score_type` against the display fields. This is the only way to see the actual
 * letter — every other path in this library maps it through `scoreTypesMap` first.
 */
import { z } from 'zod'
import { RequestClient } from '../client/request-client'

const client = new RequestClient({
  password: process.env.GHIN_PASSWORD as string,
  username: process.env.GHIN_USERNAME as string,
  apiAccess: process.env.GHIN_API_ACCESS === 'true',
  apiVersion: process.env.GHIN_API_VERSION as string,
  baseUrl: process.env.GHIN_BASE_URL as string,
})

const GOLFERS = (
  process.env.SCORE_KEYS_GOLFERS ??
  '13373246,13373247,13373248,13373249,13373250,13373251,13373252,13373253,13373254,13373255,13373256,13373257,13373258'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

type Row = Record<string, unknown>

// Indexed read: keeps TS4111 (noPropertyAccessFromIndexSignature) and biome's useLiteralKeys
// from fighting over these wire-only keys. Same helper as `score-keys.ts`.
const get = (o: Row, key: string): unknown => o[key]

const rawScores = async (golfer: string, extra: [string, string][] = []): Promise<Row[]> => {
  const searchParams = new URLSearchParams([
    ['golfer_id', golfer],
    ['from_date_played', '2000-01-01'],
    ['per_page', '200'],
    ...extra,
  ])
  const result = await client.fetch<{ scores?: Row[] }>({
    entity: 'scores',
    schema: z.any(),
    options: { searchParams },
  })
  if (result.isErr()) {
    console.error(
      `golfer ${golfer}${extra.length ? ` ${JSON.stringify(extra)}` : ''}: ERROR -> ${result.error.message}`,
    )
    return []
  }
  return result.value?.scores ?? []
}

const fn = async () => {
  // ── Part 1: the wire letter vs. the display fields, across every UAT golfer ──
  const combos = new Map<string, number>()
  const byGolfer = new Map<string, number>()
  let total = 0

  for (const g of GOLFERS) {
    const rows = await rawScores(g)
    byGolfer.set(g, rows.length)
    total += rows.length
    for (const r of rows) {
      const key = [
        `wire=${String(get(r, 'score_type'))}`,
        `short=${String(get(r, 'score_type_display_short'))}`,
        `full=${String(get(r, 'score_type_display_full'))}`,
        `holes=${String(get(r, 'number_of_holes'))}`,
      ].join(' | ')
      combos.set(key, (combos.get(key) ?? 0) + 1)
    }
  }

  console.log(`\n=== ${total} raw scores across ${GOLFERS.length} golfers ===`)
  console.log(JSON.stringify(Object.fromEntries(byGolfer)))
  console.log('\n=== wire score_type x display fields ===')
  for (const [k, v] of [...combos.entries()].sort()) console.log(`${String(v).padStart(4)}  ${k}`)

  // Does any wire letter disagree with the union we now emit?
  const wireLetters = new Set([...combos.keys()].map((k) => (k.split(' | ')[0] ?? '').replace('wire=', '')))
  console.log('\n=== distinct wire letters seen:', JSON.stringify([...wireLetters].sort()))

  // ── Part 2: server-side filtering per letter, incl. the bogus-letter control ──
  console.log('\n=== score_types=<letter> filter, summed over all golfers ===')
  for (const letter of ['A', 'C', 'E', 'H', 'N', 'P', 'T', 'Z']) {
    let n = 0
    const seen = new Set<string>()
    for (const g of GOLFERS) {
      const rows = await rawScores(g, [['score_types', letter]])
      n += rows.length
      for (const r of rows) seen.add(String(get(r, 'score_type')))
    }
    const note = letter === 'Z' ? '   <- bogus-letter control' : ''
    console.log(`  score_types=${letter}: ${n} rows, wire letters returned: ${JSON.stringify([...seen].sort())}${note}`)
  }
}

fn()
