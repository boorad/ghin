# 66 — score_type 'T' means Competition, not Tournament

Follow-up to #59 / #65. UAT evidence shows the wire `score_type` for Competition
rows on `/scores.json` is `T`, not `C`. GHIN itself renders `T` as `C`/`CA`/`NCA`.
So `T: 'TOURNAMENT'` in `scoreTypesMap` is the real mislabel; the fix is
`T → 'COMPETITION'`, dropping `'TOURNAMENT'` from the output union. `C` stays
accepted (documented on `PATCH /scores/hbh/{id}`, cheap to keep).

## Live tracker

- [ ] Phase 1 — Relabel `T` to `'COMPETITION'` in `score.ts` + `score.test.ts`, drop `'TOURNAMENT'` from union
- [ ] Phase 2 — Add `patch` changeset spelling out the breaking union change
- [ ] Phase 5 — Whole-branch tests
- [ ] Phase 6 — Review + move plan doc

## Decisions

None asked — no structural fork wasted work.

## Assumptions

- **Keep `N` / `'9_HOLE_ROUNDS'` (recon Option A).** The issue's finding #3
  ("`N` is probably not a score type") is hedged and absence-of-evidence.
  `schemaScoresResponse` uses a plain `z.array(schemaScore)` with **no**
  `partitionRows`, so `score_type` is a strict `z.enum(rawScoreTypes)` transform
  with no per-row leniency — narrowing the *input* enum (`rawScoreTypes`) would
  make a stray wire letter crash the whole `getScores` response. Removing `N`
  cleanly requires adding row-level leniency (scope creep) or accepting that
  crash risk. `N` staying in the output union is cosmetic clutter, not a
  correctness bug. Leaving it is the minimal, safe change; removing it can be a
  later additive follow-up if a prod sample confirms `N` never appears as a wire
  `score_type`.
- Ship as `patch` per repo precedent (#65, estimated-handicap-display), with the
  breaking type change (`'TOURNAMENT'` leaving the emitted `ScoreType` union)
  spelled out in the changeset body.

## Manual verification (carried to Phase 6.5 — do NOT auto-push)

1. Confirm against **production** credentials that prod `/scores.json` emits `T`
   (not `C`) for Competition rows. All evidence is UAT/staging, 4 golfers, 38 scores.
2. Absence of `C` on `/scores.json` is unproven (a bogus letter also returns 0
   rows). `C` stays accepted, which sidesteps needing to prove this; spot-check a
   real `PATCH /scores/hbh/{id}` response if reachable.
3. `E` and `P` mappings unverified against any real payload (no seeded data).
