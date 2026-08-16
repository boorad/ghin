---
'@spicygolf/ghin': minor
---

Allow tee set holes to omit `Allocation`. GHIN drops the per-hole `Allocation` key on courses whose tee sets report `StrokeAllocation: false` — every Irish/GB&I course tested — which made `courses.getDetails` and the tee set rating schema reject otherwise-complete payloads with a `ValidationError`. `Allocation` is now `number | null | undefined` on `CourseDetailsResponse` and `TeeSetRatingResponse` holes.
