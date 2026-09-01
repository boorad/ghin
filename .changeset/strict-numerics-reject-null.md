---
'@spicygolf/ghin': minor
---

Stop an explicit `null` on a required numeric field from parsing as a fabricated `0` (#63).

`float` is `z.coerce.number()` and `Number(null) === Number('') === 0`, so a required numeric that GHIN sends as `null` came back as `0` — a value that passes a `typeof x === 'number'` guard and is indistinguishable from a real scratch handicap or a real zero differential. Two fixes:

**The shared `handicap` helper no longer turns `null` or a blank string into `0`.** Its inner union tried `float` before `z.null()`, so the `null` branch was unreachable and `handicap.parse(null)` was `0`. It now returns `null` for `null`, `''` (including whitespace-only), `'NH'` and `'-'`. The published output type was already `number | null`; only the runtime value changes. `handicaps.getOne` held the one live bare use (`golfer.handicap_index`), where a `null` or blank index would have been reported as scratch; it is now `handicap.nullable()`, matching `course_handicap`, `playing_handicap` and `shots_off`. Where a no-index golfer is observable today — `golfers.search` against staging golfer `13373258` on `api-uat.ghin.com` — GHIN sends the string `"NH"` rather than a `null`, and the helper maps that to `null` as it did before.

**New `strictFloat` and `strictNumber` exports reject `null` and blank strings outright** — with the same `Expected number, received nan` issue a missing key already produces — while still coercing genuine numeric strings. They are applied at the fields a consumer computes on, where a fabricated `0` is a wrong number rather than a missing one:

- `scores.post` response: `id`, `golfer_id`, `adjusted_gross_score`, `differential`
- `golfers.getScores`: `course_rating`, `slope_rating`, `differential`, `unadjusted_differential`
- `courses.getTeeSetRating`: `CourseRating`, `SlopeRating`
- `courses.getDetails`: `CourseRating`, `SlopeRating` — one bad tee set lands in `invalidTeeSets` and fires `onDegraded`
- `handicaps.getCourseHandicaps`: `course_rating`, `slope_rating` — one bad tee set lands in `invalid` and fires `onDegraded`

**A parse that previously succeeded with a `0` at one of those fields now fails.** For `courses.getDetails` and `handicaps.getCourseHandicaps` that costs one row. For `scores.post`, `golfers.getScores` and `courses.getTeeSetRating` — none of which partition rows — it is a `ValidationError` for the whole call. Probed against `api-uat.ghin.com` on 2026-09-01: 84 scores across all 13 staging golfers — including `UnderReview` and `Temporary` scores, the plausible source of a missing differential — carry a real number at every one of these fields, as do all 59 tee sets from `courses.getDetails`, the `TeeSetRatings` records behind them, and the 15 tee sets from `handicaps.getCourseHandicaps` for both an established and a no-index golfer. Nothing that works today starts failing. A caller that was silently receiving `0` will now see the failure instead; `golfers.getScores` is the one to watch, since it does not partition and a single historical score with a null differential would reject the whole history.

`float` and `number` themselves are unchanged: they still coerce, and every request-side schema, ID field and `getScores` summary (`average`, `highest_score`, `lowest_score`) keeps using them. Schema-level consumers only: `z.input<>` of the affected response schemas now shows the switched fields as `unknown` (they are `ZodEffects` over `ZodNumber`); `z.infer<>` / the exported `*Response` types are unchanged.
