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

Swap `float` → the `handicap` helper on `handicap_index` in both files, then
partition both list responses so a single malformed row degrades rather than
failing the batch. The sibling `course_handicap` / `playing_handicap` fields are
deliberately left as-is — see Decision 2.

## Scope change 2026-09-01 — verified against staging, premise was wrong

Everything above this line was written from the schemas. Probing `api-uat.ghin.com`
with the Druid Golf test golfers (13373246/47/48 established, 13373258 = `NH`)
disproved the central claim. Issue #62 has been rewritten to match; fixtures
captured verbatim in `src/client/ghin/models/handicaps/__fixtures__/index.ts`.

What staging actually shows:

1. **`handicaps.getCourseHandicaps` is 100% broken.** `GET /course_handicaps.json`
   returns `{ tee_sets: [...] }` with the handicap nested at
   `tee_sets[].ratings[].course_handicap`. It has no `course_handicaps` key and no
   `handicap_index` anywhere. Every call throws `ValidationError`.
2. **`handicaps.getPlayingHandicaps` is 100% broken.** It sends a single
   `golfer_id`; the API requires `golfers[]` and answers `400` with
   `{"errors":{"golfers":["is required"]}}`. Same URL and same response shape as
   `getCoursePlayerHandicaps`.
3. **The real foursome bug is in `getCoursePlayerHandicaps`.** Reproduced: three
   established golfers succeed; the same three plus the `NH` golfer throw
   `ValidationError` and lose all four. Cause is `shots_off: "-"` →
   `Number("-")` = `NaN`, not `handicap_index`. `shots_off` is also a *string*
   on the wire, and `playing_handicap` is `null` for an NH golfer.
4. **`tee_set_side` must be `'All 18'` with a space** on these endpoints.
   `teeSetSide` (`src/models/validation.ts:151`) says `'All18'`, while
   `schemaTeeSetSide` (`handicaps/request.ts:5`) has it right. `teeSetSide` is
   shared with score posting, so it must NOT be changed globally — the handicap
   request schemas should point at the correct enum instead.

Consequence for the work already committed: Phases 1 and 2 hardened
`schemaCourseHandicapEntry` / `schemaPlayingHandicapEntry` and partitioned two
list responses that the API never returns. That work is inert and those schemas
are replaced below. The `handicap_index` → `handicap` helper swap is kept where
it survives, as correct hardening that simply was not the reported cause.

**Risk accepted:** all observations are from UAT. If production returns a
structurally different shape for `/course_handicaps.json`, these schemas are
wrong again. Judged unlikely — the difference here is structural, not a
data-dependent field — but it is the one thing worth re-checking against
production before a consumer depends on it.

## Live tracker
- [x] Phase 1 — Leniency on `handicap_index` (later deleted outright — the field does not exist on these endpoints)
- [x] Phase 1b — Sibling fields reverted to `float`/`number`, deferred to #63

- [x] Phase 2 — Partitioning on the two list responses (superseded by Phase 5, kept in history)
- [x] Phase 3 — Fixtures captured from staging into `handicaps/__fixtures__/`
- [x] Phase 4 — Fix the foursome bug: `playing_handicap` / `shots_off` leniency in `course-player-handicap.ts`
- [x] Phase 5 — Fix `getCourseHandicaps`: real `tee_sets` response schema + `'All 18'` enum
- [x] Phase 6 — Remove `getPlayingHandicaps` rather than fix it: repairing it (`golfers[]`
      request + percent-record response) would have produced a byte-for-byte duplicate of
      `getCoursePlayerHandicaps`, which already POSTs the same URL with the right request
      shape. The method, `playing-handicap.ts` and the `PlayingHandicap*` schemas/types are
      deleted, along with the now-unreferenced `playing_handicaps_post` entity.
- [x] Phase 7 — Partition `getCoursePlayerHandicaps` per golfer inside each percentage bucket
      and wire `reportDegradation` (entity `course_handicaps`). Phase 4 fixed the two values
      GHIN was known to send, but each bucket was still an all-or-nothing `z.record(...)`: one
      unmodelled status string (`'N/A'`, a new suffix) for one golfer would again lose the whole
      foursome with no `onDegraded` to report it. Rejects surface as
      `{ golfer_id, row }` hoisted to a response-level `invalid`, deduplicated by `golfer_id` so
      a golfer failing in all twenty buckets reports once. The twenty buckets stay required —
      see Decision 3.

## Decisions

Both asked and answered before implementation:

1. **Partitioning ships in this PR**, as a separate commit (Phase 2) — not
   deferred to a follow-up issue. Matches the #57 and #58/#61 precedent of
   fixing the field that prompted the issue *and* bringing the schema in line
   with the leniency policy. It is also the only mechanism this repo has for
   noticing the next GHIN payload change on these two endpoints.
2. **The sibling fields are left alone, deferred to #63** — *reversed on 2026-09-01
   by live evidence; recorded here because the reasoning changed, not just the
   answer.* The original decision kept `course_handicap` / `playing_handicap` as
   `float` / `number` on the grounds that no evidence showed GHIN sending `null`
   there, and that widening them would pre-decide #63's repo-wide rule.

   Staging settled it: GHIN sends `course_handicap: null` (with
   `course_handicap_display: 'NH'`) and `playing_handicap: null` for any golfer
   with no established index. That is routine, not exceptional. So both are now
   `handicap.nullable()` and the emitted type widens to `number | null`.

   This does **not** pre-empt #63. #63 is about `z.coerce.number()` silently
   *corrupting* a value — turning an explicit `null` into a fabricated `0` on a
   field that is genuinely required. These two fields are different: the `null`
   is a real, documented value meaning "this golfer has no handicap". Declaring
   them nullable models the API; it does not decide what to do about required
   numerics elsewhere. `course_rating` / `slope_rating` in the new tee-set schema
   are left as required `float` precisely so that call stays with #63.


## Assumptions

Self-answered, not asked:

- **Published surface: `minor`.** Corrected during review — an earlier draft of
  this doc claimed "#51, #53, #57 all shipped partitioning as `patch`", which is
  wrong on every count. Verified against the commits: #51 (`c577576`) and #53
  (`40a24b8`) both shipped partitioning as **`minor`**, and #57 (`a5f84ff`) was
  `patch` but added no `partitionRows` at all (`git show a5f84ff | grep -c
  partitionRows` → 0). So the only two real precedents for "add an `invalid` key
  and stop throwing on a bad row" are both `minor`.

  The type of `handicap_index` (`number | null | undefined`) is unchanged and the
  siblings stay `number`, so Phase 1/1b on its own would be a `patch`. Phase 2 is
  what forces `minor`: adding a `.transform()` turns the two exported response
  schemas from `ZodObject` into `ZodEffects`, so `.shape`, `.extend()`, `.pick()`,
  `.merge()`, `.partial()` and `.passthrough()` stop compiling for any consumer
  calling them. Parsing is unaffected.
- **Use `.nullish()`, not `.nullable().optional()`**, per the standing convention
  in `.changeset/estimated-handicap-display.md`: GHIN drops keys entirely rather
  than nulling them (#46, #51, #55, #56, #57). Matches `golfers/search.ts:71`.
- **Both entry schemas keep `.passthrough()`** — dropping it would silently strip
  fields GHIN adds.
- Schema assertions go in co-located model test files, **not** `index.test.ts` —
  those tests mock `httpClient.fetch`, so the schema never runs there and any
  assertion added would pass regardless.

## Review outcomes

Reviewed by a fresh agent that did not write the code. The implementation itself
needed no changes — schema, transform and degradation wiring were all correct and
consistent with `golfers/search.ts`. Every finding was in the changeset/plan/test
layer, and all were applied:

- Changeset bumped `patch` → `minor`, with the precedent claim corrected (above).
- Changeset now discloses the `ZodObject` → `ZodEffects` surface change.
- Changeset dropped the incorrect `#57` attribution from the partitioning list.
- Changeset softened "returned nothing for anyone" to the mechanism, since the
  batch failure on *these two* endpoints is inferred from #56 rather than
  captured — see Manual verification item 1.
- Raw-`invalid` assertions strengthened from `toEqual` to `toBe`, so they pin
  object identity rather than structural equality — which is what "untransformed"
  actually means.
- Added `should survive an onDegraded callback that throws` to both endpoints,
  for parity with the `courses.search` precedent.

Noted and deliberately not acted on: the `onDegraded` tests in `index.test.ts`
mock `httpClient.fetch`, so they pin the wiring (entity string, `total`
expression, `sample` identity) but would still pass if the response schemas were
reverted to plain `z.array(...)`. The end-to-end proof lives in the model tests.
Same limitation as the `courses.search` precedent.

## Manual verification

Items 1-3 of the original list are **closed** — they were answered directly by
probing `api-uat.ghin.com` on 2026-09-01 rather than left for a human, and the
captured payloads are committed in `handicaps/__fixtures__/index.ts`. The
`handicap_index` suffix question is void: that field does not exist on either
endpoint.

Verified live, after the fix:

- `getCoursePlayerHandicaps` with three established golfers **plus** the `NH`
  golfer returns all four; the `NH` golfer comes back `playing_handicap: null`,
  `shots_off: null`, `playing_handicap_display: 'NH'`. Before the fix it threw.
- `getCourseHandicaps` returns 15 tee sets with `invalid: []` for both an
  established golfer (`course_handicap: 11`) and the `NH` golfer
  (`course_handicap: null`). Before the fix it threw on every call.
- `getPlayingHandicaps` is gone from the client surface.

Still open, for a human:

1. **Production re-check.** Every observation here is from UAT. The shape
   difference found is structural rather than data-dependent, so production is
   very unlikely to differ — but nothing in this branch has touched
   `api2.ghin.com`, and the `tee_sets` schema is now load-bearing for
   `getCourseHandicaps`. Worth one call against production before a consumer
   depends on it.
2. **A golfer with an `M` / `WD` status.** The staging roster has an `NH` golfer
   but none carrying a committee-modified or withdrawn index, so the
   suffixed-value path (`"19.1M"`) is still covered only by unit tests against
   the `handicap` helper, not by a captured payload.
