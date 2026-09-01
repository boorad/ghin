# 63 — z.coerce.number() on required numeric fields turns an explicit null into 0

Issue: https://github.com/boorad/ghin/issues/63

## Problem

`float` is `z.coerce.number()` and `number` is `float.int()` (`src/models/validation.ts:106,149`).
`Number(null) === 0` and `Number('') === 0`, so an explicit `null` (or `''`) on a required numeric
field parses successfully as a fabricated `0` instead of failing. A fabricated `0` passes a
`typeof x === 'number'` guard, so nothing downstream can tell it from a real scratch value.

Two concrete consequences:

1. The `handicap` helper (`validation.ts:117`) is `z.union([float, z.string(), z.null()])`. Unions
   take the first success, so the `z.null()` branch is unreachable — a bare `handicap` returns `0`
   for `null`. One live bare use: `src/client/ghin/models/handicaps/response.ts:20`
   (`handicap_index: handicap`), so `handicaps.getOne` reports a no-handicap golfer as scratch.
2. Every required `float` / `number` on a response schema — score-post `id`, `golfer_id`,
   `adjusted_gross_score`, `differential`; course/slope ratings; score differentials — silently
   becomes `0` on an explicit `null`.

## Live tracker

- [x] Phase 1 — `handicap` preserves `null` and `''` as `null` (validation.ts + validation.test.ts)
- [x] Phase 2 — `handicaps/response.ts:20` → `handicap.nullable()` with sibling-style comment + test
- [x] Phase 3 — add `strictFloat` / `strictNumber` and apply at audited response fields + tests
- [x] Phase 4 — changeset (`minor`: new export + previously-`0` parses now reject)
- [x] Review findings applied
- [ ] Manual verification (see below)

## Decisions

- **Q1 — where the null guard lives: opt-in strict helper** (user-confirmed). Blanket redefinition of
  `float`/`number` via `z.preprocess` returns `ZodEffects` and loses `.int()/.min()/.max()/.positive()`,
  breaking 7 call sites, and would turn `getScores` nulls (`scores/response.ts:14-18`, no
  `partitionRows` salvage) into whole-response failures. `float`/`number` stay untouched; new
  `strictFloat`/`strictNumber` are applied only where a `null` is plausible and a fabricated `0`
  is load-bearing.

## Assumptions

- **Q2** — after the `handicap` reorder, `handicaps/response.ts:20` still gets an explicit
  `.nullable()` wrapper, matching `course-handicap.ts:72` and `course-player-handicap.ts:16,18`
  verbatim so the three siblings agree.
- **Q3** — `''` maps to `null` (not rejection) in `handicap`, alongside `'NH'` / `'-'`. `''` is
  GHIN's documented "no value" sentinel (`post-response.ts:27-33`, `emptyStringToNull`).
- Request-side schemas (our own inputs) and `gpa/access.ts` (string IDs proven on the wire) keep the
  coercing `number`.
- `scores/response.ts` (`average`, `highest_score`, `lowest_score`) is left on coercing `float`/`number`
  — no salvage there, and `null` on an empty score history is plausible.
- **Phase 3** — `strictFloat`/`strictNumber` are `z.preprocess(null | '' → undefined, float | number)`,
  so a null fails with the same `Expected number, received nan` issue a missing key already produces.
  `strictNumber` is built on `number` (so `.int()` still applies) rather than on `strictFloat`.
- `schemaScore` (`scores/score.ts`) switched even though `schemaScoresResponse` wraps it in a plain
  `z.array`, not `partitionRows` — one null differential now rejects the whole `getScores` response.
  Documented in the schema comment; no captured payload carries a null there, and the right follow-up
  if one appears is `partitionRows` in `scores/response.ts`, not a nullable rating.
- Score-post `id`/`golfer_id`/`adjusted_gross_score`/`differential` switched to strict against the
  `post-response.ts` leniency paragraph, argued in the comment: a fabricated `0` score for golfer `0`
  is worse than the rejected parse, since it is wrong rather than lost.

- **Review #2 — `getScores` blast radius.** The reviewer offered (a) add `partitionRows` + `onDegraded` to
  `scores/response.ts` in this PR, or (b) keep `schemaScore` strict and gate the release on the UAT checks
  below. Took (b): partitioning `getScores` changes its published response shape (new `invalid` key) and is
  its own issue, while score differentials are the motivating example in #63. The changeset now says
  plainly that `getScores` and `courses.getTeeSetRating` fail the whole call.
- **Review #7** — the `ponytail:` prefix on the strict-helper comment stays: the deferred blanket fix to
  `float`/`number` is real debt the ledger should track.
- Whitespace-only strings are treated as blank (`null` in `handicap`, rejected by `strictFloat`/`strictNumber`),
  matching `emptyString = z.string().trim()`.

## Manual verification

**Probed against `api-uat.ghin.com` on 2026-09-01** with the 13 Druid staging golfers
(`13373246`–`13373258`) and course `146`. Results below; only item 2 remains, because it needs a
score post, which cannot be undone.

Carried from recon; unit tests cannot prove these:

1. Post a score to a UAT test golfer and confirm whether `differential` is ever `null` for a
   `Temporary` / `UnderReview` score (log raw body in `RequestClient._fetch`). UAT + designated test
   golfer only — score posts cannot be undone.
2. `handicaps.getOne` against staging golfer `13373258` — confirm `golfer.handicap_index` is literally
   `null` on the wire (not `"NH"` or absent).
3. Whether `handicap_index: ''` ever occurs on the wire.
4. `getScores` on a golfer with zero posted scores — capture `average`/`highest_score`/`lowest_score`.
5. Whether any `float`-typed rating/differential ever arrives quoted (would justify keeping coercion
   in `strictFloat`).
6. `schemaStatistics` against a golfer with a real statistics block — every fixture has
   `statistics: null`, so it is unexercised by real data.
7. Sandbox vs production shape (`null` vs absent vs `"NH"`).
8. Downstream consumer: any `typeof x === 'number'` on `handicap_index` / `differential` now sees
   `null` where it saw `0`.
9. `bun run build && grep -n "handicap_index" dist/index.d.ts` — confirm no emitted type widened.

### Results

1. **`getScores` nulls — CLEAR.** 84 scores across all 13 golfers. Every `course_rating`,
   `slope_rating`, `differential` and `unadjusted_differential` is a real JSON number — none null,
   absent or quoted. The set includes `UnderReview/T`, `UnderReview/H` and `Temporary/C` scores,
   which is the exact scenario #63 named as the plausible null source, so the review's Major
   finding (the unpartitioned `getScores` blast radius) is answered with data rather than deferred.
   `getScores` runs end-to-end through the new strict schemas for both an established golfer and
   the no-index golfer.
2. **Score-post response — CLEAR.** Posted one adjusted score (94, 18 holes) to staging golfer
   `13373258` at course `2539`, women's Blue tees, on 2026-09-01; score id `1138055394`, permanent.
   The raw response carries `id: 1138055394`, `golfer_id: 13373258`, `adjusted_gross_score: 94`,
   `differential: 13.4` — all real numbers, none null — and the whole payload parses through the
   new strict `schemaScorePostResponse`. GHIN returned `status: "Validated"`, so a `Temporary` /
   `UnderReview` post was not reproduced directly; the read-back in item 1 covers those, since it
   includes `UnderReview` and `Temporary` scores with real differentials.
3. **`handicap_index` on the wire — assumption corrected.** `/search_golfer.json`, the endpoint
   behind `handicaps.getOne`, returns **404 on UAT** for all 13 golfers and every parameter
   variant tried (`ghin`, `golfer_id`, `ghin_number`, none), while `scores` succeeds on the same
   token. So the field could not be observed there at all. On `golfers.search`, which does work,
   `handicap_index` is the **string `"NH"`** for golfer `13373258`, not a `null`. The Phase 2
   change stays — it is correct and now a no-op given the Phase 1 helper fix — but the changeset
   claim that a `null` was verified there was wrong and has been corrected.
4. **`getScores` summary fields — CLEAR.** `average`, `highest_score`, `lowest_score` and
   `total_count` are numbers for all 13 golfers. Caveat: every staging golfer has at least two
   scores, so the zero-scores case is still unobserved.
5. **Quoted floats — CLEAR.** No rating or differential arrives quoted anywhere in the probed
   payloads. `handicap_index` does arrive as a string, but that field uses the `handicap` helper,
   which takes strings by design.
6. **Sandbox vs production — OPEN.** Only the UAT credentials are active in `.env`; production is
   Spicy's and unreachable from here.
7. **Downstream consumer — OPEN.** Owner's call; nothing in this repo can check Spicy's
   `typeof x === 'number'` guards.
8. **Emitted types — CLEAR.** The reviewer diffed `dist/index.d.ts` against a fresh `origin/main`
   build: no output type changed.

### Follow-up worth its own issue

`/search_golfer.json` 404s on UAT for every golfer and parameter combination, so
`handicaps.getOne` cannot succeed there. This is the same shape of finding as the dead
`getPlayingHandicaps` in #62. It may still exist on production, so it is recorded rather than
acted on.

### Noted while posting, not acted on

The score-post response for a golfer with no established index carries `handicap_index: 999`,
`handicap_index_display: "NH"`, `net_score: 999` and `course_handicap: "NH"` — GHIN's own magic
sentinel rather than a `null`. This is the same *class* of hazard #63 addresses (a number that
passes a `typeof x === 'number'` guard but is not a real handicap), but a different cause: the
library is faithfully reporting what GHIN sent, not fabricating it through coercion. Worth its own
issue if consumers should see `null` there.
