# `ghin`

⛳ An unofficial wrapper for the GHIN api

[![npm version](https://img.shields.io/npm/v/@spicygolf/ghin)](https://www.npmjs.com/package/@spicygolf/ghin)
![Downloads](https://img.shields.io/github/downloads/boorad/ghin/total)
[![codecov](https://codecov.io/gh/boorad/ghin/branch/main/graph/badge.svg)](https://codecov.io/gh/boorad/ghin)
[![Issues](https://img.shields.io/github/issues/boorad/ghin)](https://github.com/boorad/ghin/issues)
[![License](https://img.shields.io/github/license/boorad/ghin)](https://github.com/boorad/ghin/blob/main/LICENSE)

This TypeScript library provides a convenient and easy-to-use API wrapper for accessing the Golfer Handicap Index Network (GHIN) api unofficially. It allows you to interact with GHIN data, retrieve golfer handicaps, scores, and perform various operations related to golf handicaps.

## API Access

This library is a client only — it ships no GHIN code or data, and it does not
bypass authentication. You must supply your own credentials.

It also implements no part of the World Handicap System — no handicap formula, no
Course Rating System. Handicap indexes and course/playing handicaps are returned
by the USGA's centralized computation service; this library only transports them.

Bring credentials you are authorized to use. Vendor access is granted through the
USGA's Golfer Product Access (GPA) program, under a GPA and API agreement between
the vendor and the USGA — that agreement, not the consumer
[GHIN Terms of Service](https://www.usga.org/content/usga/home-page/Handicap-ghin/ghin-terms-of-service.html),
governs API use, and each account carries its own GPA entitlements. If you aren't
a GPA Technology Vendor, confirm your intended use is permitted before pointing
this at the API. Your compliance with USGA's terms is your responsibility.

## About This Fork

This is a fork of [n8io/ghin](https://github.com/n8io/ghin), originally created by Nate Clark. This fork includes additional features and improvements.

## Features

- Retrieve golfer handicap information.
- Retrieve course and playing handicaps for golfers.
- Search for golfers by name, ID, or other criteria.
- Access golfer scoring history.
- And more!

## Installation

To use this library in your TypeScript project, you can install it via npm or bun:

```shell
npm install @spicygolf/ghin
# or
bun add @spicygolf/ghin
```

## Usage

Here's a quick example of how to use this library:

```typescript
import { GhinClient } from '@spicygolf/ghin'

// Initialize the client. The constructor is the one part of the surface that
// still throws — a bad config is a boot-time programmer error, not a runtime
// API failure, so it raises `ConfigurationError` rather than returning a Result.
const ghin = new GhinClient({
  password: process.env.GHIN_PASSWORD,
  username: process.env.GHIN_USERNAME,
})

// Get a golfer's handicap. Active golfers only: this searches with
// `status: 'Active'` and cannot be opted out of, so an inactive or lapsed
// member comes back as `undefined` even though they have a readable index —
// use `ghin.golfers.search({ golfer_id, status: 'Inactive' })` for those.
const ghinNumber = 1234567
const result = await ghin.handicaps.getOne(ghinNumber)

// Every method resolves to a `Result<T, GhinError>` and never rejects, so
// check the error case before touching the value.
if (result.isErr()) {
  // a `GhinError` — `code`, `message`, `cause`, and `statusCode` when the
  // failure came off the wire
  console.error(result.error.code, result.error.statusCode, result.error.message)
} else {
  // `undefined` when no active golfer matches, and `handicap_index` is `null`
  // for a golfer with no established index (GHIN sends `"NH"` on the wire)
  const golfer = result.value
  console.log(`Golfer ${ghinNumber} has a handicap of ${golfer?.handicap_index}`)
}
```

### Results, not exceptions

Every method on `GhinClient` returns `Promise<Result<T, GhinError>>` from
[neverthrow](https://github.com/supermacro/neverthrow) — already a dependency of
this package, so there is nothing extra to install — and `webhooks.iterateUndelivered`
yields one `Result` per envelope. None of them reject; a failure arrives as an `Err`
carrying a `GhinError` subclass (`AuthenticationError`, `NetworkError`,
`RateLimitError`, `ValidationError`, `CacheError`) with `code`, `statusCode` and
`cause` intact, plus `retryAfter` on `RateLimitError` and `field` on
`ValidationError`. `new GhinClient(config)` is the sole exception and
still throws `ConfigurationError`.

**"Not found" is an `Ok`, not an `Err`.** `handicaps.getOne` and `golfers.getOne`
return `ok(undefined)` when no active golfer matches the GHIN number — "no such
active golfer" is a normal answer from GHIN, not a failure — so `result.isErr()`
stays `false` and the `undefined` shows up in `result.value`. This is the one place
a reader might reasonably expect an `Err`; treat `ok(undefined)` as the not-found
signal.

## TODOs

- [x] 🔑 Add client authentication
- [x] ♻️ Add client token auto-refresh
- [x] 💸 Add configurable cache client
- [x] ✨ Add golfer search
- [x] ✨ Add golfer scores fetching
- [x] ✨ Add course handicap fetching
- [x] 💄 Enforce code style for consistency
- [x] ✨ Add course search
- [x] ✨ Add course details fetching
- [x] 🧪 Test coverage all the things
- [ ] 📘 Autogenerated documentation

## Contributing

We welcome contributions from the community. If you'd like to contribute to this project, please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and write tests if applicable.
4. Commit your changes and push them to your fork.
5. Open a pull request to the main repository.

## License

MIT License

Copyright (c) 2023 Nate Clark  
Copyright (c) 2025 Brad Anderson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
