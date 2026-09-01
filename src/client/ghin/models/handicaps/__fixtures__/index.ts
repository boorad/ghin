// Captured 2026-09-01 from api-uat.ghin.com (Druid Golf staging account) with
// the Druid Golf staging test golfers: 13373246/47/48 are established, and
// 13373258 ("Test Golfer1031") has no established index (H.I. `NH`).
//
// Preserved verbatim from the wire, because every one of these details is a bug
// this repo shipped by assuming otherwise:
//   - `/course_handicaps.json` returns `tee_sets`, never a `course_handicaps` array
//   - `course_handicap` / `playing_handicap` are `null` for an NH golfer
//   - `shots_off` is a STRING, and `"-"` for an NH golfer
//   - `tee_set_side` is `'All 18'` with a space
// Trimmed only by dropping tee sets, holes and percentage buckets; no value was
// edited.

export const courseHandicapsGetFixture = {
  tee_sets: [
    {
      tee_set_id: 161278,
      name: 'Black Tees',
      gender: 'M',
      holes_number: 18,
      holes: [
        {
          Number: 1,
          HoleId: 322337,
          Length: 528,
          Par: 5,
          Allocation: 15,
        },
        {
          Number: 2,
          HoleId: 322338,
          Length: 445,
          Par: 4,
          Allocation: 1,
        },
        {
          Number: 3,
          HoleId: 322339,
          Length: 360,
          Par: 4,
          Allocation: 13,
        },
      ],
      is_shorter: null,
      eligible_sides: null,
      ratings: [
        {
          tee_set_side: 'All 18',
          course_rating: 73.2,
          slope_rating: 132,
          par: 72,
          course_handicap: 11,
          course_handicap_display: '11',
        },
        {
          tee_set_side: 'F9',
          course_rating: 36.5,
          slope_rating: 126,
          par: 36,
          course_handicap: 5,
          course_handicap_display: '5',
        },
        {
          tee_set_side: 'B9',
          course_rating: 36.7,
          slope_rating: 137,
          par: 36,
          course_handicap: 6,
          course_handicap_display: '6',
        },
      ],
    },
    {
      tee_set_id: 161279,
      name: 'Blue Tees',
      gender: 'M',
      holes_number: 18,
      holes: [
        {
          Number: 1,
          HoleId: 654950,
          Length: 506,
          Par: 5,
          Allocation: 15,
        },
        {
          Number: 2,
          HoleId: 654951,
          Length: 432,
          Par: 4,
          Allocation: 1,
        },
        {
          Number: 3,
          HoleId: 654952,
          Length: 342,
          Par: 4,
          Allocation: 13,
        },
      ],
      is_shorter: null,
      eligible_sides: null,
      ratings: [
        {
          tee_set_side: 'All 18',
          course_rating: 71.4,
          slope_rating: 129,
          par: 72,
          course_handicap: 9,
          course_handicap_display: '9',
        },
        {
          tee_set_side: 'F9',
          course_rating: 35.6,
          slope_rating: 124,
          par: 36,
          course_handicap: 4,
          course_handicap_display: '4',
        },
        {
          tee_set_side: 'B9',
          course_rating: 35.8,
          slope_rating: 133,
          par: 36,
          course_handicap: 5,
          course_handicap_display: '5',
        },
      ],
    },
  ],
} as const

export const courseHandicapsGetNhFixture = {
  tee_sets: [
    {
      tee_set_id: 161278,
      name: 'Black Tees',
      gender: 'M',
      holes_number: 18,
      holes: [
        {
          Number: 1,
          HoleId: 322337,
          Length: 528,
          Par: 5,
          Allocation: 15,
        },
        {
          Number: 2,
          HoleId: 322338,
          Length: 445,
          Par: 4,
          Allocation: 1,
        },
        {
          Number: 3,
          HoleId: 322339,
          Length: 360,
          Par: 4,
          Allocation: 13,
        },
      ],
      is_shorter: null,
      eligible_sides: null,
      ratings: [
        {
          tee_set_side: 'All 18',
          course_rating: 73.2,
          slope_rating: 132,
          par: 72,
          course_handicap: null,
          course_handicap_display: 'NH',
        },
        {
          tee_set_side: 'F9',
          course_rating: 36.5,
          slope_rating: 126,
          par: 36,
          course_handicap: null,
          course_handicap_display: 'NH',
        },
        {
          tee_set_side: 'B9',
          course_rating: 36.7,
          slope_rating: 137,
          par: 36,
          course_handicap: null,
          course_handicap_display: 'NH',
        },
      ],
    },
    {
      tee_set_id: 161279,
      name: 'Blue Tees',
      gender: 'M',
      holes_number: 18,
      holes: [
        {
          Number: 1,
          HoleId: 654950,
          Length: 506,
          Par: 5,
          Allocation: 15,
        },
        {
          Number: 2,
          HoleId: 654951,
          Length: 432,
          Par: 4,
          Allocation: 1,
        },
        {
          Number: 3,
          HoleId: 654952,
          Length: 342,
          Par: 4,
          Allocation: 13,
        },
      ],
      is_shorter: null,
      eligible_sides: null,
      ratings: [
        {
          tee_set_side: 'All 18',
          course_rating: 71.4,
          slope_rating: 129,
          par: 72,
          course_handicap: null,
          course_handicap_display: 'NH',
        },
        {
          tee_set_side: 'F9',
          course_rating: 35.6,
          slope_rating: 124,
          par: 36,
          course_handicap: null,
          course_handicap_display: 'NH',
        },
        {
          tee_set_side: 'B9',
          course_rating: 35.8,
          slope_rating: 133,
          par: 36,
          course_handicap: null,
          course_handicap_display: 'NH',
        },
      ],
    },
  ],
} as const

export const playingHandicapsWithNhFixture = {
  '5': {
    '13373246': {
      playing_handicap: 0,
      playing_handicap_display: '0',
      shots_off: '0',
    },
    '13373247': {
      playing_handicap: 1,
      playing_handicap_display: '1',
      shots_off: '1',
    },
    '13373248': {
      playing_handicap: 1,
      playing_handicap_display: '1',
      shots_off: '1',
    },
    '13373258': {
      playing_handicap: null,
      playing_handicap_display: 'NH',
      shots_off: '-',
    },
  },
  '100': {
    '13373246': {
      playing_handicap: -4,
      playing_handicap_display: '+4',
      shots_off: '0',
    },
    '13373247': {
      playing_handicap: 11,
      playing_handicap_display: '11',
      shots_off: '15',
    },
    '13373248': {
      playing_handicap: 18,
      playing_handicap_display: '18',
      shots_off: '22',
    },
    '13373258': {
      playing_handicap: null,
      playing_handicap_display: 'NH',
      shots_off: '-',
    },
  },
} as const
