# GHIN API Endpoint Reference

This document provides a comprehensive reference for GHIN API endpoints used by this library, including paths, methods, query parameters, and response structures.

**Base URL:** `https://api2.ghin.com/api/v1`

All requests require an `Authorization: Bearer <golfer_user_token>` header (handled automatically by `GhinClient`) and a `source=GHINcom` query parameter.

---

## Authentication

### Login

**POST** `/golfer_login.json`

Exchange Firebase token for a GHIN session token. See [AUTHENTICATION.md](./AUTHENTICATION.md) for the full two-step flow.

---

## Golfers

### Search Golfers

**GET** `/golfers.json`

| Parameter | Type | Description |
|-----------|------|-------------|
| `last_name` | string | Golfer's last name (partial match) |
| `first_name` | string | Golfer's first name (partial match) |
| `ghin` | number | GHIN number (exact match) |
| `status` | string | `Active` or `Inactive` |
| `page` | number | Page number (default: 1) |
| `per_page` | number | Results per page (default: 25) |
| `sorting_criteria` | string | Sort field (default: `last_name_first_name`) |
| `order` | string | `asc` or `desc` |

**Response:**
```json
{
  "golfers": [
    {
      "ghin": 1234567,
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

### Global Search (from GHIN)

**GET** `/golfers.json`

Same as Search Golfers but with `from_ghin=true`. Used internally by `golfers.getOne()`.

### Get Golfer Following List

**GET** `/golfers/{ghinNumber}/following.json`

Fetch the list of golfers that the authenticated golfer is following.

> **Note:** This endpoint was discovered by inspecting network traffic on the ghin.com SPA.
>
> | Parameter | Type | Description |
> |-----------|------|-------------|
> | `source` | string | Always `GHINcom` |
>
> **Response:**
> ```json
> {
>   "golfers": [
>     {
>       "ghin": 7654321,
>       "first_name": "Jane",
>       "last_name": "Smith",
>       "status": "Active",
>       "handicap_index": "8.2",
>       "club_name": "Pebble Beach",
>       "state": "US-CA",
>       "country": "USA"
>     }
>   ]
> }
> ```
>
> ---
>
> ## Handicaps
>
> ### Get Golfer Handicap
>
> **GET** `/golfers/{ghin}/handicap_index.json`
>
> | Parameter | Type | Description |
> |-----------|------|-------------|
> | `ghin` | number | GHIN number |
> | `source` | string | Always `GHINcom` |
>
> **Response:**
> ```json
> {
>   "golfer": {
>     "ghin": 1234567,
>     "handicap_index": "12.5",
>     "low_handicap_index": "10.2",
>     "handicap_index_display": "12.5",
>     "trend": "0.1"
>   }
> }
> ```
>
> ### Get Course Player Handicaps
>
> **POST** `/course_handicaps.json`
>
> Calculate course handicap for one or more golfers on a specific tee set.
>
> **Request body:**
> ```json
> {
>   "golfers": [
>     {
>       "golfer_id": 1234567,
>       "tee_set_id": 98765,
>       "tee_set_side": "All 18"
>     }
>   ],
>   "source": "GHINcom"
> }
> ```
>
> **Response:**
> ```json
> {
>   "course_handicaps": [
>     {
>       "golfer_id": 1234567,
>       "course_handicap": 14,
>       "playing_handicap": 14
>     }
>   ]
> }
> ```
>
> ---
>
> ## Scores
>
> ### Get Golfer Scores
>
> **GET** `/golfers/{golfer_id}/scores.json`
>
> | Parameter | Type | Description |
> |-----------|------|-------------|
> | `golfer_id` | number | GHIN number |
> | `from_date_played` | string | Start date (YYYY-MM-DD) |
> | `to_date_played` | string | End date (YYYY-MM-DD) |
> | `score_types` | string[] | `H` (Home), `A` (Away), `T` (Tournament) |
> | `source` | string | Always `GHINcom` |
>
> **Response:**
> ```json
> {
>   "scores": [
>     {
>       "id": 99887766,
>       "adjusted_gross_score": 85,
>       "differential": "10.5",
>       "course_name": "Augusta National",
>       "played_at": "2024-06-15",
>       "score_type": "H",
>       "tee_name": "White",
>       "number_of_holes": 18
>     }
>   ]
> }
> ```
>
> ---
>
> ## Courses
>
> ### Search Courses
>
> **GET** `/crsCourseMethods.asmx/SearchCourses.json`
>
> | Parameter | Type | Description |
> |-----------|------|-------------|
> | `name` | string | Course name (partial match) |
> | `city` | string | City |
> | `state_code` | string | State code (e.g., `US-GA`) |
> | `country_code` | string | Country code (e.g., `USA`) |
> | `source` | string | Always `GHINcom` |
>
> **Response:**
> ```json
> {
>   "courses": [
>     {
>       "CourseID": 13995,
>       "CourseName": "Druid Hills Golf Club",
>       "FacilityID": 11807,
>       "FacilityName": "Druid Hills Golf Club",
>       "FullName": "Druid Hills Golf Club - Druid Hills Golf Club",
>       "Address1": "740 Clifton Road NE",
>       "City": "Atlanta",
>       "State": "US-GA",
>       "Country": "USA",
>       "Zip": "30307",
>       "CourseStatus": "Active",
>       "FacilityStatus": "Active",
>       "Ratings": []
>     }
>   ]
> }
> ```
>
> ### Get Course Details
>
> **GET** `/crsCourseMethods.asmx/GetCourse.json`
>
> | Parameter | Type | Description |
> |-----------|------|-------------|
> | `course_id` | number | Course ID |
> | `source` | string | Always `GHINcom` |
>
> ### Get Course Countries
>
> **GET** `/course_countries.json`
>
> Returns a list of countries that have GHIN-rated courses.
>
> ### Get Tee Set Rating
>
> **GET** `/TeeSetRatings/{teeSetRatingId}.json`
>
> | Parameter | Type | Description |
> |-----------|------|-------------|
> | `tee_set_rating_id` | number | Tee set rating ID |
> | `include_altered_tees` | boolean | Include altered tee sets (optional) |
> | `source` | string | Always `GHINcom` |
>
> **Response:** Full tee set rating details including course rating, slope, and par.
>
> ---
>
> ## Facilities
>
> ### Search Facilities
>
> **GET** `/facilities/search.json`
>
> | Parameter | Type | Description |
> |-----------|------|-------------|
> | `name` | string | Facility name (partial match) |
> | `city` | string | City |
> | `state` | string | State code (e.g., `US-GA`) |
> | `country` | string | Country code (e.g., `USA`) |
> | `source` | string | Always `GHINcom` |
>
> **Response:** Array of facility objects (not wrapped — returns array directly):
> ```json
> [
>   {
>     "FacilityId": 11807,
>     "FacilityStatus": "Active",
>     "FacilityName": "Druid Hills Golf Club",
>     "City": "Atlanta",
>     "State": "US-GA",
>     "Country": "USA",
>     "Associations": [],
>     "Courses": [
>       {
>         "CourseId": 13995,
>         "CourseStatus": "Active",
>         "CourseName": "Druid Hills Golf Club",
>         "NumberOfHoles": 18
>       }
>     ]
>   }
> ]
> ```
>
> > **Note:** The Facilities API returns an array directly (unlike most endpoints which wrap in an object). See the [Facilities vs Courses comparison](./llm-output/FACILITIES_VS_COURSES.md) for full details.
> >
> > ---
> >
> > ## Notes
> >
> > - All date parameters use `YYYY-MM-DD` format
> > - - The `source` parameter should always be `GHINcom` for web API access
> >   - - Geolocation fields (`GeoLocationLatitude`, `GeoLocationLongitude`) may be absent in search responses and default to `null`
> >     - - Field naming conventions differ between Facilities (`FacilityId`, `CourseId`) and Courses (`FacilityID`, `CourseID`) APIs
