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

## Manual verification — done 2026-09-01 against UAT

Probed with `src/playground/wire-score-types.ts` (raw `z.any()` fetch, so the wire letter is
visible pre-transform) across all 13 seeded staging golfers, `from_date_played=2000-01-01`,
85 scores — not the 4 golfers / 38 scores the issue reported.

| # | Item | Result |
|---|---|---|
| 1 | Production `/scores.json` emits `T` | **NOT DONE — no prod credentials.** `.env` holds UAT only (sandbox entries commented out). Re-run `wire-score-types.ts` when prod access lands. |
| 2 | `T` → `C`/`CA`/`NCA` on a second data set | **CONFIRMED.** 8 `T` rows across 13 golfers; every one displays `C`, `CA` or `NCA`; none displays `T`. |
| 3 | Round-trip a posted score | **CONFIRMED.** Posted via `scores.postAdjusted` with `score_type: 'T'` (Pebble Beach GL, id 1138055400); read back raw as wire `T` / short `C` / full `CA`; parsed to `'COMPETITION'`. Send-letter and parse-letter are the same letter. |
| 4 | Grep the Spicy consumer for `'TOURNAMENT'` | **CLEAN — zero hits.** Spicy's own `ScoreType` (`packages/app/src/hooks/usePostScorePreview.ts:40`) is `'H' \| 'A' \| 'T'`, the *outbound* POST letters, unrelated to our parsed union. Its only read of a parsed `score_type` is a log string (`packages/api/src/index.ts:786`). Spicy pins `@spicygolf/ghin` 0.15.4. Spicy is relabelling Tournament → Competition in its own #1139. |
| 5 | Spot-check `PATCH /scores/hbh/{id}` for `C` | **MOOT.** A live wire `C` row was found directly on `/scores.json`, so `C`'s presence no longer needs inferring from the PATCH spec. Not attempted — it is a mutation and this library exposes no such method. |
| 6 | `E` / `P` unverified | **STILL UNVERIFIED.** `score_types=E` and `score_types=P` return 0 rows across all 13 golfers. `score_types=N` also returns 0. The bogus-letter control `score_types=Z` returns 0 too, so absence proves nothing either way. |

### What the widened sample changed

Distinct wire letters observed: `A`, `C`, `H`, `T`.

| wire | display_short | display_full | holes | count |
|---|---|---|---|---|
| `A` | `A` | `A` | 18 | 61 |
| `A` | `N` | `NA` | 9 | 9 |
| `C` | `N` | `N` | 18 | 1 |
| `H` | `H` | `H` | 18 | 6 |
| `T` | `C` | `C` | 18 | 4 |
| `T` | `C` | `CA` | 18 | 4 |
| `T` | `N` | `NCA` | 9 | 1 |

**Two claims in the issue are falsified, and a third finding reverses #65.**

1. **"`score_types=C` returns 0" is wrong.** `C` is live on `/scores.json` — 1 row in 85, golfer
   `13373254`, score id `1138044991`. Dropping it would have rejected a real row.
2. **`C` is COMBINED, not Competition.** That row is the exact arithmetic sum of the same golfer's
   two nine-hole rounds — AGS 48 + 46 = 94, course rating 34.6 + 35.6 = 70.2, slope mean of 132 and
   122 = 127, same month. It displays as `N` on an 18-hole score because the `N` marks it as
   *derived from* nines, not as a nine-hole round. #65 relabelled `C` from `'COMBINED'` to
   `'COMPETITION'` on the 2020 WHS naming alone with no payload behind it; **that is reverted here**
   and `.changeset/score-type-competition.md` was deleted, since #65 never shipped and the net
   effect on `C` across the release is nothing.
3. **The two letters follow the same pattern.** GHIN keeps the legacy storage letter in both cases;
   only `T`'s *name* changed (Tournament → Competition). `C`'s did not.

### Re-addressing #59

#59 cited the USGA's published designations — `A`, `C`, `E`, `H`, `N`, `P`, with `C` as Competition
and no `T` — and concluded this library was using historical letters. **That list is correct; it
just describes a different field.** GHIN sends two letter alphabets per score row:

| | field | observed on UAT | source |
|---|---|---|---|
| storage | `score_type` | `A`, `C`, `H`, `T` | GHIN's pre-2020 column, never migrated |
| display | `score_type_display_short` / `_full` | `A`, `C`, `H`, `N` | the WHS/USGA set #59 cites |

They **collide on `C`**, which is Competition in the display alphabet and Combined in the storage
alphabet. That collision is how a correct citation produced a wrong mapping in #65. `N` is likewise
a display-alphabet letter that leaked into the storage enum — #59's third point, now explained
positively rather than by absence. It is left accepted (narrowing would also narrow
`ScoresRequest['score_types']`), recorded as a comment in `scores/score.ts`.

### Incidental finding, unrelated to #66

`courses.getTeeSetRatingsForScorePosting` throws against UAT: `GET /Courses/{id}/TeeSetRatingsForScorePosting.json`
returns a bare **array** of tee sets, but `schemaTeeSetRatingsForScorePostingResponse` expects an
object — `ValidationError: Expected object, received array`. Same class of bug as #67. Worth its own issue.
