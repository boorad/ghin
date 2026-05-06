# ghin

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
