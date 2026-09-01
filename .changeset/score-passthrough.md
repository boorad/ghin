---
'@spicygolf/ghin': patch
---

Add `.passthrough()` across the whole score tree so new fields on scores survive parsing.

`schemaScore` (`scores/score.ts`) was a plain `z.object`, which strips unknown keys, so any attribute GHIN adds to a score row — the endpoint most likely to grow fields as USGA surfaces new score attributes — was silently deleted in the library before any consumer could see it, with no error to canary on. Its siblings `schemaScorePostResponseInner`, `schemaGolfer`, and the handicap-entry schemas are all already `.passthrough()`; this brings `schemaScore` in line. Because a `.passthrough()` does not reach into nested object schemas, the same treatment is applied to every level of the tree: `schemaHoleDetail`, `schemaStatistics`, `schemaScoringAdjustment`, and the `schemaScoresResponse` envelope, so a new key on a hole detail, a statistics block, an adjustment, or alongside `average`/`total_count` survives too. The `schemaScorePostResponse` envelope gets the same treatment, as it was the last plain `z.object` left in the scores module.

Undeclared keys now reach consumers typed `unknown` via the emitted index signature (`& { [k: string]: unknown }`) — a widening, not a breaking change; no declared field changes type, and a genuinely invalid row (an explicit `null` on a required numeric, say) is still rejected. A live UAT capture (85 score rows across 13 golfers) confirms this was dropping real data today: 13 undeclared keys on the score row, including `handicap_index`, `handicap_index_display`, `course_handicap`, `net_score` and `to_par_display_value`, plus eight `*_total` counters inside `statistics`. Those now arrive as `unknown` instead of vanishing; declaring them with real Zod types is a follow-up.
