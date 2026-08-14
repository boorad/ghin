---
'@spicygolf/ghin': patch
---

Accept GHIN responses that omit or return an empty `first_name` on golfer search results (empty values normalize to `null`), and the `Temporary` score status on scores and score post responses. `ScoreStatus` gains a `TEMPORARY` member.
