---
"@spicygolf/ghin": patch
---

Surface optional `course_id`, `course_name`, and `facility_name` on score rows

`schemaScore` (the `getScores` row) previously stripped course identifiers the
GHIN API returns per score. These are now passed through as optional fields so
consumers can tell which course each score was played at — e.g. to corroborate
player-identity matches by course overlap.
