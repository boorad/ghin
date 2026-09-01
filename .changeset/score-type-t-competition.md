---
'@spicygolf/ghin': minor
---

Fix the `score_type` labels for the `T` and `C` letters, and partition the `getScores` response so one malformed round no longer costs the caller their whole score history.

GHIN stores score types under pre-2020 letters and moved only the *display* to the WHS names. Two letters were mislabelled because the letter was read as the name:

- **`T` now transforms to `'COMPETITION'`** (was `'TOURNAMENT'`). `T` is the letter GHIN actually puts on the wire for a Competition score. Read raw from `/scores.json` on `api-uat.ghin.com` across all thirteen seeded staging golfers (`from_date_played=2000-01-01`, 85 scores), every row GHIN renders as `C`, `CA` or `NCA` carries `score_type: 'T'`, and no row renders as `T`. Confirmed end to end by round-tripping a live post: a score posted through `scores.postAdjusted` with `score_type: 'T'` came back as wire `score_type: 'T'`, `score_type_display_short: 'C'`, `score_type_display_full: 'CA'`. The name changed from Tournament to Competition; the storage letter did not.
- **`C` transforms to `'COMBINED'`,** which is what it did before #65. A Combined score is two nine-hole rounds combined into one 18-hole score, and the name never changed, so `C` still means what its letter says.

**This reverts the `C` relabel from #65, which never shipped.** #65 changed `C` from `'COMBINED'` to `'COMPETITION'` on the strength of the 2020 WHS naming alone, with no observed payload behind it. The payload contradicts it. The single wire-`C` row in the 85-score sample (golfer `13373254`) is the exact arithmetic sum of that golfer's two nine-hole rounds:

| | the two nine-hole rows | the `C` row |
|---|---|---|
| adjusted gross score | 48 + 46 = **94** | **94** |
| course rating | 34.6 + 35.6 = **70.2** | **70.2** |
| slope rating | mean of 132, 122 = **127** | **127** |

That also explains its display fields, which look wrong until you know what it is: `score_type_display_short: 'N'` and `score_type_display_full: 'N'` on an **18-hole** score. The `N` marks the score as *derived from* nines, not as a nine-hole round. Because #65 is unreleased, consumers never saw `'COMBINED'` leave, and the net effect of this release on the `C` letter is nothing.

**What #59 got right, and where it went wrong.** #59 pointed at the [USGA's published letter designations](https://www.usga.org/content/usga/home-page/handicapping/roh/Content/rules/Committee%20Content/USGA/LG_R4g.htm) — `A`, `C`, `E`, `H`, `N`, `P`, where `C` is Competition and there is no `T` — and argued this library's map was using historical letters. That list is correct. It just describes a different field.

GHIN sends **two** letter sets on every score row, and they are not the same alphabet:

| | field | letters observed on UAT | source |
|---|---|---|---|
| storage | `score_type` | `A`, `C`, `H`, `T` | GHIN's pre-2020 column, never migrated |
| display | `score_type_display_short` / `_full` | `A`, `C`, `H`, `N` | the WHS/USGA set #59 cites |

The two sets **collide on the letter `C`, where it means different things**: `C` in the display fields is Competition, exactly as #59 says, while `C` in `score_type` is Combined. That collision is the whole trap. #65 read the USGA list as a description of `score_type` and relabelled `C` accordingly, which is how a correct citation produced a wrong mapping. The letter that carries Competition in `score_type` is `T`.

This also settles #59's third point. `N` really is a WHS designation, but it belongs to the *display* set — it appears in `score_type_display_short` / `_full` and never in `score_type`, so it should not have been in the storage-letter enum at all. It is left accepted here rather than removed, because narrowing the input enum would also narrow the caller-facing `ScoresRequest['score_types']` and would reject the letter rather than tolerate it; the finding is recorded as a comment in `scores/score.ts`.

`score_type_display_full` is compositional — `[N]` + `[C]` + `[A]` — so `CA` is "Competition Away" and `NCA` is "nine-hole Competition Away". That closes an open question from #59, which asked whether the swagger's `"score_type_display_full": "CA"` example meant "Combined Away". It does not; Combined is the `N` case above.

**Consumers matching on `'TOURNAMENT'` will need to switch to `'COMPETITION'`.** The emitted `ScoreType` union is now `'AWAY' | 'COMBINED' | 'COMPETITION' | 'EXCEPTIONAL' | 'HOME' | '9_HOLE_ROUNDS' | 'PENALTY'`, so an exhaustive `switch` or a `Record<ScoreType, Label>` map stops compiling under `strict`. The worse failure is the quiet one: a runtime string comparison like `score.score_type === 'TOURNAMENT'` keeps compiling and silently stops matching, so a Competition round just stops being labelled. `'TOURNAMENT'` is the only member leaving. The reach is narrower than it looks — `scores/index.ts` does not re-export `./score`, so `ScoreType` is not a named package export; consumers reach it structurally, through `ScoresResponse['scores'][number]['score_type']`. Grep for the string literal, not for the type import.

**`getScores` now partitions its rows, and its response carries an additive `invalid` key.** `schemaScoresResponse` wrapped scores in a plain `z.array(schemaScore)`, which made every round a single point of failure for the whole history: one unrecognised `score_type` letter — or one null differential, per #63 — rejected the entire response, so a golfer with 40 good rounds and 1 odd one saw no rounds at all. Rows are now parsed individually with `partitionRows`, matching `courses.search`, `courses.getDetails` and `golfers.search` (#51, #53). The good rounds come back in `scores`, and the rejects come back in `invalid` **raw and untransformed** — a Zod issue list tells you the shape you expected, not the shape GHIN sent. `golfers.getScores` calls `onDegraded` (entity `scores`) whenever rows are dropped, because a history that quietly comes back one round short is otherwise indistinguishable from a golfer who played one round fewer.

**A malformed round no longer throws.** Callers catching `ValidationError` from `golfers.getScores` will find that throw no longer happens for a bad row — the round lands in `invalid`, `onDegraded` fires, and the rounds that did parse come back. The envelope is unchanged otherwise: the transform spreads the rest of the object, so the declared sibling fields and the `.passthrough()` keys added in #64 survive it.

**Schema-object surface.** Adding the transform changes the exported `schemaScoresResponse` from a `ZodObject` to a `ZodEffects`, so the `ZodObject` methods (`.shape`, `.extend()`, `.pick()`, `.merge()`, `.partial()`, `.passthrough()`) are no longer available on it. Parsing is unaffected, and the transform carries an explicit return-type annotation so that `.passthrough()`'s `[k: string]: unknown` index signature survives into the emitted type rather than being dropped by the spread. This is part of why the release is `minor` rather than `patch`, matching #51 and #53, which made the same shape change when they added an `invalid` key.

Score posting is untouched. `scores/post-request.ts` still declares `z.enum(['H', 'A', 'T'])` — that is the letter this library *sends*, GHIN's POST spec documents `T`, and it is a separate contract from what we parse coming back. Only the inbound labels changed.

**On the limits of the evidence.** All of the above was read from UAT/staging, not production: thirteen seeded golfers, 85 scores, plus one live round-trip post. The distinct wire letters observed are `A`, `C`, `H` and `T`. `E` and `P` returned 0 rows under `score_types=` filtering across every golfer and are unverified in either direction — this release makes no claim that their mappings were confirmed, only that they were left alone. A control query with a bogus letter (`score_types=Z`) also returns 0 rows, so an empty filter result cannot distinguish "there are no such rows" from "that is not a letter I recognise"; absence stays weak evidence throughout. The `C` finding rests on one row, but it is a positive, arithmetic match rather than an absence, which is why it is strong enough to act on.

`N` stays in both unions. It never appears as a wire `score_type` — `score_types=N` returns 0 rows — only as a prefix on the display fields, and it does not reliably mean nine holes (the Combined row above displays `N` on 18). Narrowing it would also narrow the caller-facing `ScoresRequest['score_types']` input, so the finding is recorded as a comment in `scores/score.ts` instead.
