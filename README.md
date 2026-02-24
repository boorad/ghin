# `ghin` ⛳ An unofficial wrapper for the GHIN api

[![npm version](https://img.shields.io/npm/v/@spicygolf/ghin)](https://www.npmjs.com/package/@spicygolf/ghin)
![Downloads](https://img.shields.io/github/downloads/boorad/ghin/total)
[![codecov](https://codecov.io/gh/boorad/ghin/branch/main/graph/badge.svg)](https://codecov.io/gh/boorad/ghin)
[![Issues](https://img.shields.io/github/issues/boorad/ghin)](https://github.com/boorad/ghin/issues)
[![License](https://img.shields.io/github/license/boorad/ghin)](https://github.com/boorad/ghin/blob/main/LICENSE)

This TypeScript library provides a convenient, type-safe wrapper for the Golfer Handicap Index Network (GHIN) API. It lets you retrieve golfer handicaps, scores, course details, facility information, and more — with full Zod validation on every response.

## About This Fork

This is a fork of [n8io/ghin](https://github.com/n8io/ghin), originally created by Nate Clark. This fork adds authentication, a configurable cache layer, facility search, tee-set rating lookup, a `getFollowing` endpoint, and comprehensive documentation.

## Features

- 🔑 Authenticated client with automatic token refresh
- - 🏌️ Golfer lookup, global search, scores, and following list
  - - ⛳ Course search, course details, and tee-set ratings
    - - 🏟️ Facility search
      - - 🧮 Course handicap calculation (at multiple allowance percentages)
        - - 💸 Configurable in-memory (or custom) cache client
          - - ✅ Full Zod validation on every API response
            - - 🧪 182 unit tests — no network calls required in tests
             
              - ## Installation
             
              - ```shell
                npm install @spicygolf/ghin
                # or
                bun add @spicygolf/ghin
                ```

                ## Quick Start

                ```typescript
                import { GhinClient } from '@spicygolf/ghin'

                const ghin = new GhinClient({
                  username: process.env.GHIN_USERNAME!,
                  password: process.env.GHIN_PASSWORD!,
                })
                ```

                Set `GHIN_USERNAME` and `GHIN_PASSWORD` in your environment (see `.env.example`). The client handles the two-step Firebase + GHIN auth flow and token refresh automatically. See [docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md) for details.

                ## API Reference

                A complete endpoint reference is available in [docs/API_ENDPOINTS.md](./docs/API_ENDPOINTS.md).

                ### `golfers`

                ```typescript
                // Look up a single active golfer by GHIN number
                const golfer = await ghin.golfers.getOne(1234567)
                console.log(golfer?.handicap_index) // e.g. 8.4

                // Search golfers by name / state / club
                const results = await ghin.golfers.search({
                  last_name: 'Smith',
                  state: 'GA',
                  status: 'Active',
                })

                // Global search (searches across all associations)
                const global = await ghin.golfers.globalSearch({
                  ghin: 1234567,
                })

                // Get a golfer's score history
                const scores = await ghin.golfers.getScores(1234567, {
                  from_date_played: new Date('2024-01-01'),
                  to_date_played: new Date('2024-12-31'),
                  score_types: ['T', 'H'],  // T = Tournament, H = Home
                  limit: 20,
                })

                // Get the authenticated user's "following" list
                const following = await ghin.golfers.getFollowing(1234567)
                ```

                ### `handicaps`

                ```typescript
                // Get a golfer's current handicap index + club memberships
                const { handicap_index, clubs } = await ghin.handicaps.getOne(1234567)

                // Calculate course handicaps for one or more golfers
                // (returns playing handicap at 5% allowance increments from 5%–100%)
                const courseHandicaps = await ghin.handicaps.getCoursePlayerHandicaps([
                  {
                    ghin: 1234567,
                    tee_set_id: 98765,
                    tee_set_side: 'All 18',
                  },
                  {
                    handicap_index: 12.4,  // use a manual index instead of GHIN lookup
                    tee_set_id: 98765,
                    tee_set_side: 'F9',
                  },
                ])
                // courseHandicaps[100] → full handicap; courseHandicaps[90] → 90% allowance; etc.
                ```

                ### `courses`

                ```typescript
                // Search courses by name
                const byName = await ghin.courses.search({ name: 'Pebble Beach' })

                // Search courses by state (requires country + state)
                const byState = await ghin.courses.search({ country: 'USA', state: 'CA' })

                // Search courses by facility ID
                const byFacility = await ghin.courses.search({ facility_id: 11807 })

                // Get full course details including tee sets and ratings
                const details = await ghin.courses.getDetails({
                  course_id: 13995,
                  gender: 'M',
                  number_of_holes: 18,
                })

                // Get a specific tee set's rating (course rating, slope, bogey rating per side)
                const teeRating = await ghin.courses.getTeeSetRating({
                  tee_set_rating_id: 555123,
                })
                console.log(teeRating.Ratings) // [{ RatingType: 'Total', CourseRating: 75.5, SlopeRating: 148, ... }]

                // Get all available countries for course search
                const countries = await ghin.courses.getCountries()
                ```

                ### `facilities`

                ```typescript
                // Search facilities by name
                const facilities = await ghin.facilities.search({ name: 'Augusta National' })

                // Search facilities by state
                const byState = await ghin.facilities.search({ country: 'USA', state: 'GA' })

                // Each facility includes its nested course list:
                for (const facility of facilities) {
                  console.log(facility.FacilityName)
                  for (const course of facility.Courses ?? []) {
                    console.log(`  ${course.CourseName} (${course.NumberOfHoles} holes)`)
                  }
                }
                ```

                > **Tip:** Use the Facilities API for initial search (returns all courses at a facility in one call) and the Courses API when you need full course details. See [docs/API_ENDPOINTS.md](./docs/API_ENDPOINTS.md) for a comparison.
                >
                > ## TODOs
                >
                > - [x] 🔑 Add client authentication
                > - [ ] - [x] ♻️ Add client token auto-refresh
                > - [ ] - [x] 💸 Add configurable cache client
                > - [ ] - [x] ✨ Add golfer search
                > - [ ] - [x] ✨ Add golfer scores fetching
                > - [ ] - [x] ✨ Add course handicap fetching
                > - [ ] - [x] 💄 Enforce code style for consistency
                > - [ ] - [x] ✨ Add course search
                > - [ ] - [x] ✨ Add course details fetching
                > - [ ] - [x] 🧪 Test coverage all the things
                > - [ ] - [ ] 📘 Autogenerated documentation
                >
                > - [ ] ## Contributing
                >
                > - [ ] Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for the full development workflow, commit conventions, and how to run tests locally.
                >
                > - [ ] ## License
                >
                > - [ ] MIT License
                >
                > - [ ] Copyright (c) 2023 Nate Clark
                > - [ ] Copyright (c) 2025 Brad Anderson

                Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

                The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

                THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
