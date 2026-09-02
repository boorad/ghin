---
'@spicygolf/ghin': patch
---

`golfers.getOne` now returns a multi-club golfer's home club row

A golfer comes back from GHIN once per club affiliation. `getOne` searched with
`per_page: 1`, so it returned whichever row GHIN sorted first — the Handicap
Index was right either way (it is identical across a golfer's rows) but
`club_name`, `club_id` and `is_home_club` described an arbitrary affiliation.
Club is the field that tells two golfers with the same name apart, so this was
wrong exactly where it mattered.

`getOne` now delegates to `golfers.getMany`, which prefers the home club row.
Still a single request. `handicaps.getOne` delegates to `golfers.getOne` and
inherits the fix.
