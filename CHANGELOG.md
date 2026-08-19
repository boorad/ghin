# ghin

## 0.15.0

### Minor Changes

- 40a24b8: Stop letting one dropped GHIN key destroy a whole response, and report it when rows are dropped.

  GHIN removes keys from payloads without warning — three outages so far (`Allocation` in #46, the search address keys in #51, `LegacyCRPTeeId` on 2026-08-19). Each was fixed field-by-field, so the next dropped key broke us again. This makes the schemas structurally tolerant instead.

  **Required now means load-bearing.** A field is required only where the caller genuinely cannot proceed without it:

  - Course: `CourseId`, `CourseName`
  - Tee set: `TeeSetRatingId`, `TeeSetRatingName`, and at least one hole
  - Hole: `Number`
  - Golfer: `ghin`, `last_name`

  Everything else is `.nullish()`, and every object is `.passthrough()` so new GHIN fields survive instead of being stripped.

  **Rows degrade individually, responses don't.** `courses.getDetails` parses tee sets one at a time — 21 usable tees beat zero — and returns the rejects as `invalidTeeSets`. `golfers.search` and `golfers.globalSearch` do the same per golfer, so one malformed row no longer empties a search. Holes are deliberately all-or-nothing within a tee set: dropping one bad hole would hand back a 17-hole tee that scores silently wrong.

  **New: `onDegraded`.** An optional `ClientConfig` callback fired whenever rows are dropped, with `{ entity, dropped, total, sample }`. Wire it to your error tracker — silent degradation is indistinguishable from a genuinely short response, which is how all three outages stayed invisible until a user complained. The callback is wrapped so a throwing reporter can't fail the request.

  Verified against live GHIN: Druid Hills (13995) parses 22 tee sets and St. Patrick's Links (31291) parses 6, both unchanged.

## 0.14.1

### Patch Changes

- 4c31618: Tolerate a missing or null `LegacyCRPTeeId` on course-details tee sets. GHIN stopped sending the key on Druid Hills (course 13995) — all 22 tee sets lost it at once. `number` is `z.coerce.number()`, so an absent key coerces to `NaN` and rejected the entire `courses.getDetails` response with a `ValidationError`, leaving callers with no tees at all.

  The field identifies nothing we consume, and `schemaTeeSetRating` already declared it nullable — the course-details schema was the inconsistent one. Same failure class as the per-hole `Allocation` key (#46) and the search address keys (#51).

## 0.14.0

### Minor Changes

- c577576: Make `courses.search` tolerant of the keys GHIN drops. GHIN has started omitting `Address1`, `Address2` and `LegacyCRPCourseId` entirely (not `null`) from search results, which made every row fail validation and rejected the whole response with a `ValidationError`.

  Two changes:

  - Every non-identifying field on `Course` — `Address1`, `Address2`, `City`, `Country`, `Email`, `EntCountryCode`, `EntStateCode`, `LegacyCRPCourseId`, `State`, `Telephone`, `UpdatedOn`, `Zip` — is now `T | null | undefined`, so a missing key no longer fails.
  - **Breaking:** `courses.search` now resolves to `{ courses, invalid }` instead of a bare `Course[]`. Rows are validated individually — valid ones come back in `courses`, rejects come back untouched in `invalid` so callers can log exactly what GHIN sent. One malformed course no longer blanks the entire search.

  Migration: `const courses = await client.courses.search(...)` becomes `const { courses, invalid } = await client.courses.search(...)`.

## 0.13.0

### Minor Changes

- ec6506b: Allow tee set holes to omit `Allocation`. GHIN drops the per-hole `Allocation` key on courses whose tee sets report `StrokeAllocation: false` — every Irish/GB&I course tested — which made `courses.getDetails` and the tee set rating schema reject otherwise-complete payloads with a `ValidationError`. `Allocation` is now `number | null | undefined` on `CourseDetailsResponse` and `TeeSetRatingResponse` holes.

## 0.12.2

### Patch Changes

- b73742e: Accept GHIN responses that omit or return an empty `first_name` on golfer search results (empty values normalize to `null`), and the `Temporary` score status on scores and score post responses. `ScoreStatus` gains a `TEMPORARY` member.

## 0.12.1

### Patch Changes

- b94cad0: Surface optional `course_id`, `course_name`, and `facility_name` on score rows

  `schemaScore` (the `getScores` row) previously stripped course identifiers the
  GHIN API returns per score. These are now passed through as optional fields so
  consumers can tell which course each score was played at — e.g. to corroborate
  player-identity matches by course overlap.

## 0.12.0

### Minor Changes

- 8015734: Fix all four `client.gpa.*` wrappers against staging UAT shapes; previously every method either rejected the real response at the Zod layer or sent a malformed request.

  **Breaking** — `requestAccess(golferId)` is now `requestAccess(golferId, { email })`. USGA requires an `email` body parameter and rejects with `400 { errors: { email: ["can't be blank"] } }` without it.

  **`getAccesses()`** now hits `/users/accesses.json` correctly: the endpoint is USGA's "UserAccesses" and returns `{ federations, associations, clubs, golfers, super_user, subtype }`. The wrapper flattens the `golfers` branch (the only one carrying GPA state) into a clean `Array<{ golferId, userAccessId, golferName, gpaStatus }>` so callers don't have to deal with the unrelated outer fields. IDs arrive as numeric strings on the wire and are coerced to `number`. Observed `gpaStatus` values: `pending` | `approved` | `inactive` (and presumably `denied`).

  **`requestAccess()`**, **`updateStatus()`**, and **`revokeAccess()`** all now expect and return the success-envelope response shape `{ success: string }` (a localized confirmation message). Previous schemas expected `{ golfer_id, status }` / `{ golfer_id }` and would have thrown at parse time against any real call.

  **`updateStatus()`** — `user_id` is the credentialed admin user's `user.id` from `POST /users/login.json` (not the golfer's user, not `userAccessId`). Documented inline on the method.

  Side fact: `revokeAccess()` marks the underlying `user_access` record `inactive` rather than deleting it; re-firing `requestAccess()` against the same golfer reuses that record and flips status back to `pending`.

## 0.11.1

### Patch Changes

- 960b405: Fix webhook settings GET to accept `null` leaves. GHIN returns every event key on every top-level field with `null` as the "unregistered" sentinel rather than omitting the key, which previously caused `schemaWebhookSettings` parsing to fail and `ensureRegistered` to misreport state. The response schema now allows `string | null | undefined` per leaf while PATCH bodies retain the stricter "optional, no null" shape (use `''` to clear a URL).

## 0.11.0

### Minor Changes

- 2ab3a9f: Add webhook support. New `client.webhooks` namespace covers settings CRUD (`get` / `patch` / `delete` / `test`), delivery listing and replay (`list` / `resend`), and higher-level helpers (`ensureRegistered` for idempotent registration, `iterateUndelivered` async generator for missed-delivery recovery workers). Inbound-side helpers `parseWebhookEnvelope`, `signWebhookPayload`, and `verifyWebhookSignature` (HMAC-SHA256, constant-time compare, accepts `string | Buffer | Uint8Array`) are exported from the package root. Envelope `object_type` covers the 6 settings event types plus `'crs'` for Course Rating System deliveries. The signature header name and digest scheme are unconfirmed by USGA; defaults are `X-GHIN-Signature` / `sha256=<hex>` and are exported as constants so a confirmed-different scheme is a one-line change. Additionally, `RequestClient` now emits `%20` instead of `+` for spaces in query strings so endpoints whose backend uses URI-style query parsing (e.g. JAX-RS) decode them correctly.

## 0.10.0

### Minor Changes

- f78af68: Auto re-login on 401/403 responses. Per USGA Data Services §4.2.1, USGA tokens expire after 12 hours regardless of the JWT `exp` claim, so long-running services that hold a `GhinClient` past the session ceiling were failing with `AuthenticationError` until the process restarted. The request client now performs a single-shot re-login + retry on 401/403 (kept outside the exponential-backoff loop to avoid login storms when credentials are actually wrong). Concurrent in-flight requests that all hit 401 share one re-login.

### Patch Changes

- a8712d6: Fix `golfers.getOne` to use the GPA-whitelisted `/golfers/search.json` endpoint instead of `/golfers.json`, which is not allowed for Golfer Product Access credentials and returns 404 AccessDenied in sandbox, UAT, and production.

  Also fix `golfers.search` to include the required `source` query param, and fix `golfers.globalSearch` to pass through all validated request params (previously only `ghin` was sent and other fields like `last_name`, `country`, `status`, `from_ghin`, etc. were silently dropped).

## 0.9.1

### Patch Changes

- 073f2b7: Align GPA and score response schemas with sandbox API
- 5a6c9d5: Fix release workflow to push tags before creating GitHub release

## 0.9.0

### Minor Changes

- 4dc61e3: Add GPA consent, score posting, and handicap calculation endpoints

## 0.8.8

### Patch Changes

- a9f0aab: add `status` field to TeeSetRating model

## 0.8.7

### Patch Changes

- 399c057: chore: 🧹 housekeeping
- 7623160: add TeeSetRatings fetching

## 0.8.6

### Patch Changes

- 6af8d15: fix: 🐛 update tee set request params

## 0.8.5

### Patch Changes

- eb5d1b9: fix: 🐛 course season schema

## 0.8.4

### Patch Changes

- 9b2c679: fix: 🐛 handle geoAddress schema

## 0.8.3

### Patch Changes

- 8df183c: fix: 🐛 Allow courses search with name only

## 0.8.2

### Patch Changes

- 4ef113d: fix: 🐛 handle missing geo fields

## 0.8.1

### Patch Changes

- a000ba8: feat: ✨ Add `facilities` search

## 0.8.0

### Minor Changes

- 1af15bb: feat: ✨ Add approved API access functionality
  publish as `@spicygolf/ghin`

## 0.7.0

### Minor Changes

- 9729d83: ✨ Improve internal code and add full test coverage

## 0.6.0

### Minor Changes

- 13b9e58: feat: ✨ Enhance GHIN client with course-related functionalities

  - Added methods to GhinClient for fetching course countries, details, and searching courses.
  - Introduced new models for course countries, courses, geolocation, and request/response schemas.
  - Updated existing golfer search and handicap response models for consistency.
  - Refactored score models to include new score types and statuses with transformations.
  - Improved validation models for date handling and added short date format.

## 0.5.3

### Patch Changes

- b7af36a: fix: 🐛 Allow parsing handicap value as a float

## 0.5.2

### Patch Changes

- cd83df6: fix: 🐛 Allow parsing of `NH` as a handicap value

## 0.5.1

### Patch Changes

- 6be6085: chore: 💚 Remove requirement for pnpm outside of the library

## 0.5.0

### Minor Changes

- 8d8b27b: chore: 🧹 Make unnecessarily public methods private

## 0.4.2

### Patch Changes

- b2ee106: ⬆️ Update all dependency versions

## 0.4.1

### Patch Changes

- fca6032: fix: 🐛 Properly check cached access token's expiration

## 0.4.0

### Minor Changes

- 4843dd5: feat: ✨ Add `cache client` to `GhinClientConfig`

## 0.3.0

### Minor Changes

- 7012722: feat: ✨ Initial alpha release
