---
'@spicygolf/ghin': patch
---

Fix `courses.getTeeSetRating`, which was rejecting every valid tee, and bring the schema in line with the course-details leniency policy.

`LegacyCRPTeeId` was `.nullable()` — which permits `null` but not a **missing** key. GHIN omits it, and `number` is `z.coerce.number()`, so an absent key became `NaN` and failed. Every call to this endpoint failed validation regardless of the tee. Fourth occurrence of that exact class, after issue #46, issue #51, and the same field on `courses.getDetails`.

The rest of the schema now follows the same policy as `schemaCourseDetailsResponse`: only identity is required (`TeeSetRatingId`, `TeeSetRatingName`, plus holes and ratings), everything descriptive is `.nullish()`, and every object is `.passthrough()`. `CourseRating` and `SlopeRating` stay required on a rating row, for the reason given in 0.15.1 — a defaulted zero passes a `typeof x === 'number'` guard downstream and yields a confidently wrong Course Handicap.

This endpoint matters more than its usage suggests: `TeeSetStatus` (`Active | Inactive | Deleted`) is the **only** place GHIN reports whether a tee is still current. `courses.getDetails` does not carry it.

Verified against live GHIN: tee `921728` returns `status: active`, and a retired id returns a clean `400` naming the tee.
