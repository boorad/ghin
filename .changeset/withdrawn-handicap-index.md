---
'@spicygolf/ghin': patch
---

Accept a withdrawn (`WD`) Handicap Index.

When a golfer's Handicap Index is withdrawn, GHIN sends a bare `"WD"` in `handicap_index`, `low_hi`, `hi_display` and `low_hi_display` (with `hi_value: 999` and `hi_withdrawn: true`). The schema only tolerated a number, `NH`, or `-`, so the row failed validation and — since rows are parsed individually — the golfer was dropped from `golfers.search`, `getOne` and `getMany`. The golfer simply didn't appear in results, as if they weren't on GHIN.

Reproduced on UAT with GHIN 13374361.

`WD` now parses the same way `NH` does: `handicap_index` is `null`, while `hi_display` keeps `'WD'` (and `hi_withdrawn` passes through) so a consumer can still tell a withdrawn index from no index. Only an exact `WD` is accepted — any other unknown marker is still rejected and surfaces through `onDegraded`.
