# GPA & Score Posting API Support

**Issue**: spicy#419 (GHIN email work)
**Goal**: Add GPA (Golfer Product Access) consent endpoints and score posting to the ghin library
**Branch**: `feat/gpa-score-posting`

## Context

The USGA GPA program requires vendors to:
1. Request golfer consent (sends email in prod, auto-approvable in sandbox/staging)
2. Post scores on behalf of consented golfers
3. Use the official GPA API endpoints (different from the consumer-facing GHIN API)

### GPA API Base URLs
- Sandbox: `https://app-sandbox.hcp2020.com/api/v1`
- Staging: `https://app-stage.hcp2020.com/api/v1`
- Production: `https://app.hcp2020.com/api/v1` (TBD)

### Authentication
- `POST /users/login.json` with `{ email, password, remember_me }` - returns Bearer token
- Tokens last 12 hours; refresh on 401
- The existing `apiAccess: true` mode in RequestClient already uses this flow

### Key Difference from Consumer API
- Consumer API base: `https://api2.ghin.com/api/v1` (Firebase session auth)
- GPA API base: `https://app-sandbox.hcp2020.com/api/v1` (direct login auth)
- The library already supports both via `apiAccess` flag and `baseUrl` override

## Steps

### Phase 1: GPA Consent Endpoints

| # | Step | Status |
|---|------|--------|
| 1 | Add GPA models (request/response schemas) | pending |
| 2 | Add `fetchCustomPath` POST support (already exists, verify) | pending |
| 3 | Add `gpa` namespace to GhinClient with consent methods | pending |
| 4 | Add playground script for testing GPA consent flow | pending |
| 5 | Add tests for GPA consent methods | pending |

#### GPA Consent API Endpoints

```
GET  /users/accesses.json
  → List golfers and their approval status for this GPA vendor

POST /users/golfers/{golfer_id}/request_golfer_product_access.json
  → Request consent from a golfer (sends email in prod)

POST /users/{user_id}/golfers/{golfer_id}/update_golfer_product_access_status.json
  → Update consent status (sandbox/staging only - auto-approve)

DELETE /users/golfers/{golfer_id}/revoke_golfer_product_access.json
  → Revoke GPA access to golfer data
```

#### GPA Models to Create

```typescript
// Request types
type GpaRequestAccessRequest = { golfer_id: number }
type GpaUpdateStatusRequest = { user_id: number; golfer_id: number; status: 'approved' | 'denied' }
type GpaRevokeAccessRequest = { golfer_id: number }

// Response - shape TBD from sandbox testing, likely:
type GpaAccessStatus = {
  golfer_id: number
  status: string  // 'pending' | 'approved' | 'denied'
  // ... other fields
}
type GpaAccessesResponse = { accesses: GpaAccessStatus[] }
```

### Phase 2: Score Posting (Hole-by-Hole)

| # | Step | Status |
|---|------|--------|
| 6 | Add score posting models (HBH request/response schemas) | pending |
| 7 | Add `scores.postHoleByHole()` method to GhinClient | pending |
| 8 | Add `scores.postAdjusted()` method (total score fallback) | pending |
| 9 | Add playground script for testing score posting | pending |
| 10 | Add tests for score posting methods | pending |

#### Score Posting API Endpoints

```
POST /scores/hbh.json          → Post hole-by-hole score
POST /scores/adjusted.json     → Post total (adjusted) score
POST /scores/18h9and9.json     → Post 9-hole totals
```

#### HBH Score Posting Request Shape

From USGA sample files:

```typescript
type HoleDetail = {
  hole_number: number      // 1-18
  raw_score: number        // strokes (0 if x_hole)
  x_hole?: boolean         // true for unplayed holes (10-17 hole rounds)
}

type ScorePostHbhRequest = {
  golfer_id: string
  course_id: string
  tee_set_id: string
  tee_set_side: 'All18' | 'F9' | 'B9'
  played_at: string         // 'YYYY-MM-DD'
  score_type: 'H' | 'A' | 'C'  // Home, Away, Competition
  hole_details: HoleDetail[]
  number_of_holes: '9' | '18'
  number_of_played_holes?: number  // required for 9-hole and 10-17
  gender: 'M' | 'F'
  override_confirmation?: boolean
  is_manual?: boolean
}
```

#### Score Posting Response Shape (from USGA docs)

```typescript
type ScorePostResponse = {
  id: number
  golfer_id: number
  status: 'Validated' | 'UnderReview'
  validation_message?: string    // e.g. "This is possibly a duplicate score..."
  adjusted_gross_score: number
  number_of_holes: number
  number_of_played_holes: number
  differential: number
  scaled_up_differential?: number
  adjusted_scaled_up_differential?: number
  course_id: string
  course_name: string
  facility_name: string
  played_at: string
  tee_name: string
  tee_set_id: string
  course_rating: number
  slope_rating: number
  score_type: string
  // ... other fields TBD from sandbox response
}
```

#### Score Type Detection Logic (for spicy app, but document here)

```
H (Home)  - golfer's home club matches the course's facility
A (Away)  - golfer is playing at a different facility
C (Competition) - tournament/competition round (user-selected)
```

### Phase 3: Additional Endpoints

| # | Step | Status |
|---|------|--------|
| 11 | Add `TeeSetRatingsForScorePosting` endpoint | pending |
| 12 | Add `playing_handicaps` POST endpoint | pending |
| 13 | Add `course_handicaps` GET endpoint | pending |

```
GET  /Courses/{course_id}/TeeSetRatingsForScorePosting.json
POST /playing_handicaps.json
GET  /course_handicaps.json
```

## Implementation Notes

### RequestClient Changes Needed
- The `apiPathnames` map needs new entries for score posting and GPA endpoints
- Score posting uses POST with JSON body (similar to `handicapsGetCoursePlayerHandicaps`)
- GPA endpoints use path parameters (`{golfer_id}`, `{user_id}`) - use `fetchCustomPath`

### Testing Against Sandbox
- Credentials: Already configured in spicy API `.env`
- Sample golfers from `Sandbox Golfer Listing 02132025.xlsx`
- Sample course: Glendora CC (Facility 2438, Course 2539)
- Tee sets: Men's black 262908, Women's blue 510496

### Versioning
- These are additive changes (new methods), so minor version bump
- Current version: 0.8.8 → target 0.9.0

## Related Issues
- spicy#419 - GHIN email work (GPA consent flow)
- spicy#159 - GHIN postings are all 'Home' scores (score_type detection)
- spicy#161 - GHIN posting - handle errors (validation_message handling)
