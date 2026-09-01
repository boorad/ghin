# 66 — `score_type` `T` means Competition, not Tournament

## Problem

#65 relabelled `C: 'COMBINED'` → `C: 'COMPETITION'`. Validating against UAT
afterwards showed the letter actually in play on `/scores.json` is not `C` at
all — it is `T`, and GHIN itself renders every `T` row as `C` / `CA` / `NCA`.

Raw `/scores.json` (Zod bypassed) for the four seeded UAT golfers `13373246`,
`13373247`, `13373248`, `13373258`, `from_date_played=2010-01-01`, 38 scores:

| `score_type` (wire) | `..._display_short` | `..._display_full` | `number_of_holes` | count |
|---|---|---|---|---|
| `A` | `A` | `A` | 18 | 21 |
| `A` | `N` | `NA` | 9 | 6 |
| `H` | `H` | `H` | 18 | 6 |
| `T` | `C` | `C` | 18 | 2 |
| `T` | `C` | `CA` | 18 | 2 |
| `T` | `N` | `NCA` | 9 | 1 |

`score_types=T` returns exactly those 5 rows; `score_types=C` returns 0.

So `T: 'TOURNAMENT'` is the real mislabel. GHIN kept the pre-2020 storage letter
and moved the display to the WHS name. `score_type_display_full` is
compositional — `[N]` + `[C]` + `[A]` — so `CA` is "Competition Away" and `NCA`
is "nine-hole Competition Away", which closes the open question from #59.

## Live tracker

- [x] Phase 1 — Relabel `T` → `'COMPETITION'`, drop `'TOURNAMENT'` from the output union, rewrite the comment, update the transform tests
- [x] Phase 2 — Partition `schemaScoresResponse` rows with `partitionRows` + `onDegraded`
- [x] Phase 3 — Changesets: new `minor` changeset, and correct the unreleased `.changeset/score-type-competition.md`

## Decisions

Both asked before any code was written.

- **`N` / `'9_HOLE_ROUNDS'` stays.** Removing it would narrow the caller-facing
  `ScoresRequest['score_types']` input at `scores/request.ts:11` — a second,
  independent compile break — and the evidence against `N` is "probably" plus
  absence in a 38-row UAT sample, which is the same absence-of-evidence the
  issue itself says is too weak to drop `C`. Same standard for both letters.
  Record the #66 finding as a comment instead.
- **Fix the leniency gap here, with `partitionRows`.** `schemaScoresResponse`
  wraps scores in a plain `z.array(schemaScore)`, so today one unrecognised
  `score_type` letter — or one null differential, per #63 — rejects the entire
  `getScores` response. `score.ts:53-56` already prescribes `partitionRows` as
  the fix; this change touches those exact lines, so close it now rather than
  filing a follow-up. Preferred over `.catch()` on the transform, which would
  have required inventing an `'UNKNOWN'` union member in the same release that
  removes one.

## Assumptions

- **Keep `C` accepted, still mapping to `'COMPETITION'`.** It did not appear on
  `/scores.json`, but the absence is unproven — a control query with a bogus
  letter (`score_types=Z`) also returns 0 rows, so the filter cannot distinguish
  "no such rows" from "unrecognised letter". `PATCH /scores/hbh/{id}` documents
  `score_type` as `["H","A","C"]`, so `C` is plausibly live on another surface.
  Two letters mapping to one meaning costs nothing.
- **Leave `post-request.ts` (`z.enum(['H','A','T'])`) alone.** That is the
  letter we *send*; GHIN's POST spec documents `T` and it is a separate contract
  from what we parse.
- **Changeset is `minor`, not `patch`.** #65 was `patch`, but this PR adds an
  `invalid` key to the `getScores` response, and the repo's two real precedents
  for shipping partitioning (#51, #53) both went out as `minor`
  (`plans/done/62-handicap-index-suffix-leniency.md:129-133`). The relabel alone
  would have been `patch`; the partitioning sets the bump.
- **`.changeset/score-type-competition.md` (#65, unreleased) must be corrected.**
  Package is at `0.15.4` and that changeset has not shipped. Its last sentence
  says the `T` → `'TOURNAMENT'` mapping is kept — if left alone, the next
  CHANGELOG claims `T` → `'TOURNAMENT'` is preserved in the same release that
  removes it.

## Note on plan-doc history

A concurrent session committed `d25402a`, overwriting this doc with a version
that predated the structural answers — it recorded "None asked", dropped the
`partitionRows` phase, and specified `patch`. This version supersedes it and is
authoritative: both forks *were* put to the user, who chose "keep `N`" and "fix
the leniency gap here with `partitionRows`". The manual-verification list below
is carried over from `d25402a`, which had it right.

## Manual verification (carried to Phase 6.5 — do NOT auto-push)

1. Confirm against **production** credentials that prod `/scores.json` emits `T`
   (not `C`) for Competition rows. All evidence is UAT/staging, 4 golfers, 38
   scores.
2. Absence of `C` on `/scores.json` is unproven (a bogus letter also returns 0
   rows). `C` stays accepted, which sidesteps needing to prove this; spot-check a
   real `PATCH /scores/hbh/{id}` response if reachable.
3. `E` and `P` mappings unverified against any real payload (no seeded data).
4. Confirm the `T` → `C`/`CA`/`NCA` correspondence on a second data set — widen
   `SCORE_KEYS_GOLFERS` in `src/playground/score-keys.ts` beyond the four seeded
   golfers and re-check that every wire-`T` row displays as `C*`.
5. Round-trip a posted score: `post-request.ts` sends `T`; post one, fetch it
   back via `/scores.json`, confirm it returns wire `T` and parses to
   `'COMPETITION'`.
6. Grep the Spicy consumer for `'TOURNAMENT'` before releasing — an exhaustive
   `switch` there stops compiling, and a loose string comparison silently stops
   matching, which is worse.
