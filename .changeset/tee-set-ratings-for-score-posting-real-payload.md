---
'@spicygolf/ghin': minor
---

Fix `courses.getTeeSetRatingsForScorePosting`, which failed on every call, and partition its rows so one bad tee set no longer costs the rest.

**The endpoint failed 100% of the time.** `GET /Courses/{course_id}/TeeSetRatingsForScorePosting.json` returns a **bare array** of PascalCase rows. The shipped `schemaTeeSetRatingsForScorePostingResponse` expected `{ tee_set_ratings: [...] }` with snake_case entries (`tee_set_id`, `tee_name`, `course_rating`, `tee_set_side`), so every call threw `ValidationError: Response validation failed: Expected object, received array`. That shape came from the SwaggerHub spec, which does not describe this endpoint — the same root cause as #67 and #62. The schema is now written against a payload captured 2026-09-01 from `api-uat.ghin.com` (course 7817), preserved in `models/course/__fixtures__`.

**The response shape changed**, because there was no working shape to preserve:

```ts
const { tee_set_ratings, invalid } = await client.courses.getTeeSetRatingsForScorePosting({ course_id: 7817 })

// Every tee set arrives three times — pick the side you are posting.
const eighteen = tee_set_ratings.filter((rating) => rating.RatingType === 'Total')
```

Rows are PascalCase and carry `TeeSetRatingId`, `TeeSetRatingName`, `RatingType`, `CourseRating`, `SlopeRating`, `BogeyRating`, `DisplayName`, `Gender`, `TeeSetStatus`, `StrokeAllocation`, `TotalPar`, `IsShorter`, `EligibleSides` and `Holes`. Each entry in `Holes` is PascalCase too — `Number`, `HoleId`, `Length`, `Par` and `Allocation`, of which only `Number` is required — and the schema for one is newly exported as `schemaTeeSetRatingForScorePostingHole`, alongside `schemaTeeSetRatingForScorePostingEntry`.

**`RatingType` is the field consumers must filter on.** GHIN sends one row per tee set *per rating side* — `Total`, `Front` and `Back` — so course 7817 answers with 45 rows for 15 tee sets, and `TeeSetRatingId` is shared by all three rows of a tee set rather than identifying a row. A `Front` row's `CourseRating: 33.2` is a nine-hole rating that is indistinguishable from an eighteen-hole one without reading `RatingType`. There is no `tee_set_side` anywhere in the payload.

The triplet order is not guaranteed, so filter rather than index: on course 13995, `TeeSetRatingId 586548` arrives as `[Total, Back, Front]` while the other 21 tee sets on that course arrive as `[Total, Front, Back]`.

**`TeeSetRatingId` is the id score posting wants.** Pass it verbatim as `tee_set_id` on `scores.postAdjusted` / `scores.postHoleByHole` / `scores.post18h9and9` — the names differ but the number space does not. Verified 2026-09-01 by posting a real score with `tee_set_id: '605066'`, the `TeeSetRatingId` of Red on course 7817, which GHIN accepted and echoed back as `tee_name: 'Red'` with the matching `course_rating: 67.3`. It is also the `tee_set_id` that `/course_handicaps.json` accepts and returns; across courses 7817, 13995 and 1424 the id sets from this endpoint, `/course_handicaps.json` and `courses.getDetails` are identical.

`RatingType`, `TeeSetStatus` and `Gender` are typed as plain strings rather than enums: an enum is right on a request, but pinning one on a response drops the whole row the day GHIN publishes a value this library has not seen. Only `TeeSetRatingId`, `TeeSetRatingName`, `RatingType`, `CourseRating` and `SlopeRating` are required; everything else is `.nullish()`, never a bare `.nullable()`, because GHIN drops keys entirely rather than nulling them (#46, #51, #55, #56, #57). Course Rating and Slope Rating use `strictFloat`, so an explicit `null` is rejected rather than coerced to a fabricated scratch rating (#63).

The response now partitions its rows with `partitionRows`, matching `courses.search`, `courses.getDetails` and `handicaps.getCourseHandicaps` (#51, #53, #67): the good rows come back in `tee_set_ratings`, and the additive `invalid` key holds the rejected rows **raw and untransformed** — a Zod issue list tells you the shape you expected, not the shape GHIN sent. `onDegraded` fires with entity `tee_set_ratings_for_score_posting` whenever rows are dropped, so a response that quietly returns 44 of 45 rows is never mistaken for a course with 44.

**Schema-object surface.** `schemaTeeSetRatingsForScorePostingResponse` is now a `ZodEffects` over an array rather than a `ZodObject`, so the `ZodObject` methods (`.shape`, `.extend()`, `.pick()`, `.merge()`, `.partial()`, `.passthrough()`) are no longer available on it. Parsing is unaffected. Same reason this release is `minor` rather than `patch` as #51, #53 and #67.
