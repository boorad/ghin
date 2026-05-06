---
'@spicygolf/ghin': patch
---

Fix `golfers.getOne` to use the GPA-whitelisted `/golfers/search.json` endpoint instead of `/golfers.json`, which is not allowed for Golfer Product Access credentials and returns 404 AccessDenied in sandbox, UAT, and production.

Also fix `golfers.search` to include the required `source` query param, and fix `golfers.globalSearch` to pass through all validated request params (previously only `ghin` was sent and other fields like `last_name`, `country`, `status`, `from_ghin`, etc. were silently dropped).
