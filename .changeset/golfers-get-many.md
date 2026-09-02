---
'@spicygolf/ghin': minor
---

Add `golfers.getMany` — batched lookup for a list of GHIN numbers

GHIN's `golfers/search` accepts a comma-separated list in `golfer_id`, which is
the only bulk golfer lookup the API grants ordinary credentials (the Admin Portal
`hi_changed_golfers` and `clubs/{id}/golfers` endpoints are `AccessDenied`). See
issue #81.

`golfers.getMany(ghinNumbers, { status?, updated_since? })` resolves to
`{ golfers, missing }` and handles the three things the raw parameter gets wrong:
GHIN pages by row rather than by golfer with no total to page against,
multi-club golfers arrive once per affiliation, and unknown GHIN numbers are
dropped without an error. Against the staging API, 12 GHIN numbers is one HTTP
call and 121 is three.

`GolfersSearchRequest['golfer_id']` now also accepts `number[]`, and the type is
derived with `z.input` so it describes what a caller passes rather than the
joined string that goes on the wire.
