---
'@spicygolf/ghin': minor
---

Make `courses.search` tolerant of the keys GHIN drops. GHIN has started omitting `Address1`, `Address2` and `LegacyCRPCourseId` entirely (not `null`) from search results, which made every row fail validation and rejected the whole response with a `ValidationError`.

Two changes:

- Every non-identifying field on `Course` — `Address1`, `Address2`, `City`, `Country`, `Email`, `EntCountryCode`, `EntStateCode`, `LegacyCRPCourseId`, `State`, `Telephone`, `UpdatedOn`, `Zip` — is now `T | null | undefined`, so a missing key no longer fails.
- **Breaking:** `courses.search` now resolves to `{ courses, invalid }` instead of a bare `Course[]`. Rows are validated individually — valid ones come back in `courses`, rejects come back untouched in `invalid` so callers can log exactly what GHIN sent. One malformed course no longer blanks the entire search.

Migration: `const courses = await client.courses.search(...)` becomes `const { courses, invalid } = await client.courses.search(...)`.
