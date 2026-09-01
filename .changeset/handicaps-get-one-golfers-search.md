---
'@spicygolf/ghin': minor
---

Fix `handicaps.getOne`, which returned `404 Not Found` on every call, by repointing it at `GET /golfers/search.json`.

**`handicaps.getOne` failed 100% of the time.** It fetched the `golfer` entity, which maps to `/search_golfer.json`. Probed against `api-uat.ghin.com` on 2026-09-01, that path returns `404 Not Found` for all 13 staging golfers and for every parameter variant tried — `ghin`, `golfer_id`, `ghin_number`, and no parameters at all. The same client and token succeeded on `scores`, `course_details`, `course_handicaps_get` and `golfers/search.json` in the same run, so this was neither auth nor transport. End to end: `handicaps.getOne(13373258)` threw `NetworkError: Request failed: 404 Not Found`.

`GET /golfers/search.json` returns the same golfer record and is where the handicap index actually lives:

```
13373246: handicap_index="+4.5"  hi_display="+4.5"  status="Active"
13373258: handicap_index="NH"    hi_display="NH"    status="Active"
```

**The returned shape changes. `clubs` is gone.** The old `schemaGolferHandicapResponse` described `{ golfer: { clubs, handicap_index } }`; `/golfers/search.json` has no `clubs` key, so there is nothing honest to map it from and it is removed rather than shipped as a permanently empty array. Removed with it, by name: `schemaGolferHandicapResponse`, the internal `schemaGolferHandicapClub`, and the `HandicapResponse` type. The `golfer` entity is dropped from the request client's `apiPathnames`, since `handicaps.getOne` was its only consumer.

**This ships as `minor`.** No working consumer can exist — the method always threw — but three public names change regardless, and each one breaks a consumer that merely *compiles* against this package: `schemaGolferHandicapResponse` and the `HandicapResponse` type are deleted off the export surface, and `handicaps.getOne`'s return type widens from `T` to `T | undefined`, so `(await client.handicaps.getOne(id)).handicap_index` no longer type-checks. That is the same fact pattern and the same bump as 0.16.0 (#67), which shipped `minor` for removing `handicaps.getPlayingHandicaps` — a method that likewise could never succeed.

**`handicaps.getOne` now resolves to the golfer record, or `undefined` when no golfer matches** — `Promise<Golfer | undefined>` instead of `Promise<{ clubs, handicap_index }>`. `handicap_index` is still reachable, alongside the rest of the handicap surface the endpoint carries (`hi_display`, `hi_value`, `low_hi`, `low_hi_date`, `low_hi_display`, `low_hi_value`, `hard_cap`, `soft_cap`, `rev_date`, `status`):

```ts
const golfer = await client.handicaps.getOne(13373258)
console.log(golfer?.handicap_index) // null — GHIN sends "NH" for no established index
```

**It only finds `Active` golfers.** `handicaps.getOne` delegates to `golfers.getOne`, which searches with `status: 'Active'` and exposes no way to opt out. A lapsed or inactive member has a real, readable Handicap Index, and this method returns `undefined` for them — silently, with no error, and indistinguishably from "no such GHIN number". Reach for `golfers.search({ golfer_id, status: 'Inactive' })` (or `'All'`) when you need one of those golfers. Widening or parameterizing this is a separate design decision and is not part of this change. Relatedly, the lookup is a golfer search under the hood, so if the golfer's row fails `schemaGolfer` the drop is reported to `onDegraded` under entity `golfers_search`, not under a handicaps entity.

It returns the whole record rather than a narrower "handicap fields only" projection for two reasons: a projection is a hand-maintained key list against an API that adds fields without warning, and `schemaGolfer` is `.passthrough()` (#70), so narrowing here would silently discard the unmodelled keys passthrough exists to preserve. That makes `handicaps.getOne` a thin alias for `golfers.getOne`; it is kept under its own name because it is the library's documented entry point for reading a handicap, and the README quickstart is updated to match.
