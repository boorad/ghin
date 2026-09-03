# 86 — schemaGolfer.ghin coerces null and '' to golfer 0

## Problem

`schemaGolfer.ghin` was `number` (`z.coerce.number().int()`). `Number(null)` and
`Number('')` are both `0`, so a row with a null or blank GHIN number parsed
successfully as golfer 0 instead of degrading. The row looked valid, so
`onDegraded` never fired. What happened next depended on the caller: a fabricated
`0` never matches a requested number, so `golfersGetMany` — which builds its
result by iterating the *requested* numbers (`index.ts:1065`) — silently dropped
the row, while `golfers.search` and `golfersGlobalSearch` return the partitioned
rows as they came (`index.ts:752`, `index.ts:902`) and handed the caller a
fabricated golfer 0. The issue body claimed the row took a slot in `golfers` on
`getMany`; the code says otherwise, and the code wins. Fix: `ghin: strictNumber`,
the #63-trap guard.

## Live tracker

- [x] Change `ghin: number` → `ghin: strictNumber` and import it (`search.ts`)
- [x] Tests: null, blank, and numeric-string ghin cases + response partition case
- [x] Changeset (`minor` — see **Assumptions**)
- [x] Client-level tests: `getMany` reports the row through `onDegraded`, and
      `golfers.search` no longer hands back a fabricated golfer 0 (`index.test.ts`)

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

The changeset bumps `minor` rather than `patch` because the emitted `.d.ts` type
of the public `schemaGolfer` export changes: `strictNumber` is a `ZodEffects`, so
`ghin` goes from `z.ZodNumber` to `z.ZodEffects<z.ZodNumber, number, unknown>`
and `z.input<typeof schemaGolfer>['ghin']` goes `number` → `unknown`. `z.infer<>`
and the exported `Golfer` / `GolfersSearchResponse` / `GolfersGetManyResponse`
types are unchanged (`ghin: number` either way). This repo has cited exactly this
class of published-schema-type change as the reason for `minor` before —
`CHANGELOG.md:294` and `CHANGELOG.md:358`.

`strictNumber` still leaves the other `Number()` coercion paths open:
`Number([]) === 0` and `Number(false) === 0`, so a JSON array or a boolean in
`ghin` would still fabricate golfer 0. Deliberately not closed with the
`z.number().or(z.string()).pipe(number)` narrowing this file already uses on the
request side (`search.ts:57-64`): an array or boolean in a scalar ID field is not
an observed GHIN shape, and #86 scoped the fix to `null` and blank strings. The
request side earns the narrowing because a caller can hand it `golfer_id: []`;
the response side only ever sees what GHIN sends.
