---
'@spicygolf/ghin': patch
---

A blank or null ghin no longer fabricates golfer 0

`schemaGolfer.ghin` was `number` (`z.coerce.number().int()`), and `Number(null)` and `Number('')` are both `0` — so a row GHIN sent with a null or blank GHIN number parsed **successfully as golfer 0** rather than degrading.

Two consequences, both the opposite of the salvage `partitionRows` is supposed to give:

- The row looked valid, so `onDegraded` never fired and nothing reported it.
- It defeated `GolfersGetManyResponse.missing`. A fabricated `0` can never match a requested GHIN number, so the golfer landed in `missing` *and* occupied a slot in `golfers`.

`ghin` now uses `strictNumber`, the #63-trap guard that reads `null` and blank/whitespace strings as no value while still coercing genuine numeric strings. Such rows now move into `invalid`, fire `onDegraded`, and reconcile correctly against `missing`. Genuine numeric-string ghins still coerce, so no valid golfer is affected and the emitted `ghin` type stays `number`.

Split deliberately from #85 (blank display strings): that change only made parsing more permissive, while this one moves rows into `invalid`, a behaviour change of its own.
