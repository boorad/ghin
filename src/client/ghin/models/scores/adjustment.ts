import { z } from 'zod'
import { float, string } from '../../../../models'

const schemaScoringAdjustment = z
  .object({
    display: string,
    type: string,
    value: float,
  })
  // GHIN adds adjustment keys without warning; passthrough keeps undeclared ones reachable (#64).
  .passthrough()

type ScoringAdjustment = z.infer<typeof schemaScoringAdjustment>

export type { ScoringAdjustment }
export { schemaScoringAdjustment }
