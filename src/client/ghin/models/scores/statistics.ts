import { z } from 'zod'
import { date, emptyStringToNull, float, number, strictNumber } from '../../../../models'

// The whole `*_total` counter family arrives as JSON *strings* (`"3"`) while every `*_percent`
// sibling arrives as a number — GHIN's own inconsistency, confirmed across the 26 statistics
// blocks in the 2026-09-01 UAT capture. They are coerced deliberately, because a count is
// arithmetic the moment a consumer sums or compares it, and shipping it as a string would only
// move the coercion to every caller.
//
// The eight counters declared by #71 are `strictNumber.nullish()`, not the bare `number`
// (`z.coerce.number().int()`) that `putts_total` and `up_and_downs_total` have always used:
//
//   - `strictNumber` rejects null and blank strings rather than coercing them to a fabricated 0
//     that passes a `typeof x === 'number'` guard (#63) — and "a count a consumer sums or
//     compares" is exactly the criterion `validation.ts:186-193` gives for reaching for it.
//   - `.nullish()`, never a bare `.nullable()`, because GHIN drops keys entirely rather than
//     nulling them (#46, #51, #55, #56, #57). This object is required on the score row, so every
//     all-or-nothing key here costs a whole *score* the day GHIN stops sending it — and before
//     #71 declared them, `.passthrough()` carried both the missing key and the explicit null
//     without complaint.
//
// `putts_total` / `up_and_downs_total` keep the bare `number` they shipped with: loosening the
// pre-existing required fields on this object is tracked as its own issue.
const schemaStatistics = z
  .object({
    birdies_or_better_percent: float,
    birdies_or_better_total: strictNumber.nullish(),
    bogeys_percent: float,
    bogeys_total: strictNumber.nullish(),
    double_bogeys_percent: float,
    double_bogeys_total: strictNumber.nullish(),
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
    one_putt_or_better_total: strictNumber.nullish(),
    par3s_average: float,
    par4s_average: float,
    par5s_average: float,
    pars_percent: float,
    pars_total: strictNumber.nullish(),
    putts_total: number,
    three_putt_or_worse_percent: float,
    three_putt_or_worse_total: strictNumber.nullish(),
    triple_bogeys_or_worse_percent: float,
    triple_bogeys_or_worse_total: strictNumber.nullish(),
    two_putt_or_better_percent: float,
    two_putt_percent: float,
    two_putt_total: strictNumber.nullish(),
    up_and_downs_total: number,
  })
  // GHIN adds statistics keys without warning; passthrough keeps undeclared ones reachable (#64).
  .passthrough()

type Statistics = z.infer<typeof schemaStatistics>

export type { Statistics }
export { schemaStatistics }
