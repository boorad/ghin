# 64 — schemaScore is not .passthrough()

## Problem

`schemaScore` (`src/client/ghin/models/scores/score.ts`) was a plain `z.object`,
so Zod stripped any undeclared key. The scores list is the endpoint most likely
to grow fields (USGA surfaces new score attributes there), and every one was
silently deleted in the library before a consumer could see it — no error to
canary on. Its siblings `schemaScorePostResponseInner`, `schemaGolfer`, and the
handicap-entry schemas are already `.passthrough()`; `schemaScore` was an
oversight.

## Fix

Add `.passthrough()` to `schemaScore`. Undeclared keys now reach consumers typed
`unknown` via the emitted index signature (`& { [k: string]: unknown }`) — a
widening, not a breaking change. Test asserts via `toHaveProperty` to sidestep
the TS4111 / biome `useLiteralKeys` conflict on index-signature access.

## Live tracker

- [x] Add `.passthrough()` + test + changeset
- [x] Nested passthrough — the rest of the score tree

## Decisions

- The user chose to widen the whole score tree, not just the score row: a
  `.passthrough()` on `schemaScore` does not reach inside its nested object
  schemas, which strip unknown keys independently. So `schemaHoleDetail`,
  `schemaStatistics`, `schemaScoringAdjustment` and the `schemaScoresResponse`
  envelope are `.passthrough()` too — matching the all-levels precedent in
  `course/tee-set-rating.ts` and `gpa/access.ts`. Purely additive: no declared
  field's validation changed, and `scores` stays a plain `z.array`, not
  `partitionRows`.

## Assumptions

- Ship as `patch`: this is a fix/widening, not a new declared capability. Naming
  the specific fields dropped today is a follow-up requiring a live scores-list
  payload not captured in this repo.

## Manual verification

- Capture a real scores-list payload and diff against the 40 declared keys to
  learn which fields are being dropped today. Requires a live GHIN call; cannot
  be proven by unit tests. Follow-up, not blocking this fix.

## Live UAT capture (2026-09-01)

Ran `src/playground/score-keys.ts` against `api-uat.ghin.com`: 85 score rows,
13 golfers (`13373246`–`13373258`, including the `NH` golfer `13373258`),
396 hole details, 26 statistics blocks, 0 adjustments. Statuses `Validated`
(82), `UnderReview` (2), `Temporary` (1). Score types `A`/`T`/`H`/`C` only —
`N`, `E`, `P` return no rows in UAT.

**Undeclared on the score row (13):** `handicap_index` (`999` = NH sentinel),
`handicap_index_display` (`"NH"`), `course_handicap` (**string**, e.g. `"-7"`),
`to_par_display_value` (`"-"` sentinel), `net_score`, `posted_on_home_course`,
`short_course`, `scaled_up_differential`, `adjusted_scaled_up_differential`,
`validation_message` + `validation_message_display` (`UnderReview` rows only),
and `challenge_available` + `country_code` (null on all 85 rows — real type
unknowable, leave to passthrough).

**Undeclared in `statistics` (8):** `birdies_or_better_total`, `bogeys_total`,
`double_bogeys_total`, `pars_total`, `triple_bogeys_or_worse_total`,
`one_putt_or_better_total`, `two_putt_total`, `three_putt_or_worse_total` —
all JSON **strings** (`"3"`), while the sibling `*_percent` fields are numbers.

**Clean:** the `schemaScoresResponse` envelope and `hole_details[]` had zero
undeclared keys. **Unproven:** `adjustments[]` was `[]` on every row — no
coverage, do not read that level as clean.

**Also:** `course_id`, `course_name` and `facility_name` are declared but never
sent — the UAT scores list carries no course identity at all.

**Environment note:** Spicy runs against UAT too, so this capture is
authoritative for the current consumer rather than a proxy for production.
PROD access is close but not live as of 2026-09-01; once it lands, re-run
`src/playground/score-keys.ts` against it — a PROD-only key would be carried by
passthrough anyway, but a PROD-only *shape* (string vs number) would not be.

## Decisions

- Whole score tree gets `.passthrough()`, not the score row alone (user call).
  Matches `course/tee-set-rating.ts` and `gpa/access.ts`, which passthrough at
  every level. One type-widening release instead of three.
- Declaring the 21 discovered fields is **out of scope here** and filed as a
  follow-up (user call) — it is a `minor`, and the traps (999 sentinel, string
  `course_handicap`, `"-"` sentinel, string counters) deserve their own review.
  Issue #64 itself says "Then, separately".

## Assumptions

- `src/playground/score-keys.ts` kept and committed rather than discarded: the
  other playground scripts are checked in, and it reads declared keys from
  `Object.keys(schema.shape)` so it stays correct as schemas change.
- `schemaScorePostResponse` also got `.passthrough()` (review finding) — same
  defect class, one line, same `patch`, and it was the last plain `z.object`
  left in the scores module.
- The +86 KB `dist/index.d.ts` growth (239 KB → 325 KB, +36%) is accepted
  knowingly: each `.passthrough()` emits its shape three times and the tree
  nests. Called out in the PR body.

## Carried

- **Dropped-key risk is still open** (owner: follow-up issue).
  `schemaStatistics` has 27 required fields and `schemaHoleDetail` 13, all
  inside a plain `z.array(schemaScore)` with no `partitionRows` — one key GHIN
  stops sending still fails the entire `getScores` call. This branch hardens
  drift in one direction only.
- **`scores/index.ts` never re-exports `./score`** (owner: follow-up issue), so
  `Score`, `ScoreType`, `ScoreStatus` and `schemaScore` are absent from the
  package export list while `HoleDetail`, `Statistics` and `ScoringAdjustment`
  are present. Pre-existing; surfaced by this work.
