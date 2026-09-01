# 62 — handicap_index suffix leniency on course/playing handicaps

## Problem

`handicap_index` on both handicap-entry schemas is declared as `float`
(`z.coerce.number()`), so a WHS-suffixed index like `"19.1M"` coerces to `NaN`
and fails the parse:

- `src/client/ghin/models/handicaps/course-handicap.ts:19`
- `src/client/ghin/models/handicaps/playing-handicap.ts:20`

Because these responses are plain `z.array(...)` (not `partitionRows`), a single
bad entry fails the **entire batch** — every other golfer's course/playing
handicap is lost, and `onDegraded` never fires because there is no partition to
report a drop from. Fetching course handicaps for a foursome where one player is
`WD` or `M` returns nothing for anyone.

The `handicap` helper (`src/models/validation.ts:117`) exists to cope with this
and was never adopted here. Same value that #56 fixed in `golfers.search`.

The sibling fields `course_handicap` and `playing_handicap` are required
`float`/`number` (both `z.coerce.number()` underneath). They carry the same NaN
hazard with no `.nullish()` cushion, plus a live correctness bug: `Number(null)
=== 0`, so an explicit `null` silently becomes a **scratch handicap**.

## Fix

Swap `float`/`number` → the `handicap` helper on all three numeric handicap
fields across both files, then partition both list responses so a single
malformed row degrades rather than failing the batch.

## Live tracker

- [ ] Phase 1 — Leniency: `handicap` on `handicap_index`, `course_handicap`, `playing_handicap` in both schemas; co-located model tests
- [ ] Phase 2 — Partitioning: `partitionRows` on both list responses, `reportDegradation` wired at both client call sites, tests

## Decisions

Both asked and answered before implementation:

1. **Partitioning ships in this PR**, as a separate commit (Phase 2) — not
   deferred to a follow-up issue. Matches the #57 and #58/#61 precedent of
   fixing the field that prompted the issue *and* bringing the schema in line
   with the leniency policy. It is also the only mechanism this repo has for
   noticing the next GHIN payload change on these two endpoints.
2. **The sibling fields get the helper too.** The type widening from `number` to
   `number | null` on `course_handicap`/`playing_handicap` is breaking for TS
   consumers, and that is accepted: it does not introduce a null, it reveals one
   that consumers already receive today silently coerced to `0`. Partitioning
   does not fix this — a `null` parses fine, it just parses to the wrong number.
   Only the helper swap does.

## Assumptions

Self-answered, not asked:

- **Published surface: `minor`.** Package is `0.15.4`; pre-1.0, the minor slot is
  the conventional home for a breaking change. The changeset must state the
  breaking type widening explicitly.
- **`playing_handicap` loses its `.int()` constraint** (`number` is
  `float.int()`). Accepted for one consistent rule across the three fields — a
  fractional playing handicap from GHIN was never the hazard being guarded
  against.
- **Use `.nullish()`, not `.nullable().optional()`**, per the standing convention
  in `.changeset/estimated-handicap-display.md`: GHIN drops keys entirely rather
  than nulling them (#46, #51, #55, #56, #57). Matches `golfers/search.ts:71`.
- **Both entry schemas keep `.passthrough()`** — dropping it would silently strip
  fields GHIN adds.
- Schema assertions go in co-located model test files, **not** `index.test.ts` —
  those tests mock `httpClient.fetch`, so the schema never runs there and any
  assertion added would pass regardless.

## Manual verification (carried to Phase 6.5)

1. Confirm GHIN's course/playing handicap endpoints actually return the suffix in
   `handicap_index` the same way `golfers.search` does — the batch failure is
   inferred by analogy to #56, not directly observed on these endpoints. Log the
   raw body inside `RequestClient._fetch` before `schema.safeParse`.
2. Same capture: what do `course_handicap` / `playing_handicap` contain for a
   golfer with no established index — `"NH"`, `null`, a suffixed string, or a
   plain number? This is the live evidence for Decision 2.
3. The foursome case end to end against UAT: POST `playing_handicaps` with 4
   golfers where exactly one has a suffixed index. Confirm nothing comes back on
   `0.15.4` and all four come back after the fix.
4. Sandbox vs production: suffixed indexes are a production-data phenomenon and
   UAT test golfers may never carry an `M`/`WD` status. A clean UAT run does not
   clear item 1.
5. Downstream, after publish: any consumer doing arithmetic on
   `course_handicap`/`playing_handicap` now has to handle `null`, and anyone
   catching the `ValidationError` these endpoints used to throw on a bad row will
   find that throw no longer happens.
