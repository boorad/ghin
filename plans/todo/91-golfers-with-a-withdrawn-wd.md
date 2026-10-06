# #91 — Golfers with a withdrawn ("WD") Handicap Index are dropped from golfers.search

## Problem

GHIN sends bare `"WD"` in `handicap_index`, `low_hi`, `hi_display` and `low_hi_display` for a golfer whose
Handicap Index is withdrawn (with `hi_value: 999`, `hi_withdrawn: true`). The shared `handicap` validator in
`src/models/validation.ts` only accepts `"NH"` / `"-"` as no-handicap markers, so the row fails and
`partitionRows` drops it into `invalid`. `golfers.search`, `getOne`, `getMany`, `globalSearch` and
`handicaps.getOne` all lose the golfer. Reproduced live on UAT with GHIN 13374361.

## Live tracker

- [x] Phase 1: accept `"WD"` in `handicap` (→ `null`), fix the `12.4WD` JSDoc, tests in
      `validation.test.ts` and `golfers/search.test.ts`
- [ ] Verify against UAT (golfer 13374361)

## Decisions

None asked — no structural forks.

## Assumptions

- Withdrawn and no-handicap both parse to `handicap_index: null`. The distinction survives in `hi_display: 'WD'`
  and the passthrough `hi_withdrawn`. Typing `hi_withdrawn` on `schemaGolfer` is additive (minor) and left for a
  separate issue if Spicy needs to render "withdrawn".
- Exact match on `'WD'` only; unknown markers (`'M'`, `'wd'`) stay rejected so they still surface via `onDegraded`.
- Only the golfer record carries `"WD"` (scores, course handicaps and course-player handicaps send `"NH"` for the
  same golfer on UAT); they share `handicap`, so they're covered anyway.
- Changeset bump: `patch` (matches #56, #85 validator-loosening precedent).
