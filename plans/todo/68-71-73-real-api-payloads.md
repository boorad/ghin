# 68 / 71 / 73 — align three GHIN models with the real UAT payloads

Three issues, one branch. All three are the same class of bug: the shipped Zod
schema was written against the SwaggerHub spec, and the live API disagrees.

## Problems

**#73 — `courses.getTeeSetRatingsForScorePosting` throws on every call.**
`GET /Courses/{course_id}/TeeSetRatingsForScorePosting.json` returns a bare
array of PascalCase tee-set objects. `schemaTeeSetRatingsForScorePostingResponse`
expects `{ TeeSets: ... }` with snake_case entries, so 100% of calls fail
validation.

**#71 — 19 score fields GHIN actually sends are undeclared.**
`src/playground/score-keys.ts` captured 85 score rows / 396 hole details /
26 statistics blocks from `api-uat.ghin.com` on 2026-09-01. #64's
`.passthrough()` means these keys arrive typed `unknown`; this declares them.
Also re-exports `./score` from the scores barrel, which was never wired up.

**#68 — `handicaps.getOne` targets a path that 404s.**
Entity `golfer` maps to `/search_golfer.json`, which returns 404 on UAT for all
13 staging golfers and every parameter variant. `/golfers/search.json` returns
the same golfer record and carries the handicap index.

## Live tracker

- [x] Phase 1 — #73: rewrite `TeeSetRatingsForScorePosting` against the captured payload
- [x] Phase 2 — #71a: declare the 11 score-row keys and the 8 statistics counters
- [x] Phase 3 — #71b: re-export `./score` from the scores barrel
- [ ] Phase 4 — #68: repoint `handicaps.getOne` at `/golfers/search.json`
- [ ] Phase 5 — whole-branch tests
- [ ] Phase 6 — review + fixes

## Decisions (asked)

1. **#68 — repoint, do not remove.** `handicaps.getOne` keeps its name and is
   backed by `/golfers/search.json` instead of the dead `/search_golfer.json`.
   Ships `patch`. Note the returned shape necessarily changes: `clubs` is not in
   the `golfers/search.json` payload.
2. **#71 — `course_handicap` and `to_par_display_value` stay strings.**
   `course_handicap: string | null` verbatim; `to_par_display_value:
   string | null` with the `"-"` empty sentinel normalized to `null`. Running
   `course_handicap` through the `handicap` helper would coerce a plus handicap
   `"+2"` to `+2`, while this repo represents plus handicaps as *negative*
   numbers (`playing_handicap: -4` alongside `playing_handicap_display: '+4'`) —
   that would emit a sign-flipped Course Handicap.

## Assumptions (self-answered)

1. **#73 response shape is `{ tee_set_ratings: Entry[]; invalid: unknown[] }`.**
   Matches `schemaCourseSearchResponse`, `schemaGolfersSearchResponse` and
   `schemaCourseHandicapsGetResponse`, and gives `reportDegradation` something
   to read. A bare `Entry[]` (the `facility/response.ts` shape) would throw the
   degradation signal away. There is no consumer shape to preserve — the method
   never worked.
2. **`challenge_available` and `country_code` stay undeclared.** Null on all 85
   captured rows, so the real type is unknowable; passthrough carries them.
   Same reasoning as `eligible_sides` at `handicaps/course-handicap.ts:103-106`.
3. **Loosening `schemaStatistics`' 27 required fields and `schemaHoleDetail`'s
   13 is out of scope.** Real gap (one dropped key still costs a whole score
   row) but #71 scopes it as "also open", and the capture has not confirmed
   which of those fields are always sent. Own issue.
