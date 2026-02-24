# GHIN API Endpoint Reference

Comprehensive reference for GHIN API endpoints used by this library, including paths, methods, query parameters, and response structures.

**Base URL:** `https://api2.ghin.com/api/v1`

All requests require an `Authorization: Bearer <golfer_user_token>` header (handled automatically by `GhinClient`) and a `source=GHINcom` query parameter.

> **Breaking change (2026):** As of early 2026, all GHIN API endpoints require authentication. Previously, some endpoints (e.g., `golfers/search.json`) allowed unauthenticated access. Unauthenticated requests now return `401 Unauthorized`.

---

## Authentication

### Firebase Installation Token

**POST** `https://firebaseinstallations.googleapis.com/v1/projects/ghin-mobile-app/installations`

Obtain a Firebase installation token (Step 1 of the default auth flow). See [AUTHENTICATION.md](./AUTHENTICATION.md) for full details.

### Golfer Login

**POST** `/golfer_login.json`

Exchange Firebase installation token + GHIN credentials for a bearer token (Step 2 of default flow).

### Direct API Login

**POST** `/users/login.json`

Direct credential exchange for accounts with API access enabled (`apiAccess: true`).

---

## Golfers

### Search Golfers

**GET** `/golfers/search.json`

Search for a specific golfer by GHIN number.

| Parameter | Type | Description |
|-----------|------|-------------|
| `golfer_id` | number | GHIN number (exact match) |
| `per_page` | number | Results per page (default: 25) |
| `page` | number | Page number (default: 1) |

**Response:**
```json
{
  "golfers": [
    {
      "ghin_number": 1234567,
      "first_name": "John",
      "last_name": "Doe",
      "status": "Active",
      "handicap_index": "12.5",
      "club_name": "Augusta National",
      "state": "US-GA",
      "country": "USA"
    }
  ]
}
```

### Global Golfer Search

**GET** `/golfers.json`

Search golfers by name, club, or other criteria.

| Parameter | Type | Description |
|-----------|------|-------------|
| `last_name` | string | Golfer's last name (partial match) |
| `first_name` | string | Golfer's first name (partial match) |
| `ghin` | number | GHIN number (exact match) |
| `status` | string | `Active` or `Inactive` |
| `from_ghin` | boolean | Search from GHIN registry (used by `golfers.getOne()`) |
| `page` | number | Page number (default: 1) |
| `per_page` | number | Results per page (default: 25) |
| `sorting_criteria` | string | Sort field (default: `last_name_first_name`) |
| `order` | string | `asc` or `desc` |

### Get Golfer Following List

**GET** `/golfers/{ghinNumber}/following.json`

Fetch the list of golfers that the authenticated golfer is following.

> **Note:** This endpoint was discovered by inspecting network traffic on the ghin.com SPA.

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string | Always `GHINcom` |

**Response:**
```json
{
  "golfers": [
    {
      "ghin": 7654321,
      "first_name": "Jane",
      "last_name": "Smith",
      "status": "Active",
      "handicap_index": "8.2",
      "club_name": "Pebble Beach",
      "state": "US-CA",
      "country": "USA"
    }
  ]
}
```

---

## Handicaps

### Get Golfer Handicap

**GET** `/golfers/{ghin}/handicap_index.json`

| Parameter | Type | Description |
|-----------|------|-------------|
| `ghin` | number | GHIN number |
| `source` | string | Always `GHINcom` |

**Response:**
```json
{
  "golfer": {
    "ghin": 1234567,
    "handicap_index": "12.5",
    "low_handicap_index": "10.2",
    "handicap_index_display": "12.5",
    "trend": "0.1"
  }
}
```

### Get Course Player Handicaps

**POST** `/playing_handicaps.json`

Calculate course handicap for one or more golfers on a specific tee set.

**Request body:**
```json
{
  "golfers": [
    {
      "golfer_id": 1234567,
      "tee_set_id": 98765,
      "tee_set_side": "All 18"
    }
  ],
  "source": "GHINcom"
}
```

**Response:**
```json
{
  "course_handicaps": [
    {
      "golfer_id": 1234567,
      "course_handicap": 14,
      "playing_handicap": 14
    }
  ]
}
```

---

## Scores

### Get Golfer Scores

**GET** `/golfers/{golfer_id}/scores.json`

| Parameter | Type | Description |
|-----------|------|-------------|
| `golfer_id` | number | GHIN number |
| `from_date_played` | string | Start date (YYYY-MM-DD) |
| `to_date_played` | string | End date (YYYY-MM-DD) |
| `score_types` | string[] | `H` (Home), `A` (Away), `T` (Tournament) |
| `source` | string | Always `GHINcom` |

**Response:**
```json
{
  "scores": [
    {
      "id": 99887766,
      "adjusted_gross_score": 85,
      "differential": "10.5",
      "course_name": "Augusta National",
      "played_at": "2024-06-15",
      "score_type": "H",
      "tee_name": "White",
      "number_of_holes": 18
    }
  ]
}
```

---

## Courses

### Search Courses

**GET** `/crsCourseMethods.asmx/SearchCourses.json`

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Course name (partial match) |
| `city` | string | City |
| `state_code` | string | State code (e.g., `US-GA`) |
| `country_code` | string | Country code (e.g., `USA`) |
| `source` | string | Always `GHINcom` |

**Response:**
```json
{
  "courses": [
    {
      "CourseID": 13995,
      "CourseName": "Druid Hills Golf Club",
      "FacilityID": 11807,
      "FacilityName": "Druid Hills Golf Club",
      "FullName": "Druid Hills Golf Club - Druid Hills Golf Club",
      "Address1": "740 Clifton Road NE",
      "City": "Atlanta",
      "State": "US-GA",
      "Country": "USA",
      "Zip": "30307",
      "CourseStatus": "Active",
      "FacilityStatus": "Active",
      "Ratings": []
    }
  ]
}
```

### Get Course Details

**GET** `/crsCourseMethods.asmx/GetCourseDetails.json`

Returns full course details including all tee sets with ratings and **hole-by-hole data** (par, yardage, handicap allocation per hole). This is the primary endpoint for importing course data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `courseId` | number | Course ID (from search results) |
| `include_altered_tees` | boolean | Include altered tee configurations (optional, default: false) |
| `source` | string | Always `GHINcom` |

**Response:**
```json
{
  "CourseId": 24279,
  "CourseName": "Saddleback Golf Club",
  "CourseCity": "Firestone",
  "CourseState": "US-CO",
  "CourseStatus": "Active",
  "CourseNumber": 1,
  "Facility": {
    "FacilityId": 20601,
    "FacilityName": "Saddleback Golf Club",
    "FacilityNumber": null,
    "FacilityStatus": "Active",
    "GolfAssociationId": null,
    "GeoLocationFormattedAddress": "...",
    "GeoLocationLatitude": 40.123,
    "GeoLocationLongitude": -104.987
  },
  "Season": {
    "SeasonName": "Annual",
    "SeasonStartDate": "3/1",
    "SeasonEndDate": "11/30",
    "IsAllYear": false
  },
  "TeeSets": [
    {
      "TeeSetRatingId": 282104,
      "TeeSetRatingName": "Silver",
      "Gender": "Female",
      "HolesNumber": 18,
      "TotalPar": 72,
      "TotalYardage": 4855,
      "TotalMeters": 4440,
      "StrokeAllocation": true,
      "IsShorter": null,
      "LegacyCRPTeeId": 0,
      "EligibleSides": null,
      "Ratings": [
        {
          "RatingType": "Total",
          "CourseRating": 67.0,
          "SlopeRating": 122,
          "BogeyRating": 91.3
        },
        {
          "RatingType": "Front",
          "CourseRating": 33.1,
          "SlopeRating": 119,
          "BogeyRating": 45.4
        },
        {
          "RatingType": "Back",
          "CourseRating": 33.9,
          "SlopeRating": 126,
          "BogeyRating": 45.9
        }
      ],
      "Holes": [
        { "Number": 1, "HoleId": 123, "Par": 4, "Allocation": 5, "Length": 299 },
        { "Number": 2, "HoleId": 124, "Par": 4, "Allocation": 11, "Length": 270 },
        { "Number": 3, "HoleId": 125, "Par": 5, "Allocation": 1, "Length": 417 }
      ]
    }
  ]
}
```

> **Note on combo tee sets:** Tee sets with combined names (e.g., "Black/Gold") may declare `HolesNumber: 18` but return an **empty** `Holes` array. Consumers should handle `Holes.length === 0` even when `HolesNumber > 0`. These combo tees typically exist for rating purposes and don't represent a playable tee configuration.

> **Note on Male/Female tee sets:** GHIN stores Male and Female ratings as separate tee sets with the **same name** (e.g., two "Silver" entries — one with `Gender: "Female"`, one with `Gender: "Male"`). When building a unified tee sheet, merge by `TeeSetRatingName` and extract gender-specific ratings and hole data from each.

### Get Course Countries

**GET** `/get_countries_and_states.json`

Returns a list of countries (with nested states) that have GHIN-rated courses.

### Get Tee Set Rating

**GET** `/TeeSetRatings/{teeSetRatingId}.json`

Fetch a single tee set's full rating data by its ID (alternative to parsing from `GetCourseDetails`).

| Parameter | Type | Description |
|-----------|------|-------------|
| `tee_set_rating_id` | number | Tee set rating ID (from course details `TeeSetRatingId`) |
| `include_altered_tees` | boolean | Include altered tee sets (optional) |
| `source` | string | Always `GHINcom` |

**Response:** Same structure as a single entry in the `TeeSets` array from `GetCourseDetails`.

---

## Facilities

### Search Facilities

**GET** `/facilities/search.json`

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Facility name (partial match) |
| `city` | string | City |
| `state` | string | State code (e.g., `US-GA`) |
| `country` | string | Country code (e.g., `USA`) |
| `source` | string | Always `GHINcom` |

**Response:** Array of facility objects (**not wrapped** — returns array directly, unlike most endpoints):
```json
[
  {
    "FacilityId": 11807,
    "FacilityStatus": "Active",
    "FacilityName": "Druid Hills Golf Club",
    "City": "Atlanta",
    "State": "US-GA",
    "Country": "USA",
    "Associations": [],
    "Courses": [
      {
        "CourseId": 13995,
        "CourseStatus": "Active",
        "CourseName": "Druid Hills Golf Club",
        "NumberOfHoles": 18
      }
    ]
  }
]
```

> **Note:** The Facilities API returns an array directly (unlike most endpoints which wrap in an object).

---

## Notes

- All date parameters use `YYYY-MM-DD` format
- The `source` parameter should always be `GHINcom` for web API access
- Geolocation fields (`GeoLocationLatitude`, `GeoLocationLongitude`) may be absent in search responses and default to `null`
- Field naming conventions differ between Facilities (`FacilityId`, `CourseId`) and Courses (`FacilityID`, `CourseID`) APIs — note the inconsistent casing of "ID" vs "Id"
- The course handicap endpoint path in the codebase is `/playing_handicaps.json`, not `/course_handicaps.json`
