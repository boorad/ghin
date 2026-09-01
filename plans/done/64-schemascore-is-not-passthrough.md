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

## Decisions

None asked — the fix is exactly as specified in the issue.

## Assumptions

- Ship as `patch`: this is a fix/widening, not a new declared capability. Naming
  the specific fields dropped today is a follow-up requiring a live scores-list
  payload not captured in this repo.

## Manual verification

- Capture a real scores-list payload and diff against the 40 declared keys to
  learn which fields are being dropped today. Requires a live GHIN call; cannot
  be proven by unit tests. Follow-up, not blocking this fix.
