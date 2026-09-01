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

- [ ] Phase 1 — `handicap` preserves `null` and `''` as `null` (validation.ts + validation.test.ts)
- [ ] Phase 2 — `handicaps/response.ts:20` → `handicap.nullable()` with sibling-style comment + test
- [ ] Phase 3 — add `strictFloat` / `strictNumber` and apply at audited response fields + tests
- [ ] Phase 4 — changeset (`minor`: new export + previously-`0` parses now reject)
- [ ] Review findings applied
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

## Manual verification

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
