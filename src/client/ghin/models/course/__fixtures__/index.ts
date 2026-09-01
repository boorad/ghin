// Captured 2026-09-01 from api-uat.ghin.com:
// `GET /Courses/7817/TeeSetRatingsForScorePosting.json` (Pebble Beach Golf Links).
// Every value here came off the wire; nothing is synthesized.
//
// Preserved verbatim, because each of these details is a bug this repo shipped by
// assuming otherwise:
//   - the response is a BARE ARRAY, never `{ TeeSets: [...] }`
//   - the rows are PascalCase (`TeeSetRatingId`, `CourseRating`), never the
//     snake_case (`tee_set_id`, `course_rating`) the swagger spec describes
//   - there is no `tee_set_side`; the side lives in `RatingType`, and each tee set
//     appears three times — `Total`, `Front` and `Back`
//   - `TeeSetRatingId` is therefore NOT unique per row: the three rows of one tee
//     set share it (605066 below)
//   - a `Front`/`Back` row carries nine `Holes` on the wire and a nine-hole
//     `CourseRating` (33.2), indistinguishable from an eighteen-hole rating
//     without reading `RatingType`
//   - `EligibleSides` is a string (`'All'`) on four of the 45 rows — the
//     `Total` rows of two combo tee sets, one of which is below — and `null` on
//     the other 41
//
// The live payload is 45 rows (15 tee sets x 3 rating types). Trimmed only by
// dropping rows and by keeping the first three holes of each row; no value was
// edited.

export const teeSetRatingsForScorePostingFixture = [
  {
    TeeSetRatingId: 605066,
    TeeSetStatus: 'Active',
    DisplayName: 'Red',
    Gender: 'Male',
    TeeSetRatingName: 'Red',
    RatingType: 'Total',
    CourseRating: 67.3,
    SlopeRating: 124,
    BogeyRating: 90.3,
    Holes: [
      {
        Number: 1,
        HoleId: 1470026,
        Length: 310,
        Par: 4,
        Allocation: 6,
      },
      {
        Number: 2,
        HoleId: 1470027,
        Length: 358,
        Par: 4,
        Allocation: 10,
      },
      {
        Number: 3,
        HoleId: 1470028,
        Length: 285,
        Par: 4,
        Allocation: 12,
      },
    ],
    StrokeAllocation: true,
    TotalPar: 71,
    IsShorter: null,
    EligibleSides: null,
  },
  {
    TeeSetRatingId: 605066,
    TeeSetStatus: 'Active',
    DisplayName: 'Red - Front 9',
    Gender: 'Male',
    TeeSetRatingName: 'Red',
    RatingType: 'Front',
    CourseRating: 33.2,
    SlopeRating: 121,
    BogeyRating: 44.4,
    Holes: [
      {
        Number: 1,
        HoleId: 1470026,
        Length: 310,
        Par: 4,
        Allocation: 6,
      },
      {
        Number: 2,
        HoleId: 1470027,
        Length: 358,
        Par: 4,
        Allocation: 10,
      },
      {
        Number: 3,
        HoleId: 1470028,
        Length: 285,
        Par: 4,
        Allocation: 12,
      },
    ],
    StrokeAllocation: true,
    TotalPar: 35,
    IsShorter: null,
    EligibleSides: null,
  },
  {
    TeeSetRatingId: 605066,
    TeeSetStatus: 'Active',
    DisplayName: 'Red - Back 9',
    Gender: 'Male',
    TeeSetRatingName: 'Red',
    RatingType: 'Back',
    CourseRating: 34.1,
    SlopeRating: 127,
    BogeyRating: 45.9,
    Holes: [
      {
        Number: 10,
        HoleId: 1470035,
        Length: 338,
        Par: 4,
        Allocation: 3,
      },
      {
        Number: 11,
        HoleId: 1470036,
        Length: 298,
        Par: 4,
        Allocation: 9,
      },
      {
        Number: 12,
        HoleId: 1470037,
        Length: 126,
        Par: 3,
        Allocation: 17,
      },
    ],
    StrokeAllocation: true,
    TotalPar: 36,
    IsShorter: null,
    EligibleSides: null,
  },
  {
    TeeSetRatingId: 809832,
    TeeSetStatus: 'Active',
    DisplayName: 'Green/Red Combo',
    Gender: 'Male',
    TeeSetRatingName: 'Green/Red Combo',
    RatingType: 'Total',
    CourseRating: 68.2,
    SlopeRating: 125,
    BogeyRating: 91.4,
    Holes: [
      {
        Number: 1,
        HoleId: 4162070,
        Length: 328,
        Par: 4,
        Allocation: 6,
      },
      {
        Number: 2,
        HoleId: 4162071,
        Length: 428,
        Par: 5,
        Allocation: 10,
      },
      {
        Number: 3,
        HoleId: 4162072,
        Length: 291,
        Par: 4,
        Allocation: 12,
      },
    ],
    StrokeAllocation: true,
    TotalPar: 72,
    IsShorter: false,
    EligibleSides: 'All',
  },
  {
    TeeSetRatingId: 668146,
    TeeSetStatus: 'Active',
    DisplayName: 'Gold',
    Gender: 'Female',
    TeeSetRatingName: 'Gold',
    RatingType: 'Total',
    CourseRating: 78.2,
    SlopeRating: 146,
    BogeyRating: 112.6,
    Holes: [
      {
        Number: 1,
        HoleId: 936398,
        Length: 349,
        Par: 4,
        Allocation: 10,
      },
      {
        Number: 2,
        HoleId: 936399,
        Length: 491,
        Par: 5,
        Allocation: 6,
      },
      {
        Number: 3,
        HoleId: 936400,
        Length: 381,
        Par: 4,
        Allocation: 12,
      },
    ],
    StrokeAllocation: true,
    TotalPar: 72,
    IsShorter: null,
    EligibleSides: null,
  },
]
