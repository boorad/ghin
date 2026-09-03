---
'@spicygolf/ghin': patch
---

A blank descriptive string no longer costs the caller the row

`string` in this library is `z.string().trim().min(1)`, so a `''` failed validation — and every schema that used it for a *descriptive* field turned GHIN's ordinary "nothing to display here" into a rejected row. Behind `partitionRows` that silently shrinks a response; inside an all-or-nothing array it takes the whole parent object.

Found in production 2026-09-03 (#85): a 23-row `golfers.search` returned 22 golfers and fired `onDegraded`. The dropped golfer had no recorded low Handicap Index, which GHIN reports as `low_hi_value: 999` with a blank `low_hi_display`. To the caller the golfer was simply not on GHIN.

Every descriptive string in the library now uses `emptyStringToNull`, which reads `''` as `null`:

- `schemaGolfer` — `association_name`, `hi_display`, `low_hi_display`, `message_club_authorized`
- `schemaCourseHandicapRating` — `course_handicap_display`. This one is the sharpest: `ratings` is all-or-nothing, so a blank display string failed the **entire tee set**, not one rating.
- `schemaCourse` / `schemaFacility` — `Address1`, `Address2`, `City`, `Country`, `Email`, `State`, `Telephone`. A blank `Address2` is what a one-line address looks like.
- `schemaCourseDetailsFacility`, `schemaCourseDetailsResponse`, `schemaTeeSetRatingCourse`, `schemaTeeSetRatingFacility` — `FacilityName`, `FacilityStatus`, `CourseCity`
- `schemaTeeSetRatingForScorePostingEntry` — `DisplayName`, `Gender`, `TeeSetStatus`, `EligibleSides`

Identity fields stay strict: `last_name`, `CourseName`, `FacilityName` where required, `TeeSetRatingName`, `RatingType`, `tee_set_side`. A blank there is genuinely unusable.

No type changes and nothing to migrate — `string.nullish()` and `emptyStringToNull.nullish()` both emit `string | null | undefined`, and the required `.nullable()` fields on `schemaFacility` keep emitting `string | null`. Only the runtime gets more permissive.

This also retires a documented carve-out in `scores/post-response.ts`, which held that row schemas behind `partitionRows` could afford to be stricter because a bad value "costs one row and surfaces through `onDegraded`". #85 is the counter-evidence: the report goes to an error tracker, and the user just sees a missing golfer.
