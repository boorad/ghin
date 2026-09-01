---
'@spicygolf/ghin': minor
---

Fix `handicaps.getCourseHandicaps` and `handicaps.getCoursePlayerHandicaps`, neither of which worked for a group containing a golfer with no established index; partition the course-handicap tee sets so one bad row no longer costs the whole batch; and remove `handicaps.getPlayingHandicaps`, which could never succeed.

**`handicaps.getPlayingHandicaps` is removed, along with `schemaPlayingHandicapRequest`, `schemaPlayingHandicapEntry`, `schemaPlayingHandicapsResponse` and the `PlayingHandicapRequest`, `PlayingHandicapEntry` and `PlayingHandicapsResponse` types.** The method never functioned. It sent a single `golfer_id` to `POST /playing_handicaps.json`, which requires a `golfers` array, so every call it ever made returned `400 {"errors":{"golfers":["is required"]}}` — verified against `api-uat.ghin.com`. Its `{ playing_handicaps: [...] }` response schema described a payload that endpoint does not return; the real response is a percent → `golfer_id` → handicap record.

`handicaps.getCoursePlayerHandicaps` is the working replacement. It posts to the same URL with the `golfers` array GHIN actually wants, and returns that percent record:

```ts
await client.handicaps.getCoursePlayerHandicaps([
  { ghin: 13373246, tee_set_id: 262908, tee_set_side: 'All 18' },
  { ghin: 13373247, tee_set_id: 262908, tee_set_side: 'All 18' },
])
```

Repairing `getPlayingHandicaps` would have produced a byte-for-byte duplicate of it, so the dead method was deleted instead. Nothing can have depended on it, because it always threw.

`schemaCourseHandicapsGetResponse` was a plain `z.array(...)`, so validation was all-or-nothing: a single row GHIN sent malformed threw `ValidationError` and took every other tee set with it, and `onDegraded` could never fire because there was no partition to report a drop from. It now uses `partitionRows`, matching `courses.search`, `courses.getDetails`, and `golfers.search` (#51, #53). The good rows come back in `tee_sets`, and the response carries an additive `invalid` key holding the rejected rows **raw and untransformed** — a Zod issue list tells you the shape you expected, not the shape GHIN sent.

`handicaps.getCourseHandicaps` now calls `onDegraded` (entity `course_handicaps_get`) whenever rows are dropped, so degradation is never silent: a response that quietly returns fourteen of fifteen tee sets is otherwise indistinguishable from a course with fourteen.

**A malformed row no longer throws.** Callers catching `ValidationError` from `handicaps.getCourseHandicaps` will find that throw no longer happens — the row lands in `invalid` and `onDegraded` fires instead, and the caller gets the tee sets that did parse.

**Schema-object surface.** Adding the transform changes the exported `schemaCourseHandicapsGetResponse` from a `ZodObject` to a `ZodEffects`, so the `ZodObject` methods (`.shape`, `.extend()`, `.pick()`, `.merge()`, `.partial()`, `.passthrough()`) are no longer available on it. Parsing is unaffected. This is part of why the release is `minor` rather than `patch`, matching #51 and #53, which made the same shape change.

**`handicaps.getCourseHandicaps` failed 100% of the time.** `GET /course_handicaps.json` does not return a `course_handicaps` array and has never contained a `handicap_index`. It returns `tee_sets`, each with its holes and one rating per side, and the Course Handicap nested at `tee_sets[].ratings[].course_handicap`. Every call therefore threw `ValidationError: course_handicaps Required`. The response schema is rewritten against a payload captured from `api-uat.ghin.com` and the tee sets are partitioned, so one malformed tee set costs the caller that tee set rather than the other fourteen.

`course_handicap` is `null` for a golfer with no established index (`course_handicap_display: "NH"`), and is declared `handicap.nullable()` so the `null` survives instead of coercing to `0` — a fabricated scratch Course Handicap is a wrong number, not a missing one.

**Breaking, on a method that could not previously succeed:** `schemaCourseHandicapEntry` and its `CourseHandicapEntry` type are removed, since they described a payload GHIN never sent. `schemaCourseHandicapTeeSet`, `schemaCourseHandicapRating`, `schemaCourseHandicapHole` and their types replace them, and `CourseHandicapsGetResponse` is now `{ tee_sets, invalid }`.

**`tee_set_side` on `handicaps.getCourseHandicaps` must be `'All 18'`, with a space.** The request schema declared the shared `teeSetSide` enum, whose `'All18'` GHIN rejects with `{"errors":{"tee_set_side":["must be one of the following: 'All 18', 'F9', 'B9'"]}}`. It now uses `schemaTeeSetSide`, which has the space. The shared `teeSetSide` is unchanged, because score posting also uses it.

**`handicaps.getCoursePlayerHandicaps` no longer loses a whole group to one golfer with no index.** Reproduced against `api-uat.ghin.com`: three established golfers succeed, and adding a fourth whose Handicap Index is `NH` throws `ValidationError` and returns nothing for any of the four. GHIN sends that golfer `{ "playing_handicap": null, "playing_handicap_display": "NH", "shots_off": "-" }`, and sends `shots_off` as a *string* even for established golfers (`"1"`). Both fields were declared as `number` (`z.coerce.number()`), so `Number("-")` was `NaN` and failed the parse.

`playing_handicap` and `shots_off` now use the shared `handicap` helper, wrapped in `.nullable()` so an explicit `null` stays `null` instead of coercing to `0`. **Their published type widens from `number` to `number | null`** — deliberate, because a fabricated `0` is a scratch handicap, which is a wrong number rather than a missing one. `playing_handicap_display` is untouched and still carries `"NH"` / `"0"` / `"+4"`.
