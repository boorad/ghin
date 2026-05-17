---
'@spicygolf/ghin': minor
---

Fix all four `client.gpa.*` wrappers against staging UAT shapes; previously every method either rejected the real response at the Zod layer or sent a malformed request.

**Breaking** — `requestAccess(golferId)` is now `requestAccess(golferId, { email })`. USGA requires an `email` body parameter and rejects with `400 { errors: { email: ["can't be blank"] } }` without it.

**`getAccesses()`** now hits `/users/accesses.json` correctly: the endpoint is USGA's "UserAccesses" and returns `{ federations, associations, clubs, golfers, super_user, subtype }`. The wrapper flattens the `golfers` branch (the only one carrying GPA state) into a clean `Array<{ golferId, userAccessId, golferName, gpaStatus }>` so callers don't have to deal with the unrelated outer fields. IDs arrive as numeric strings on the wire and are coerced to `number`. Observed `gpaStatus` values: `pending` | `approved` | `inactive` (and presumably `denied`).

**`requestAccess()`**, **`updateStatus()`**, and **`revokeAccess()`** all now expect and return the success-envelope response shape `{ success: string }` (a localized confirmation message). Previous schemas expected `{ golfer_id, status }` / `{ golfer_id }` and would have thrown at parse time against any real call.

**`updateStatus()`** — `user_id` is the credentialed admin user's `user.id` from `POST /users/login.json` (not the golfer's user, not `userAccessId`). Documented inline on the method.

Side fact: `revokeAccess()` marks the underlying `user_access` record `inactive` rather than deleting it; re-firing `requestAccess()` against the same golfer reuses that record and flips status back to `pending`.
