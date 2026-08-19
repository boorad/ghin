---
'@spicygolf/ghin': patch
---

Tolerate a missing or null `LegacyCRPTeeId` on course-details tee sets. GHIN stopped sending the key on Druid Hills (course 13995) — all 22 tee sets lost it at once. `number` is `z.coerce.number()`, so an absent key coerces to `NaN` and rejected the entire `courses.getDetails` response with a `ValidationError`, leaving callers with no tees at all.

The field identifies nothing we consume, and `schemaTeeSetRating` already declared it nullable — the course-details schema was the inconsistent one. Same failure class as the per-hole `Allocation` key (#46) and the search address keys (#51).
