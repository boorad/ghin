---
'@spicygolf/ghin': patch
---

Add `.passthrough()` to `schemaScore` so new fields on score rows survive parsing.

`schemaScore` (`scores/score.ts`) was a plain `z.object`, which strips unknown keys, so any attribute GHIN adds to a score row — the endpoint most likely to grow fields as USGA surfaces new score attributes — was silently deleted in the library before any consumer could see it, with no error to canary on. Its siblings `schemaScorePostResponseInner`, `schemaGolfer`, and the handicap-entry schemas are all already `.passthrough()`; this brings `schemaScore` in line.

Undeclared keys now reach consumers typed `unknown` via the emitted index signature (`& { [k: string]: unknown }`) — a widening, not a breaking change; no declared field changes type. Declaring specific new fields with real Zod types is a follow-up, since naming what's dropped today requires a live scores-list payload that isn't captured in this repo.
