---
'@spicygolf/ghin': patch
---

Accept WHS status-suffixed values in `handicap_index` on the course-handicap and playing-handicap entry schemas.

GHIN returns an index like `"19.1M"` (modified by the Handicap Committee) or `"12.4WD"` (withdrawn) for golfers under a WHS status. `handicap_index` was declared as `float` (`z.coerce.number()`), which turned those into `NaN` and failed the parse — the same production bug fixed for `golfers.search` in #56. Because these responses are plain arrays, one such golfer failed the **entire batch**: requesting course or playing handicaps for a foursome with a single `M`/`WD` player returned nothing for anyone.

`handicap_index` now uses the shared `handicap` helper, so a suffixed value parses to its numeric part and `"NH"`/`"-"` parse to `null`. The published type is unchanged (`number | null | undefined`) — only previously-rejected inputs now parse.

The sibling `course_handicap` and `playing_handicap` fields are deliberately left as `float`/`number`. They carry a separate hazard — `z.coerce.number()` turns an explicit `null` into `0`, fabricating a scratch handicap — which is #63's repo-wide call to make, not this one's.
