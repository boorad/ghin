---
'@spicygolf/ghin': patch
---

`golfers.search` no longer drops a golfer whose display strings are blank

`schemaGolfer` typed `association_name`, `hi_display`, `low_hi_display` and
`message_club_authorized` as `string`, which is `.trim().min(1)`. GHIN sends
`''` for a display field it has nothing to display — a golfer with no recorded
low index comes back with `low_hi_value: 999` and `low_hi_display: ''` — so the
blank failed validation and took the entire golfer into `invalid`.

Seen in production 2026-09-03: a 23-row search returned 22 golfers and fired
`onDegraded`. The dropped golfer was simply absent from the results, which reads
to the user as "not on GHIN".

These fields are now `emptyStringToNull`, like `first_name`, `club_name` and
`state` already were: a blank parses as `null` rather than rejecting the row.
Consumers already handle `null` here — the field is `.nullish()` — so nothing
changes for a golfer whose display strings are populated.
