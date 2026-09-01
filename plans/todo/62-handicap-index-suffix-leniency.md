# 62 — handicap_index suffix leniency on course/playing handicaps

## Problem

`handicap_index` on both handicap-entry schemas is declared as `float`
(`z.coerce.number()`), so a WHS-suffixed index like `"19.1M"` coerces to `NaN`
and fails the parse:

- `src/client/ghin/models/handicaps/course-handicap.ts:19`
- `src/client/ghin/models/handicaps/playing-handicap.ts:20`

Because these responses are plain `z.array(...)` (not `partitionRows`), a single
bad entry fails the **entire batch** — every other golfer's course/playing
handicap is lost. The `handicap` helper (`src/models/validation.ts:117`) exists
to cope with this and was never adopted here. Same value that #56 fixed in
`golfers.search`.

## Fix

Swap `float` → `handicap` for the `handicap_index` field in both schemas
(keep `float`/`number` for the genuine numeric `course_handicap`/`playing_handicap`
fields). Add tests for `"19.1M"`, `"NH"`, and a plain number.

## Live tracker

- [ ] Phase 1 — Schema fix: swap `float` → `handicap` for `handicap_index` in both files; add changeset
- [ ] Phase 2 — Tests: co-located tests for both entry schemas (`"19.1M"`, `"NH"`, plain number)

## Decisions

(none asked — issue text was unambiguous)

## Assumptions

- **Defer the `partitionRows` degradation change.** The issue explicitly notes
  it "could be its own issue." The `handicap` helper swap fully resolves the
  reported failure (suffixed index no longer fails, so no longer takes down the
  batch). Converting `course_handicaps`/`playing_handicaps` to partitioned rows
  is a breaking response-shape change (adds `invalid`, changes emitted types)
  and out of scope. Flag as a follow-up.
- **Published surface: `patch`.** Emitted type of `handicap_index`
  (`number | null | undefined`) is unchanged; only previously-rejected inputs
  now parse. Matches #56.
- Keep the existing `.nullable().optional()` spelling to minimize the diff.

## Manual verification (carried to Phase 6.5)

1. Confirm GHIN's course/playing handicap endpoints actually return the suffix
   in `handicap_index` the same way `golfers.search` does (batch failure is
   inferred by analogy to #56, not directly observed on these endpoints).
2. Under the deferred-partitioning decision, these two endpoints still
   hard-fail on genuinely malformed (non-suffix) rows and `onDegraded` will not
   fire — note this asymmetry in the changeset/PR so consumers aren't surprised.
