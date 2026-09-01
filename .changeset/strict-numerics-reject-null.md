---
'@spicygolf/ghin': minor
---

Stop an explicit `null` on a required numeric field from parsing as a fabricated `0` (#63).

`float` is `z.coerce.number()` and `Number(null) === Number('') === 0`, so a required numeric that GHIN sends as `null` came back as `0` — a value that passes a `typeof x === 'number'` guard and is indistinguishable from a real scratch handicap or a real zero differential. Two fixes:

**The shared `handicap` helper no longer turns `null` or `''` into `0`.** Its inner union tried `float` before `z.null()`, so the `null` branch was unreachable and `handicap.parse(null)` was `0`. It now returns `null` for `null`, `''`, `'NH'` and `'-'`. The published output type was already `number | null`; only the runtime value changes. `handicaps.getOne` was the one live bare use (`golfer.handicap_index`), so a golfer with no established index — verified against `api-uat.ghin.com` with staging golfer `13373258` — was reported as scratch. It is now `handicap.nullable()`, matching `course_handicap`, `playing_handicap` and `shots_off`.

**New `strictFloat` and `strictNumber` exports reject `null` and `''` outright** — with the same `Expected number, received nan` issue a missing key already produces — while still coercing genuine numeric strings. They are applied at the fields a consumer computes on, where a fabricated `0` is a wrong number rather than a missing one:

- `scores.post` response: `id`, `golfer_id`, `adjusted_gross_score`, `differential`
- `handicaps.getCourseHandicaps`: `course_rating`, `slope_rating` (one bad tee set lands in `invalid` and fires `onDegraded`)
- `courses.getDetails` / `courses.getTeeSetRatings`: `CourseRating`, `SlopeRating` (same, via `invalidTeeSets`)
- `golfers.getScores`: `course_rating`, `slope_rating`, `differential`, `unadjusted_differential`

**A parse that previously succeeded with a `0` at one of those fields now fails.** For the partitioned endpoints that costs one row; for `scores.post` and `golfers.getScores` it is a `ValidationError` for the call. No captured payload carries a `null` there, so this should not change any working call — but a caller that was silently receiving `0` will now see the failure.

`float` and `number` themselves are unchanged: they still coerce, and every request-side schema, ID field and `getScores` summary (`average`, `highest_score`, `lowest_score`) keeps using them.
