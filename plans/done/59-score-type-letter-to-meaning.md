# 59 — Score type letter-to-meaning mismatch

## Problem

`scoreTypesMap` in `src/client/ghin/models/scores/score.ts` maps the `C` score
type to `COMBINED`, but per the 2020 USGA World Handicap System guidelines `C`
means `COMPETITION`. Fix the label. Keep accepting the `T` letter (legacy
`TOURNAMENT` scores still exist on the wire) — this is a relabel, not a removal.

## Live tracker

- [x] Phase 1 — Relabel `C`: `COMBINED` → `COMPETITION` in `scoreTypes` union and `scoreTypesMap`
- [x] Phase 2 — Add transform tests asserting every letter → meaning
- [x] Phase 3 — Changeset (patch)

## Decisions

None asked — no throwaway structural fork.

## Assumptions

- **Keep `T` / `TOURNAMENT`.** The API still returns `T` on legacy pre-2020
  scores; removing it would reject real rows (Zod leniency). The issue is only
  about `C`'s meaning.
- **Leave `post-request.ts` `z.enum(['H','A','T'])` untouched.** That is the
  outbound POST contract, a separate concern from the response labels; changing
  it risks breaking posting.
- Changeset is `patch` (correctness fix, matches repo convention), with an
  explicit consumer-impact note that `'COMBINED'` is no longer emitted.
- **Kept `patch` despite the breaking union change** (review flagged it as
  arguably `minor`). Repo precedent for this 0.x package ships type-breaking
  fixes as `patch` — e.g. `estimated-handicap-display` (#58/#61) made 11
  required fields nullable under `patch`. Followed that convention.
