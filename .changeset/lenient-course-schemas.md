---
'@spicygolf/ghin': minor
---

Stop letting one dropped GHIN key destroy a whole response, and report it when rows are dropped.

GHIN removes keys from payloads without warning — three outages so far (`Allocation` in #46, the search address keys in #51, `LegacyCRPTeeId` on 2026-08-19). Each was fixed field-by-field, so the next dropped key broke us again. This makes the schemas structurally tolerant instead.

**Required now means load-bearing.** A field is required only where the caller genuinely cannot proceed without it:

- Course: `CourseId`, `CourseName`
- Tee set: `TeeSetRatingId`, `TeeSetRatingName`, and at least one hole
- Hole: `Number`
- Golfer: `ghin`, `last_name`

Everything else is `.nullish()`, and every object is `.passthrough()` so new GHIN fields survive instead of being stripped.

**Rows degrade individually, responses don't.** `courses.getDetails` parses tee sets one at a time — 21 usable tees beat zero — and returns the rejects as `invalidTeeSets`. `golfers.search` and `golfers.globalSearch` do the same per golfer, so one malformed row no longer empties a search. Holes are deliberately all-or-nothing within a tee set: dropping one bad hole would hand back a 17-hole tee that scores silently wrong.

**New: `onDegraded`.** An optional `ClientConfig` callback fired whenever rows are dropped, with `{ entity, dropped, total, sample }`. Wire it to your error tracker — silent degradation is indistinguishable from a genuinely short response, which is how all three outages stayed invisible until a user complained. The callback is wrapped so a throwing reporter can't fail the request.

Verified against live GHIN: Druid Hills (13995) parses 22 tee sets and St. Patrick's Links (31291) parses 6, both unchanged.
