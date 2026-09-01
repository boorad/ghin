---
'@spicygolf/ghin': patch
---

Accept WHS status-suffixed values in `handicap_index` on the course-handicap and playing-handicap entry schemas, and partition both list responses so one bad row no longer costs the whole batch.

GHIN returns an index like `"19.1M"` (modified by the Handicap Committee) or `"12.4WD"` (withdrawn) for golfers under a WHS status. `handicap_index` was declared as `float` (`z.coerce.number()`), which turned those into `NaN` and failed the parse — the same production bug fixed for `golfers.search` in #56. Because these responses are plain arrays, one such golfer failed the **entire batch**: requesting course or playing handicaps for a foursome with a single `M`/`WD` player returned nothing for anyone.

`handicap_index` now uses the shared `handicap` helper, so a suffixed value parses to its numeric part and `"NH"`/`"-"` parse to `null`. The published type is unchanged (`number | null | undefined`) — only previously-rejected inputs now parse.

The sibling `course_handicap` and `playing_handicap` fields are deliberately left as `float`/`number`. They carry a separate hazard — `z.coerce.number()` turns an explicit `null` into `0`, fabricating a scratch handicap — which is #63's repo-wide call to make, not this one's.

`schemaCourseHandicapsGetResponse` and `schemaPlayingHandicapsResponse` were plain `z.array(...)`, so validation was all-or-nothing: a single row GHIN sent malformed threw `ValidationError` and took every other golfer's handicap with it, and `onDegraded` could never fire because there was no partition to report a drop from. Both now use `partitionRows`, matching `courses.search`, `courses.getDetails`, and `golfers.search` (#51, #53, #57). The good rows come back in `course_handicaps` / `playing_handicaps`, and each response carries an additive `invalid` key holding the rejected rows **raw and untransformed** — a Zod issue list tells you the shape you expected, not the shape GHIN sent.

`handicaps.getCourseHandicaps` and `handicaps.getPlayingHandicaps` now call `onDegraded` (entities `course_handicaps_get` and `playing_handicaps_post`) whenever rows are dropped, so degradation is never silent: a foursome that quietly returns three handicaps is otherwise indistinguishable from a threesome.

**A malformed row no longer throws.** Callers catching `ValidationError` from these two endpoints will find that throw no longer happens — the row lands in `invalid` and `onDegraded` fires instead, and the caller gets the golfers that did parse.
