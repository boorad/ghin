---
'@spicygolf/ghin': patch
---

Accept a WHS status suffix on a Handicap Index value.

GHIN returns values like `19.1M` (modified by the Handicap Committee) and `12.4WD` (withdrawn) in `handicap_index`. The schema only tolerated a bare number, `NH`, or `-`, so a suffixed value failed validation and — since rows are parsed individually — dropped that golfer out of `golfers.search` entirely. The golfer simply didn't appear in results, with no error.

Caught in production by the `onDegraded` reporter: `GHIN golfers_search dropped 1 of 25 rows`.

Suffixed values now parse to their numeric part (`19.1M` → `19.1`), matching what every consumer already expects from the field. `NH` / `-` still map to `null`, plain numbers are unchanged, and a string that isn't a handicap at all is still rejected.
