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

## Live tracker

- [x] Phase 1 — Leniency: `handicap` on `handicap_index`, `course_handicap`, `playing_handicap` in both schemas; co-located model tests
- [ ] Phase 1b — Revert the sibling fields to `float`/`number` per Decision 2's reversal; document `null` → `0` for #63
- [ ] Phase 2 — Partitioning: `partitionRows` on both list responses, `reportDegradation` wired at both client call sites, tests

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
   `null` before the inner union.

## Assumptions

Self-answered, not asked:

- **Published surface: `patch`.** With Decision 2 reversed, the emitted type of
  `handicap_index` (`number | null | undefined`) is unchanged and the siblings
  stay `number`; only previously-rejected inputs now parse. Matches #56. Phase 2
  adds an `invalid` key to both responses — additive, and `patch` by this repo's
  precedent (#51, #53, #57 all shipped partitioning as `patch`).
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
