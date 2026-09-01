import { z } from 'zod'
import { date, emptyStringToNull, float, number } from '../../../../models'

// The whole `*_total` counter family arrives as JSON *strings* (`"3"`) while every `*_percent`
// sibling arrives as a number — GHIN's own inconsistency, confirmed across the 26 statistics
// blocks in the 2026-09-01 UAT capture. They are coerced deliberately with `number`
// (`z.coerce.number().int()`), which is what `putts_total` and `up_and_downs_total` — the two
// members of the same family that were already declared — have always done. A count is arithmetic
// the moment a consumer sums or compares it, so shipping it as a string would only move the
// coercion to every caller.
const schemaStatistics = z
  .object({
    birdies_or_better_percent: float,
    birdies_or_better_total: number,
    bogeys_percent: float,
    bogeys_total: number,
    double_bogeys_percent: float,
    double_bogeys_total: number,
    fairway_hits_percent: float,
    gir_percent: float,
    last_stats_update_date: date,
    last_stats_update_type: emptyStringToNull,
    missed_general_approach_shot_accuracy_percent: float,
    missed_left_approach_shot_accuracy_percent: float,
    missed_left_percent: float,
    missed_long_approach_shot_accuracy_percent: float,
    missed_long_percent: float,
    missed_right_approach_shot_accuracy_percent: float,
    missed_right_percent: float,
    missed_short_approach_shot_accuracy_percent: float,
    missed_short_percent: float,
    one_putt_or_better_percent: float,
    one_putt_or_better_total: number,
    par3s_average: float,
    par4s_average: float,
    par5s_average: float,
    pars_percent: float,
    pars_total: number,
    putts_total: number,
    three_putt_or_worse_percent: float,
    three_putt_or_worse_total: number,
    triple_bogeys_or_worse_percent: float,
    triple_bogeys_or_worse_total: number,
    two_putt_or_better_percent: float,
    two_putt_percent: float,
    two_putt_total: number,
    up_and_downs_total: number,
  })
  // GHIN adds statistics keys without warning; passthrough keeps undeclared ones reachable (#64).
  .passthrough()

type Statistics = z.infer<typeof schemaStatistics>

export type { Statistics }
export { schemaStatistics }
