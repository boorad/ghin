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
- [x] Phase 1 — Leniency: `handicap` on `handicap_index` in both entry schemas (kept; inert but correct)
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

## Decisions

Both asked and answered before implementation:

1. **Partitioning ships in this PR**, as a separate commit (Phase 2) — not
   deferred to a follow-up issue. Matches the #57 and #58/#61 precedent of
   fixing the field that prompted the issue *and* bringing the schema in line
   with the leniency policy. It is also the only mechanism this repo has for
   noticing the next GHIN payload change on these two endpoints.
2. **The sibling fields are left alone, deferred to #63.** Initially decided the
   other way (widen `course_handicap`/`playing_handicap` to `number | null` via
   the helper), then reversed once #63 was brought into scope. #63 is the
   repo-wide issue for exactly this hazard — `z.coerce.number()` turning an
   explicit `null` into `0` — and it proposes the *opposite* remedy: reject
   `null` so it fails loudly, rather than accept it and surface it. Resolving one
   instance here in the other direction would pre-decide #63's repo-wide rule
   from inside an unrelated PR, and would cost a breaking type widening to do it.

   Phase 2's partitioning already softens the case for acting now: once rows are
   partitioned, a genuinely malformed entry degrades and fires `onDegraded`
   instead of failing the batch, which is the loud-not-silent outcome #63 wants.
   So these two fields keep `float` / `number`, and a test documents today's
   `null` → `0` behaviour as the landing spot for #63.

   Note for #63, found while implementing this: the `handicap` helper itself has
   the bug. `handicap` is `z.union([float, z.string(), z.null()])` and Zod unions
   take the first success, so `float` (`z.coerce.number()`) swallows `null` as
   `0` and the `z.null()` branch is unreachable. Any **bare** `handicap` is
   therefore affected — `src/client/ghin/models/handicaps/response.ts:16` is a
   live instance. `handicap.nullish()` is safe because the wrapper short-circuits
   `null` before the inner union. Also for #63: `handicap_index: ''` yields `0`
   for the same reason (`Number('') === 0`), a live instance shared with
   `golfers.search`.

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

## Manual verification (carried to Phase 6.5)

1. Confirm GHIN's course/playing handicap endpoints actually return the suffix in
   `handicap_index` the same way `golfers.search` does — the batch failure is
   inferred by analogy to #56, not directly observed on these endpoints. Log the
   raw body inside `RequestClient._fetch` before `schema.safeParse`.
2. Same capture: what do `course_handicap` / `playing_handicap` contain for a
   golfer with no established index — `"NH"`, `null`, a suffixed string, or a
   plain number? This is the live evidence #63 needs, and it decides whether
   these two fields are actually exposed to the `null` → `0` hazard in practice.
3. The foursome case end to end against UAT: POST `playing_handicaps` with 4
   golfers where exactly one has a suffixed index. Confirm nothing comes back on
   `0.15.4` and all four come back after the fix.
4. Sandbox vs production: suffixed indexes are a production-data phenomenon and
   UAT test golfers may never carry an `M`/`WD` status. A clean UAT run does not
   clear item 1.
5. Downstream, after publish: anyone catching the `ValidationError` these
   endpoints used to throw on a bad row will find that throw no longer happens —
   the row comes back in `invalid` and `onDegraded` fires instead.
