import { z } from 'zod'
import { float, number, partitionRows } from '../../../../models'
import { schemaScore } from './score'

const schemaNumberOrDash = z
  .union([number, z.literal('-')])
  .transform((value) => (value === '-' ? null : Number(value)))

const schemaFloatOrDash = z
  .union([float, z.literal('-')])
  .transform((value) => (value === '-' ? null : Number.parseFloat(value.toString())))

// Rows are parsed individually. A plain `z.array(schemaScore)` made every score a
// single point of failure for the whole history: one unrecognised `score_type`
// letter — or one null differential, per #63 — rejected the entire `getScores`
// response, so a golfer with 40 good rounds and 1 odd one saw no rounds at all
// (#66). Rejects come back raw in `invalid` so the caller can log what GHIN
// actually sent, and `golfersGetScores` reports them through `onDegraded`: a
// history that quietly comes back one round short is indistinguishable from a
// golfer who played one round fewer.
const schemaScoresResponse = z
  .object({
    // `average`/`highest_score`/`lowest_score`/`total_count` are GHIN-computed over the rows it sent, so
    // after a partition they can describe rounds no longer in `scores` — report as-sent, don't recompute.
    average: schemaFloatOrDash.default(0),
    highest_score: schemaNumberOrDash,
    lowest_score: schemaNumberOrDash,
    scores: z.array(z.unknown()),
    total_count: schemaNumberOrDash.default(0),
  })
  // New sibling keys alongside the declared envelope fields survive instead of being stripped (#64).
  .passthrough()
  // `...envelope` carries both the declared siblings and the passthrough keys through the
  // transform — destructuring only `scores` would drop everything #64 went out to preserve.
  // The explicit return type is load-bearing: the rest element keeps `.passthrough()`'s
  // `[k: string]: unknown` index signature, but spreading it into a fresh object literal drops it
  // from the inferred type, so without this annotation undeclared keys survive at runtime yet
  // become unreachable to typed consumers. Don't "simplify" it away.
  .transform(
    ({ scores, ...envelope }): typeof envelope & { scores: z.infer<typeof schemaScore>[]; invalid: unknown[] } => {
      const { valid, invalid } = partitionRows(schemaScore, scores)
      return { ...envelope, scores: valid, invalid }
    },
  )

type ScoresResponse = z.infer<typeof schemaScoresResponse>

export type { ScoresResponse }
export { schemaScoresResponse }
