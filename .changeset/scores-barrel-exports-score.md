---
'@spicygolf/ghin': minor
---

Export the score row model from the package root: `Score`, `ScoreType`, `ScoreStatus`, `schemaScore`, `rawScoreTypes` and `schemaRawScoreStatus`.

`src/client/ghin/models/scores/index.ts` re-exported every file in that directory except `./score`, so the score row's own type never reached the package's export list while its nested siblings — `HoleDetail`, `Statistics`, `ScoringAdjustment` — all did. A consumer who wanted to type a single score had to reach it structurally, as `ScoresResponse['scores'][number]`, or hand-roll the type.

Nothing is renamed or removed, and no runtime behavior changes: these six names simply did not exist on the public surface before. The `Score` type this publishes is the widened one from the score-row-keys change above, which is why the two ship together. A test now asserts all six are importable both from the scores model barrel and from the package root, so the surface cannot silently regress again.
