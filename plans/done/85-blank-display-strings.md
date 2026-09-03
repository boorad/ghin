# 85 — A blank descriptive string costs the caller the row

Issue: https://github.com/boorad/ghin/issues/85

## Problem

`string` is `z.string().trim().min(1)` (`src/models/validation.ts`), so `''`
fails it. Used on a *descriptive* field, that turns GHIN's ordinary "nothing to
display" into a rejected row.

Production, 2026-09-03: a 23-row `golfers.search` came back 22 valid + 1
invalid and fired `onDegraded`. The dropped golfer had no recorded low
Handicap Index, which GHIN reports as `low_hi_value: 999` with a blank
`low_hi_display`. Replayed through the published `schemaGolfer`, that row
yields exactly one issue:

```
{ "code": "too_small", "minimum": 1, "type": "string", "path": ["low_hi_display"] }
```

Set `low_hi_display` to `"NH"` and the same row parses. To the caller the
golfer was simply absent — indistinguishable from "not on GHIN".

This is the third instance of one bug. `first_name` (an empty optional field
rejecting a whole `golfers.search`) and the `Archived` status enum (#84) were
the same failure: one descriptive field the row could not be read without.
`emptyStringToNull` already existed for exactly this, and was already used on
`first_name`, `club_name`, `country`, `middle_name`, `phone_number`, `prefix`,
`state` and `suffix` — these were just missed.

Measured blast radius, worst first:

```
course_handicap_display: 'NH'  -> tee_sets: 1  invalid: 0
course_handicap_display: ''    -> tee_sets: 0  invalid: 1
```

`ratings` is all-or-nothing by design, so a blank display string there fails
the **whole tee set**, not one rating.

## Live tracker

- [x] Phase 1 — `schemaGolfer`: the four descriptive strings (#85 itself)
- [x] Phase 2 — `schemaCourseHandicapRating.course_handicap_display`, the
      all-or-nothing case
- [x] Phase 3 — Sweep the course/facility/tee-set models
- [x] Phase 4 — Retire the contradicted carve-out in `scores/post-response.ts`
- [x] Phase 5 — Tests at both levels (row *and* partition), changeset, docs

## Decisions

**Identity stays strict.** `last_name`, `CourseName`, required `FacilityName`,
`TeeSetRatingName`, `RatingType` and `tee_set_side` keep the bare `string`. A
blank there is genuinely unusable, and rejecting the row is the correct answer.

**The carve-out was wrong, not just incomplete.** `post-response.ts` documented
that row schemas behind `partitionRows` could afford strictness because a bad
value "costs one row and surfaces through `onDegraded`". In production that
meant a real golfer silently missing from search results; the report reaches an
error tracker, not the person searching. Salvage bounds the damage, it does not
justify strictness on a field nothing computes on.

**Widened on inference, and said so.** Only `low_hi_display` was measured
blank. `association_name`, `hi_display`, `message_club_authorized` and the
course/facility fields are widened because they are the same class of field at
the same one-token cost — the comments distinguish the two.

## Not done here

`ghin: number` in `schemaGolfer` is `z.coerce.number().int()`, so `{ghin: null}`
and `{ghin: ''}` both parse as **golfer 0** — the #63 coercion trap, in a
required field, defeating the `missing` reconciliation in
`GolfersGetManyResponse`. Tightening it to `strictNumber` moves rows into
`invalid`, which is a behaviour change of its own. Filed separately.
