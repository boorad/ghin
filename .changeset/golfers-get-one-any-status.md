---
'@spicygolf/ghin': minor
---

`golfers.getOne` now resolves a golfer of any membership status

`getOne` searched with `status: 'Active'`, so a lapsed or inactive member
resolved `undefined` — no error, and indistinguishable from "no such GHIN
number". Downstream that reads as a cache miss, and a stale Handicap Index gets
rendered instead of the golfer's real state.

Measured against `api-uat`, 2026-09-02, golfer 2890015: `status=Active` returns
0 rows, `status=Inactive` returns 3, and `status=All` returns 0 — but **omitting**
the parameter returns all 3. So there was never a second request to make; the
filter simply did not need to be there for a lookup by exact GHIN number.
`handicaps.getOne` delegates to `golfers.getOne` and inherits the fix.

`golfers.search` and `golfers.getMany` keep their `status: 'Active'` default and
gain `status: null` as an explicit opt-out, which omits the parameter.

Alongside:

- The response `status` field now models `'Archived'`. UAT returns it, and the
  enum did not — so an archived golfer was failing schema validation and being
  dropped from the batch. Request filters stay `'Active' | 'Inactive'`; only
  those two are proven to work as filters.
- A present-but-`undefined` parameter no longer reaches the wire as `key=`.
  `golfers.search`/`globalSearch` sent `page=`, which GHIN answers with
  `400 {"errors":{"page":["can't be blank"]}}`; `golfers.getScores`,
  `courses.getDetails`, `courses.search`, `facilities.search` and
  `handicaps.getCourseHandicaps` threw a `TypeError` that surfaced as an `Err`.
  Undefined now falls back to the default, as an absent key always did.

Two things to check when upgrading:

- An exhaustive `switch` over `golfer.status` with no `default` stops compiling,
  because `'Archived'` is now in the union.
- Code that treated "`getOne` returned something" as "this golfer is an active
  member" needs to read `status` off the record. That inference was never sound;
  the old behaviour made it work by accident.
- `{ status: undefined }` no longer clears the filter — use `status: null`.
  Passing `undefined` used to reach the wire as `status=`, which GHIN reads as
  "no filter"; it now falls back to the `'Active'` default like an absent key
  always did. If you were relying on that to see inactive golfers through
  `golfers.search` or `golfers.getMany`, switch to `null` or the filter comes
  back on silently.

  Swap it in the *same* change as the version bump, not before: on 0.16.0 both
  request schemas are `.optional()`, so `null` fails `safeParse` and comes back
  a `ValidationError` without ever reaching the network. There is no value that
  clears the filter on both versions.
