---
'@spicygolf/ghin': minor
---

Fix `handicaps.getCourseHandicaps`, which failed on every call, and `handicaps.getCoursePlayerHandicaps`, which lost a whole group to any golfer with no established index; partition both responses so one bad row no longer costs the rest; and remove `handicaps.getPlayingHandicaps`, which could never succeed.

**`handicaps.getPlayingHandicaps` is removed, along with `schemaPlayingHandicapRequest`, `schemaPlayingHandicapEntry`, `schemaPlayingHandicapsResponse` and the `PlayingHandicapRequest`, `PlayingHandicapEntry` and `PlayingHandicapsResponse` types.** The method never functioned. It sent a single `golfer_id` to `POST /playing_handicaps.json`, which requires a `golfers` array, so every call it ever made returned `400 {"errors":{"golfers":["is required"]}}` — verified against `api-uat.ghin.com`. Its `{ playing_handicaps: [...] }` response schema described a payload that endpoint does not return; the real response is a percent → `golfer_id` → handicap record.

`handicaps.getCoursePlayerHandicaps` is the working replacement. It posts to the same URL with the `golfers` array GHIN actually wants, and returns that percent record:

```ts
await client.handicaps.getCoursePlayerHandicaps([
  { ghin: 13373246, tee_set_id: 262908, tee_set_side: 'All 18' },
  { ghin: 13373247, tee_set_id: 262908, tee_set_side: 'All 18' },
])
```

Repairing `getPlayingHandicaps` would have produced a byte-for-byte duplicate of it, so the dead method was deleted instead. Nothing can have depended on it, because it always threw.

The rewritten `schemaCourseHandicapsGetResponse` partitions its rows with `partitionRows`, matching `courses.search`, `courses.getDetails`, and `golfers.search` (#51, #53). This is forward-looking hardening rather than a fix to an observed failure — the old schema never parsed this endpoint at all, so there was no batch to lose. A live course returns fifteen tee sets, and one malformed tee set should cost the caller that tee set rather than the other fourteen. The good rows come back in `tee_sets`, and the response carries an additive `invalid` key holding the rejected rows **raw and untransformed** — a Zod issue list tells you the shape you expected, not the shape GHIN sent.

`handicaps.getCourseHandicaps` now calls `onDegraded` (entity `course_handicaps_get`) whenever rows are dropped, so degradation is never silent: a response that quietly returns fourteen of fifteen tee sets is otherwise indistinguishable from a course with fourteen.

**A malformed row no longer throws.** Callers catching `ValidationError` from `handicaps.getCourseHandicaps` will find that throw no longer happens — the row lands in `invalid` and `onDegraded` fires instead, and the caller gets the tee sets that did parse.

**Schema-object surface.** Adding the transform changes the exported `schemaCourseHandicapsGetResponse` from a `ZodObject` to a `ZodEffects`, so the `ZodObject` methods (`.shape`, `.extend()`, `.pick()`, `.merge()`, `.partial()`, `.passthrough()`) are no longer available on it. Parsing is unaffected. This is part of why the release is `minor` rather than `patch`, matching #51 and #53, which made the same shape change.

**`handicaps.getCourseHandicaps` failed 100% of the time.** `GET /course_handicaps.json` does not return a `course_handicaps` array and has never contained a `handicap_index`. It returns `tee_sets`, each with its holes and one rating per side, and the Course Handicap nested at `tee_sets[].ratings[].course_handicap`. Every call therefore threw `ValidationError: course_handicaps Required`. The response schema is rewritten against a payload captured from `api-uat.ghin.com` and the tee sets are partitioned, so one malformed tee set costs the caller that tee set rather than the other fourteen.

`course_handicap` is `null` for a golfer with no established index (`course_handicap_display: "NH"`), and is declared `handicap.nullable()` so the `null` survives instead of coercing to `0` — a fabricated scratch Course Handicap is a wrong number, not a missing one.

**Breaking, on a method that could not previously succeed:** `schemaCourseHandicapEntry` and its `CourseHandicapEntry` type are removed, since they described a payload GHIN never sent. `schemaCourseHandicapTeeSet`, `schemaCourseHandicapRating`, `schemaCourseHandicapHole` and their types replace them, and `CourseHandicapsGetResponse` is now `{ tee_sets, invalid }`.

**`tee_set_side` on `handicaps.getCourseHandicaps` must be `'All 18'`, with a space.** The request schema declared the shared `teeSetSide` enum, whose `'All18'` GHIN rejects with `{"errors":{"tee_set_side":["must be one of the following: 'All 18', 'F9', 'B9'"]}}`. It now uses `schemaTeeSetSide`, which has the space. The shared `teeSetSide` is unchanged, because score posting also uses it.

**`handicaps.getCoursePlayerHandicaps` no longer loses a whole group to one golfer with no index.** Reproduced against `api-uat.ghin.com`: three established golfers succeed, and adding a fourth whose Handicap Index is `NH` throws `ValidationError` and returns nothing for any of the four. GHIN sends that golfer `{ "playing_handicap": null, "playing_handicap_display": "NH", "shots_off": "-" }`, and sends `shots_off` as a *string* even for established golfers (`"1"`). Both fields were declared as `number` (`z.coerce.number()`), so `Number("-")` was `NaN` and failed the parse.

`playing_handicap` and `shots_off` now use the shared `handicap` helper, wrapped in `.nullable()` so an explicit `null` stays `null` instead of coercing to `0`. **Their published type widens from `number` to `number | null`** — deliberate, because a fabricated `0` is a scratch handicap, which is a wrong number rather than a missing one. `playing_handicap_display` is untouched and still carries `"NH"` / `"0"` / `"+4"`.

**`handicaps.getCoursePlayerHandicaps` now partitions per golfer, and its response carries an additive `invalid` key.** Widening `playing_handicap` and `shots_off` only covered the two values GHIN was known to send. The percentage buckets themselves were still all-or-nothing `z.record(...)`s, so the next unmodelled status string — `"N/A"`, a new suffix, anything the shared `handicap` helper rejects — for one golfer would again throw `ValidationError` and lose the whole foursome, with no `onDegraded` to report it.

Each bucket is now parsed golfer by golfer with `partitionRows`, matching `courses.search`, `courses.getDetails` and `golfers.search` (#51, #53). The percentage buckets are indexed exactly as before (`response[100][golferId]`), and the golfers that were dropped are hoisted into one response-level `invalid`:

```ts
const response = await client.handicaps.getCoursePlayerHandicaps(golfers)

response[100]['13373246'] // unchanged
response.invalid // [{ golfer_id: '13373258', row: { playing_handicap: null, shots_off: 'N/A' } }]
```

Each entry names the golfer GHIN addressed the row with — the record key is the only thing identifying a reject, since nothing inside the row names the golfer — and carries `row` **raw and untransformed**, because a Zod issue list tells you the shape you expected, not the shape GHIN sent. `invalid` is deduplicated by `golfer_id`: GHIN echoes the same golfer set in all twenty buckets, so a golfer whose row is malformed is malformed twenty times over, and that is one dropped golfer.

`handicaps.getCoursePlayerHandicaps` now calls `onDegraded` (entity `course_handicaps`) once per dropped golfer, with `total` counting the golfers in the payload rather than twenty times that. **A malformed row no longer throws:** callers catching `ValidationError` from this method will find that throw no longer happens — the golfer lands in `invalid` and the rest of the group comes back.

The twenty percentage buckets remain **required**. Row-level leniency exists for data variance in a golfer's values, and it is safe there because the dropped row is reported; a missing bucket is the endpoint changing shape, which `GhinDegradation` has no way to report (there is no raw row to sample). Making the buckets nullish would trade a loud `ValidationError` for a silent `undefined` at every call site.

**Schema-object surface.** As with `schemaCourseHandicapsGetResponse`, the transform changes `schemaCoursePlayerHandicapsResponse` from a `ZodObject` to a `ZodEffects`, so `.shape`, `.extend()`, `.pick()`, `.merge()`, `.partial()` and `.passthrough()` are no longer available on it; parsing is unaffected. `schemaCoursePercentPlayerHandicap` likewise now returns `{ handicaps, invalid }` rather than a bare record, and the `CoursePercentPlayerHandicap` type keeps its old meaning — `Record<golferId, CoursePlayerHandicap>` — as the type of one bucket in the response.
