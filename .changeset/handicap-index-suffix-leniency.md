---
'@spicygolf/ghin': minor
---

Fix `handicaps.getCourseHandicaps`, which never worked; accept WHS status-suffixed values in `handicap_index` on the handicap entry schemas; and partition the list responses so one bad row no longer costs the whole batch.

GHIN returns an index like `"19.1M"` (modified by the Handicap Committee) or `"12.4WD"` (withdrawn) for golfers under a WHS status. `handicap_index` was declared as `float` (`z.coerce.number()`), which turned those into `NaN` and failed the parse — the same production bug fixed for `golfers.search` in #56. Because the playing-handicap response is a plain array, one such golfer fails the **entire batch**: a request for a foursome with a single `M`/`WD` player returns nothing for anyone. (Observed in production on `golfers.search`; here the failure follows from the same mechanism rather than from a captured payload.)

`handicap_index` now uses the shared `handicap` helper, so a suffixed value parses to its numeric part and `"NH"`/`"-"` parse to `null`. Its published type is unchanged (`number | null | undefined`) — only previously-rejected inputs now parse.

The sibling `playing_handicap` field on `schemaPlayingHandicapEntry` is deliberately left as `number`. It carries a separate hazard — `z.coerce.number()` turns an explicit `null` into `0`, fabricating a scratch handicap — which is #63's repo-wide call to make, not this one's. (`course_handicap` on the rewritten course-handicap schema is a captured `null` rather than a hypothetical one, so it is handled directly, below.)

`schemaCourseHandicapsGetResponse` and `schemaPlayingHandicapsResponse` were plain `z.array(...)`, so validation was all-or-nothing: a single row GHIN sent malformed threw `ValidationError` and took every other golfer's handicap with it, and `onDegraded` could never fire because there was no partition to report a drop from. Both now use `partitionRows`, matching `courses.search`, `courses.getDetails`, and `golfers.search` (#51, #53). The good rows come back in `tee_sets` / `playing_handicaps`, and each response carries an additive `invalid` key holding the rejected rows **raw and untransformed** — a Zod issue list tells you the shape you expected, not the shape GHIN sent.

`handicaps.getCourseHandicaps` and `handicaps.getPlayingHandicaps` now call `onDegraded` (entities `course_handicaps_get` and `playing_handicaps_post`) whenever rows are dropped, so degradation is never silent: a foursome that quietly returns three handicaps is otherwise indistinguishable from a threesome.

**A malformed row no longer throws.** Callers catching `ValidationError` from these two endpoints will find that throw no longer happens — the row lands in `invalid` and `onDegraded` fires instead, and the caller gets the golfers that did parse.

**Schema-object surface.** Adding the transform changes the exported `schemaCourseHandicapsGetResponse` and `schemaPlayingHandicapsResponse` from a `ZodObject` to a `ZodEffects`, so the `ZodObject` methods (`.shape`, `.extend()`, `.pick()`, `.merge()`, `.partial()`, `.passthrough()`) are no longer available on them. Parsing is unaffected. This is why the release is `minor` rather than `patch`, matching #51 and #53, which made the same shape change.

**`handicaps.getCourseHandicaps` failed 100% of the time.** `GET /course_handicaps.json` does not return a `course_handicaps` array and has never contained a `handicap_index`. It returns `tee_sets`, each with its holes and one rating per side, and the Course Handicap nested at `tee_sets[].ratings[].course_handicap`. Every call therefore threw `ValidationError: course_handicaps Required`. The response schema is rewritten against a payload captured from `api-uat.ghin.com` and the tee sets are partitioned, so one malformed tee set costs the caller that tee set rather than the other fourteen.

`course_handicap` is `null` for a golfer with no established index (`course_handicap_display: "NH"`), and is declared `handicap.nullable()` so the `null` survives instead of coercing to `0` — a fabricated scratch Course Handicap is a wrong number, not a missing one.

**Breaking, on a method that could not previously succeed:** `schemaCourseHandicapEntry` and its `CourseHandicapEntry` type are removed, since they described a payload GHIN never sent. `schemaCourseHandicapTeeSet`, `schemaCourseHandicapRating`, `schemaCourseHandicapHole` and their types replace them, and `CourseHandicapsGetResponse` is now `{ tee_sets, invalid }`.

**`tee_set_side` on `handicaps.getCourseHandicaps` must be `'All 18'`, with a space.** The request schema declared the shared `teeSetSide` enum, whose `'All18'` GHIN rejects with `{"errors":{"tee_set_side":["must be one of the following: 'All 18', 'F9', 'B9'"]}}`. It now uses `schemaTeeSetSide`, which has the space. The shared `teeSetSide` is unchanged, because score posting also uses it.

**`handicaps.getCoursePlayerHandicaps` no longer loses a whole group to one golfer with no index.** Reproduced against `api-uat.ghin.com`: three established golfers succeed, and adding a fourth whose Handicap Index is `NH` throws `ValidationError` and returns nothing for any of the four. GHIN sends that golfer `{ "playing_handicap": null, "playing_handicap_display": "NH", "shots_off": "-" }`, and sends `shots_off` as a *string* even for established golfers (`"1"`). Both fields were declared as `number` (`z.coerce.number()`), so `Number("-")` was `NaN` and failed the parse.

`playing_handicap` and `shots_off` now use the shared `handicap` helper, wrapped in `.nullable()` so an explicit `null` stays `null` instead of coercing to `0`. **Their published type widens from `number` to `number | null`** — deliberate, because a fabricated `0` is a scratch handicap, which is a wrong number rather than a missing one. `playing_handicap_display` is untouched and still carries `"NH"` / `"0"` / `"+4"`.
