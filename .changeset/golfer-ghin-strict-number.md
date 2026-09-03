---
'@spicygolf/ghin': minor
---

A blank or null ghin no longer fabricates golfer 0

`schemaGolfer.ghin` was `number` (`z.coerce.number().int()`), and `Number(null)` and `Number('')` are both `0` — so a row GHIN sent with a null or blank GHIN number parsed **successfully as golfer 0** rather than degrading.

Two consequences, both the opposite of the salvage `partitionRows` is supposed to give:

- The row looked valid, so `onDegraded` never fired and nothing reported it.
- What happened to it next depended on the caller. `golfers.getMany` builds its result by iterating the *requested* numbers, and a fabricated `0` matches none of them, so the row was **silently dropped**: never in `golfers`, never reconciled against `missing`, and no `onDegraded` to say a row had arrived and been discarded. `golfers.search` and `golfers.globalSearch` return the partitioned rows as they came, so there the same row was **returned to the caller as a fabricated golfer 0**.

`ghin` now uses `strictNumber`, the #63-trap guard that reads `null` and blank/whitespace strings as no value while still coercing genuine numeric strings. Such rows now move into `invalid`, fire `onDegraded`, and reconcile correctly against `missing`. Genuine numeric-string ghins still coerce, so no valid golfer is affected and the emitted `ghin` type stays `number`.

**Schema-object surface.** `strictNumber` is a `ZodEffects`, so the emitted `dist/index.d.ts` type of the public `schemaGolfer` export changes: `ghin` goes from `z.ZodNumber` to `z.ZodEffects<z.ZodNumber, number, unknown>`. Schema-level consumers only: `z.input<typeof schemaGolfer>['ghin']` is now `unknown` rather than `number`; `z.infer<>` and the exported `Golfer` / `GolfersSearchResponse` / `GolfersGetManyResponse` types are unchanged (`ghin: number` either way). Same reason this release is `minor` rather than `patch` as #51, #53, #63 and #67.

Split deliberately from #85 (blank display strings): that change only made parsing more permissive, while this one moves rows into `invalid`, a behaviour change of its own.
