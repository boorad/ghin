/**
 * Throwaway discovery script (#64 follow-up): diff the keys GHIN actually sends on a
 * scores-list payload against the keys the schemas declare. Read-only.
 *
 * Caveats — this probes the *parsed* result, not the raw wire payload:
 * - "declared-but-never-seen" is unreliable for `.default()` fields
 *   (`approach_shot_accuracy`, `average`, `total_count`): Zod injects them, so they
 *   look present even when GHIN never sent them.
 * - Reported JSON types are post-transform: `played_at` / `posted_at` show as
 *   `object` (Dates) and `score_type` / `status` as the transformed enums.
 * - A golfer whose payload fails to parse contributes nothing to the tallies, so
 *   the very drift this script hunts for can hide its own evidence.
 */
import {
  schemaHoleDetail,
  schemaScoresResponse,
  schemaScoringAdjustment,
  schemaStatistics,
} from '../client/ghin/models/scores'
import { schemaScore } from '../client/ghin/models/scores/score'
import { GhinClient } from '../index'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GHIN_PASSWORD: string
      GHIN_USERNAME: string
      GHIN_API_ACCESS: string
      GHIN_API_VERSION: string
      GHIN_BASE_URL: string
      SCORE_KEYS_GOLFERS?: string
    }
  }
}

type Obs = {
  types: Set<string>
  examples: Set<string>
  rows: number
  nonNull: number
}

// Indexed read: keeps TS4111 (noPropertyAccessFromIndexSignature) and biome's
// useLiteralKeys from fighting over passthrough keys.
const get = (o: Record<string, unknown>, key: string): unknown => o[key]

const jsonType = (v: unknown): string => {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

class Level {
  name: string
  declared: Set<string>
  seen = 0
  obs = new Map<string, Obs>()
  declaredSeen = new Map<string, number>()

  constructor(name: string, declared: string[]) {
    this.name = name
    this.declared = new Set(declared)
  }

  add(row: Record<string, unknown>) {
    this.seen += 1
    for (const [k, v] of Object.entries(row)) {
      if (this.declared.has(k)) {
        this.declaredSeen.set(k, (this.declaredSeen.get(k) ?? 0) + 1)
        continue
      }
      const o = this.obs.get(k) ?? { types: new Set<string>(), examples: new Set<string>(), rows: 0, nonNull: 0 }
      o.types.add(jsonType(v))
      o.rows += 1
      if (v !== null && v !== undefined) {
        o.nonNull += 1
        if (o.examples.size < 4) o.examples.add(JSON.stringify(v))
      }
      this.obs.set(k, o)
    }
  }

  report() {
    console.log(`\n### ${this.name}  (${this.seen} objects seen)`)
    if (this.seen === 0) {
      console.log('  (none observed)')
      return
    }
    if (this.obs.size === 0) {
      console.log('  no undeclared keys')
    } else {
      for (const [k, o] of [...this.obs.entries()].sort()) {
        const ex = o.nonNull === 0 ? 'ALWAYS NULL' : [...o.examples].join(', ')
        console.log(
          `  ${k}  | types=${[...o.types].join('|')} | on ${o.rows}/${this.seen} objects | nonNull=${o.nonNull} | example=${ex}`,
        )
      }
    }
    const missing = [...this.declared].filter((k) => !this.declaredSeen.has(k))
    if (missing.length) console.log(`  declared-but-never-seen: ${missing.sort().join(', ')}`)
  }
}

const envelope = new Level('envelope (schemaScoresResponse)', Object.keys(schemaScoresResponse.shape))
const score = new Level('score row (schemaScore)', Object.keys(schemaScore.shape))
const hole = new Level('hole_details[] (schemaHoleDetail)', Object.keys(schemaHoleDetail.shape))
const adj = new Level('adjustments[] (schemaScoringAdjustment)', Object.keys(schemaScoringAdjustment.shape))
const stats = new Level('statistics (schemaStatistics)', Object.keys(schemaStatistics.shape))

const statusCounts = new Map<string, number>()
const typeCounts = new Map<string, number>()
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

// UAT staging golfers (see the `staging-api-probing` note); override with SCORE_KEYS_GOLFERS.
const golfers = (
  process.env.SCORE_KEYS_GOLFERS ??
  '13373246,13373247,13373248,13373249,13373250,13373251,13373252,13373253,13373254,13373255,13373256,13373257,13373258'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number)

const fn = async () => {
  const ghinClient = new GhinClient({
    password: process.env.GHIN_PASSWORD as string,
    username: process.env.GHIN_USERNAME as string,
    apiAccess: process.env.GHIN_API_ACCESS === 'true',
    apiVersion: process.env.GHIN_API_VERSION as string,
    baseUrl: process.env.GHIN_BASE_URL as string,
  })

  for (const g of golfers) {
    try {
      const res = await ghinClient.golfers.getScores(g, { limit: 100 })
      envelope.add(res)
      const rows = (get(res, 'scores') ?? []) as Record<string, unknown>[]
      console.log(`golfer ${g}: ${rows.length} score rows (total_count=${String(get(res, 'total_count'))})`)
      for (const r of rows) {
        score.add(r)
        bump(statusCounts, String(get(r, 'status')))
        bump(typeCounts, `${String(get(r, 'score_type'))}/${String(get(r, 'number_of_holes'))}h`)
        for (const h of (get(r, 'hole_details') ?? []) as Record<string, unknown>[]) hole.add(h)
        for (const a of (get(r, 'adjustments') ?? []) as Record<string, unknown>[]) adj.add(a)
        const st = get(r, 'statistics')
        if (st && typeof st === 'object') stats.add(st as Record<string, unknown>)
      }
    } catch (error) {
      console.error(`golfer ${g}: ERROR ->`, error instanceof Error ? `${error.name}: ${error.message}` : error)
      if (error && typeof error === 'object' && 'issues' in error)
        console.error(JSON.stringify((error as { issues: unknown }).issues, null, 2))
    }
  }

  console.log('\n=== observed score statuses:', JSON.stringify(Object.fromEntries(statusCounts)))
  console.log('=== observed score types:', JSON.stringify(Object.fromEntries(typeCounts)))
  for (const l of [envelope, score, hole, adj, stats]) l.report()
}

fn()
