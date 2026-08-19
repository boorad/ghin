---
'@spicygolf/ghin': patch
---

Stop validating `Email` as an email address on courses and facilities.

GHIN puts whatever it has in that field. Parkview Fairways (course 3363) carries `"www.parkview18.com"`, and `.email()` rejected the entire row — so a real, playable course silently vanished from search results over a field no consumer reads.

Found in production by the `onDegraded` reporter added in 0.15.0, within hours of it shipping: `GHIN course_search dropped 1 of 100 rows`. Exactly the class of quiet data loss that reporter exists to surface.

The webhook `url()` validations are unchanged — those check configuration we supply ourselves, not payloads GHIN sends us.
