# 86 — schemaGolfer.ghin coerces null and '' to golfer 0

## Problem

`schemaGolfer.ghin` was `number` (`z.coerce.number().int()`). `Number(null)` and
`Number('')` are both `0`, so a row with a null or blank GHIN number parsed
successfully as golfer 0 instead of degrading. The row looked valid (`onDegraded`
never fired) and defeated `GolfersGetManyResponse.missing` — a fabricated `0`
never matches a requested number, so the golfer landed in `missing` *and* took a
slot in `golfers`. Fix: `ghin: strictNumber`, the #63-trap guard.

## Live tracker

- [x] Change `ghin: number` → `ghin: strictNumber` and import it (`search.ts`)
- [x] Tests: null, blank, and numeric-string ghin cases + response partition case
- [x] Changeset (`patch`)
- [x] Client-level test: a null-ghin row lands in `missing`, not as golfer 0 (`index.test.ts`)

## Not done here

`association_id`, `club_id` and `club_affiliation_id` on `schemaGolfer` are
`number.nullish()` and carry the same trap: `.nullish()` short-circuits an
explicit `null`, but `''` is not null, so a blank falls through to
`z.coerce.number()` and fabricates a `0` there too. Left alone deliberately —
they are descriptive IDs, so a fabricated `0` neither defeats `missing` nor
fabricates an identity, and every field converted moves more rows into
`invalid`, which is a behaviour change of its own and wants its own audit.
Handed over the way #85 handed this issue over (`plans/done/85-blank-display-strings.md`).

## Decisions

Scope held to `ghin` alone, per the issue's own wording. The adjacent
`number.nullish()` ID fields have the same coercion trap but not the same
consequence — see **Not done here**. Nothing else on this row is tightened:
parse leniency stays the standing default after #85, and this is the audited
exception to it.

## Assumptions

None.
