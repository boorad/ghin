---
'@spicygolf/ghin': patch
---

Require `CourseRating` and `SlopeRating` on a course-details rating row, and fail the tee set rather than the row when one is malformed.

0.15.0 made both nullish along with everything else that wasn't strictly identifying. That went too far: a missing value defaults to `0` downstream, and `0` passes a `typeof x === 'number'` guard, so it reached the Course Handicap formula as a real rating and produced a confidently wrong number instead of reporting the handicap as unavailable. Fabricating a handicap is worse than losing a tee.

Course Rating and Slope Rating aren't partial data — they *are* the rating. `BogeyRating` stays nullish deliberately: it's absent from the Course Handicap formula, so a bogey-less tee is still perfectly playable.

`Ratings` is now all-or-nothing within a tee set, matching `Holes`. Dropping a bad rating row on its own left the slot at zero and said nothing about it — indistinguishable from a tee GHIN rates only partially. A tee set with an unparseable rating now fails into `invalidTeeSets`, which fires `onDegraded`.

Removes the now-unused `dropInvalidRows` export; `partitionRows` is unchanged and still exported.
