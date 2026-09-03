# ghin

## 0.18.0

### Minor Changes

- a35a0e4: A blank or null ghin no longer fabricates golfer 0

  `schemaGolfer.ghin` was `number` (`z.coerce.number().int()`), and `Number(null)` and `Number('')` are both `0` — so a row GHIN sent with a null or blank GHIN number parsed **successfully as golfer 0** rather than degrading.

  Two consequences, both the opposite of the salvage `partitionRows` is supposed to give:

  - The row looked valid, so `onDegraded` never fired and nothing reported it.
  - What happened to it next depended on the caller. `golfers.getMany` builds its result by iterating the _requested_ numbers, and a fabricated `0` matches none of them, so the row was **silently dropped**: never in `golfers`, never reconciled against `missing`, and no `onDegraded` to say a row had arrived and been discarded. `golfers.search` and `golfers.globalSearch` return the partitioned rows as they came, so there the same row was **returned to the caller as a fabricated golfer 0**.

  `ghin` now uses `strictNumber`, the #63-trap guard that reads `null` and blank/whitespace strings as no value while still coercing genuine numeric strings. Such rows now move into `invalid`, fire `onDegraded`, and reconcile correctly against `missing`. Genuine numeric-string ghins still coerce, so no valid golfer is affected and the emitted `ghin` type stays `number`.

  **Schema-object surface.** `strictNumber` is a `ZodEffects`, so the emitted `dist/index.d.ts` type of the public `schemaGolfer` export changes: `ghin` goes from `z.ZodNumber` to `z.ZodEffects<z.ZodNumber, number, unknown>`. Schema-level consumers only: `z.input<typeof schemaGolfer>['ghin']` is now `unknown` rather than `number`; `z.infer<>` and the exported `Golfer` / `GolfersSearchResponse` / `GolfersGetManyResponse` types are unchanged (`ghin: number` either way). Same reason this release is `minor` rather than `patch` as #51, #53, #63 and #67.

  Split deliberately from #85 (blank display strings): that change only made parsing more permissive, while this one moves rows into `invalid`, a behaviour change of its own.

### Patch Changes

- 222d3a9: A blank descriptive string no longer costs the caller the row

  `string` in this library is `z.string().trim().min(1)`, so a `''` failed validation — and every schema that used it for a _descriptive_ field turned GHIN's ordinary "nothing to display here" into a rejected row. Behind `partitionRows` that silently shrinks a response; inside an all-or-nothing array it takes the whole parent object.

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

## 0.17.0

### Minor Changes

- 76e7b81: `golfers.getOne` now resolves a golfer of any membership status

  `getOne` searched with `status: 'Active'`, so a lapsed or inactive member
  resolved `undefined` — no error, and indistinguishable from "no such GHIN
  number". Downstream that reads as a cache miss, and a stale Handicap Index gets
  rendered instead of the golfer's real state.

  Measured against `api-uat`, 2026-09-02, golfer 2890015: `status=Active` returns
  0 rows, `status=Inactive` returns 3, and `status=All` returns 0 — but **omitting**
  the parameter returns all 3. So there was never a second request to make; the
  filter simply did not need to be there for a lookup by exact GHIN number.
  `handicaps.getOne` delegates to `golfers.getOne` and inherits the fix.

  `golfers.search` and `golfers.getMany` keep their `status: 'Active'` default and
  gain `status: null` as an explicit opt-out, which omits the parameter.

  Alongside:

  - The response `status` field now models `'Archived'`. UAT returns it, and the
    enum did not — so an archived golfer was failing schema validation and being
    dropped from the batch. Request filters stay `'Active' | 'Inactive'`; only
    those two are proven to work as filters.
  - A present-but-`undefined` parameter no longer reaches the wire as `key=`.
    `golfers.search`/`globalSearch` sent `page=`, which GHIN answers with
    `400 {"errors":{"page":["can't be blank"]}}`; `golfers.getScores`,
    `courses.getDetails`, `courses.search`, `facilities.search` and
    `handicaps.getCourseHandicaps` threw a `TypeError` that surfaced as an `Err`.
    Undefined now falls back to the default, as an absent key always did.

  Two things to check when upgrading:

  - An exhaustive `switch` over `golfer.status` with no `default` stops compiling,
    because `'Archived'` is now in the union.
  - Code that treated "`getOne` returned something" as "this golfer is an active
    member" needs to read `status` off the record. That inference was never sound;
    the old behaviour made it work by accident.
  - `{ status: undefined }` no longer clears the filter — use `status: null`.
    Passing `undefined` used to reach the wire as `status=`, which GHIN reads as
    "no filter"; it now falls back to the `'Active'` default like an absent key
    always did. If you were relying on that to see inactive golfers through
    `golfers.search` or `golfers.getMany`, switch to `null` or the filter comes
    back on silently.

    Swap it in the _same_ change as the version bump, not before: on 0.16.0 both
    request schemas are `.optional()`, so `null` fails `safeParse` and comes back
    a `ValidationError` without ever reaching the network. There is no value that
    clears the filter on both versions.

## 0.16.0

### Minor Changes

- 2a5d13a: Return `Result<T, GhinError>` from every `GhinClient` method instead of throwing (#42).

  All 27 public methods across `courses`, `facilities`, `golfers`, `gpa`, `handicaps`, `scores` and `webhooks` change from `Promise<T>` to `Promise<Result<T, GhinError>>`, and `webhooks.iterateUndelivered` changes from `AsyncGenerator<WebhookEnvelope>` to `AsyncGenerator<Result<WebhookEnvelope, GhinError>>`. `RequestClient` has always returned `Result`; `GhinClient` unwrapped it and rethrew, discarding the typed-error guarantee at exactly the boundary that `CLAUDE.md` says should carry it. This is that discard removed.

  Migrating one surface at a time would leave an API where some methods throw and some return `Result` — strictly worse than uniformly-wrong — so every surface moves in this one release.

  **The dangerous case is silent. `catch` blocks stop catching, and pass-through code keeps compiling.** These methods no longer reject, so a consumer's

  ```ts
  try {
    const scores = await ghin.golfers.getScores(ghinNumber);
  } catch (error) {
    reportToSentry(error); // never runs again
  }
  ```

  still compiles and still runs — the `catch` is simply dead. Worse, code that only _moves the value along_ — logs it, stores it, spreads it, returns it from an API handler — now handles a `Result` object where a payload used to be, **with no throw and no compile error at that boundary**:

  ```ts
  const golfer = await ghin.handicaps.getOne(ghinNumber);

  await db.golfers.insert({ ghinNumber, ...golfer }); // writes a Result, not a golfer
  logger.info({ golfer }); // logs a Result
  ```

  A `Result` serialized into a database row is not recoverable after the fact — the payload is inside `.value` and nothing downstream will tell you it went missing. Before upgrading, grep every `ghin.` call site and confirm each one either unwraps or is caught by the compiler. If you consume this package from JavaScript, or through `any`, the compiler will not help you at all and this grep is the only check you get.

  **Every direct `await client.x.y()` use site stops compiling under `strict`.** That is the good case, and it is most of them: `golfer.handicap_index`, `response.scores.map(...)`, `settings.url` and friends are all errors on a `Result` now, so `tsc` walks you to each one.

  Migration is mechanical — guard, then use `.value`:

  ```ts
  // before
  const golfer = await ghin.handicaps.getOne(ghinNumber);
  console.log(golfer?.handicap_index);

  // after
  const result = await ghin.handicaps.getOne(ghinNumber);

  if (result.isErr()) {
    console.error(result.error.code, result.error.message);
    return;
  }

  console.log(result.value?.handicap_index);
  ```

  `neverthrow` is already a runtime dependency of this package, so there is nothing to install; import `Result` from `neverthrow` directly if you need to name the type. In tests, `_unsafeUnwrap()` / `_unsafeUnwrapErr()` are the quick port, but `isErr()` is what belongs in application code.

  **`E` is `GhinError`, not `Error`.** The error channel is typed to the library's own hierarchy, so `error.code`, `error.statusCode` and `error.cause` are reachable without an `instanceof` narrowing or a cast (`retryAfter` and `field` still need narrowing to `RateLimitError` / `ValidationError`, which now actually works, because the declared type is in the hierarchy). Making that honest required narrowing the layer beneath: `RequestClient.fetch` and `RequestClient.fetchCustomPath`, and `withRetry`/`withRetryAsync` in `src/utils/retry.ts`, all move from `Result<T, Error>` to `Result<T, GhinError>`. That narrowing is internal: neither `RequestClient` nor `src/utils/retry` is reachable from the package entry point (`src/index.ts` re-exports `./client`, `./errors`, `./models` and `./webhooks`, and `./client` re-exports only `./ghin`), so no consumer can be calling them directly. Three error values changed class to make it true: the missing-token login failure became `AuthenticationError` (it was a bare `Error`); `withRetry`'s "Retry exhausted" fallback became `NetworkError` (unreachable in practice — the loop always carries the last real error out); and a non-`GhinError` thrown by a `withRetryAsync` operation, which used to come back as the thrown instance itself, now comes back as a base `GhinError` with the same message and the original on `cause`. The base class is deliberate there: a `NetworkError` without a status code is retryable, so wrapping an arbitrary throw in one would have started retrying errors that were never retried before.

  **The constructor still throws, deliberately.** `new GhinClient(config)` continues to raise `ConfigurationError` on an invalid config rather than returning a `Result`. This is an explicit carve-out, not an oversight: a bad config is a boot-time programmer error, not a runtime API failure, and there is no useful recovery for it at the call site. `RequestClient`'s constructor throws for the same reason. The library's rule is "no method rejects"; construction is not a method.

  **`webhooks.iterateUndelivered` yields a `Result` per envelope and never throws or rejects.** A failure — invalid request, a failed page fetch, or the page cap — arrives as a yielded `err`, so a recovery worker can decide for itself whether to keep going instead of losing the scan to an exception:

  ```ts
  for await (const result of ghin.webhooks.iterateUndelivered({ from_date })) {
    if (result.isErr()) {
      logger.warn({ error: result.error }, "skipping");
      continue;
    }

    await handle(result.value);
  }
  ```

  Two behavioural notes on the generator. First, **envelopes read before a mid-scan failure are now delivered.** The old code threw on a failed page fetch, discarding every envelope it had already read; the generator now yields them all, then yields the `err`, then returns — so a missed-delivery recovery worker drains what it got instead of starting over. All three failure modes are still terminal (there is nothing further to page through), but the per-envelope `Result` shape leaves room for skip-and-continue recovery later without a second breaking change. Second, the page-cap failure is now a `ValidationError` rather than a bare `Error` — the cap only trips when the caller's filters are too broad, which is the same "your request was bad" class as the other input failures.

  **A not-found golfer is `ok(undefined)`, not `err`.** `golfers.getOne` and `handicaps.getOne` resolve `ok(undefined)` when the search matches nothing — "no such active golfer" is a normal GHIN answer, not a failure. This is the one spot where a reader would reasonably expect an `Err`, so: `isErr()` stays `false` and the `undefined` is in `result.value`. Both surfaces assert it explicitly in tests.

  **New public export: `toGhinError(error: unknown): GhinError`** from `src/errors`. It narrows an unknown thrown value to the `GhinError` every `Result` surface promises — a `GhinError` passes through untouched so `statusCode`, `retryAfter`, `field` and `cause` survive, and anything else becomes a `NetworkError` carrying the original message verbatim. It backs the client's own `catch` arms and is exported because consumers bridging throwing third-party code into this package's error type need the same thing.

  Unchanged, and worth stating because the migration touched the surrounding code: no Zod schema moved. Nothing that parsed before is rejected now, and every error message string is byte-identical to the one the old `throw` carried, so message-matching assertions still pass. `onDegraded` still fires only on the success path, still outside the `Result`, and still cannot turn an `Ok` into an `Err` — a response with rows dropped into the `invalid` array remains `Ok` with the survivors.

  **This ships as `minor`, not `major`.** It is unambiguously breaking, and on a `1.x` package it would be a major. On `0.x` this repo has consistently shipped breaking public-surface changes as `minor` — #67 removes `handicaps.getPlayingHandicaps` outright along with six exported names, and #68 repoints `handicaps.getOne`, deleting three more exported names and widening a return type; both are `minor`, and both ride in this same release. Under semver, `0.y` bumps carry no compatibility promise regardless; making this one `major` would signal a stability commitment for `1.0.0` that the API surface has not earned yet. The bump is `minor` for consistency with that precedent, and the breakage is documented here in full rather than encoded in the version number.

- 84776ba: Add `golfers.getMany` — batched lookup for a list of GHIN numbers

  GHIN's `golfers/search` accepts a comma-separated list in `golfer_id`, which is
  the only bulk golfer lookup the API grants ordinary credentials (the Admin Portal
  `hi_changed_golfers` and `clubs/{id}/golfers` endpoints are `AccessDenied`). See
  issue #81.

  `golfers.getMany(ghinNumbers, { status?, updated_since? })` resolves to
  `{ golfers, missing }` and handles the three things the raw parameter gets wrong:
  GHIN pages by row rather than by golfer with no total to page against,
  multi-club golfers arrive once per affiliation, and unknown GHIN numbers are
  dropped without an error. Against the staging API, 12 GHIN numbers is one HTTP
  call and 121 is three.

  `GolfersSearchRequest['golfer_id']` now also accepts `number[]`, and the type is
  derived with `z.input` so it describes what a caller passes rather than the
  joined string that goes on the wire.

- b87fe4d: Fix `handicaps.getOne`, which returned `404 Not Found` on every call, by repointing it at `GET /golfers/search.json`.

  **`handicaps.getOne` failed 100% of the time.** It fetched the `golfer` entity, which maps to `/search_golfer.json`. Probed against `api-uat.ghin.com` on 2026-09-01, that path returns `404 Not Found` for all 13 staging golfers and for every parameter variant tried — `ghin`, `golfer_id`, `ghin_number`, and no parameters at all. The same client and token succeeded on `scores`, `course_details`, `course_handicaps_get` and `golfers/search.json` in the same run, so this was neither auth nor transport. End to end: `handicaps.getOne(13373258)` threw `NetworkError: Request failed: 404 Not Found`.

  `GET /golfers/search.json` returns the same golfer record and is where the handicap index actually lives:

  ```
  13373246: handicap_index="+4.5"  hi_display="+4.5"  status="Active"
  13373258: handicap_index="NH"    hi_display="NH"    status="Active"
  ```

  **The returned shape changes. `clubs` is gone.** The old `schemaGolferHandicapResponse` described `{ golfer: { clubs, handicap_index } }`; `/golfers/search.json` has no `clubs` key, so there is nothing honest to map it from and it is removed rather than shipped as a permanently empty array. Removed with it, by name: `schemaGolferHandicapResponse`, the internal `schemaGolferHandicapClub`, and the `HandicapResponse` type. The `golfer` entity is dropped from the request client's `apiPathnames`, since `handicaps.getOne` was its only consumer.

  **This ships as `minor`.** No working consumer can exist — the method always threw — but three public names change regardless, and each one breaks a consumer that merely _compiles_ against this package: `schemaGolferHandicapResponse` and the `HandicapResponse` type are deleted off the export surface, and `handicaps.getOne`'s return type widens from `T` to `T | undefined`, so `(await client.handicaps.getOne(id)).handicap_index` no longer type-checks. That is the same fact pattern and the same bump as 0.16.0 (#67), which shipped `minor` for removing `handicaps.getPlayingHandicaps` — a method that likewise could never succeed.

  **`handicaps.getOne` now resolves to the golfer record, or `undefined` when no golfer matches** — `Promise<Golfer | undefined>` instead of `Promise<{ clubs, handicap_index }>`. `handicap_index` is still reachable, alongside the rest of the handicap surface the endpoint carries (`hi_display`, `hi_value`, `low_hi`, `low_hi_date`, `low_hi_display`, `low_hi_value`, `hard_cap`, `soft_cap`, `rev_date`, `status`):

  ```ts
  const golfer = await client.handicaps.getOne(13373258);
  console.log(golfer?.handicap_index); // null — GHIN sends "NH" for no established index
  ```

  **It only finds `Active` golfers.** `handicaps.getOne` delegates to `golfers.getOne`, which searches with `status: 'Active'` and exposes no way to opt out. A lapsed or inactive member has a real, readable Handicap Index, and this method returns `undefined` for them — silently, with no error, and indistinguishably from "no such GHIN number". Reach for `golfers.search({ golfer_id, status: 'Inactive' })` (or `'All'`) when you need one of those golfers. Widening or parameterizing this is a separate design decision and is not part of this change. Relatedly, the lookup is a golfer search under the hood, so if the golfer's row fails `schemaGolfer` the drop is reported to `onDegraded` under entity `golfers_search`, not under a handicaps entity.

  It returns the whole record rather than a narrower "handicap fields only" projection for two reasons: a projection is a hand-maintained key list against an API that adds fields without warning, and `schemaGolfer` is `.passthrough()` (#70), so narrowing here would silently discard the unmodelled keys passthrough exists to preserve. That makes `handicaps.getOne` a thin alias for `golfers.getOne`; it is kept under its own name because it is the library's documented entry point for reading a handicap, and the README quickstart is updated to match.

- cfbd1b6: Fix `handicaps.getCourseHandicaps`, which failed on every call, and `handicaps.getCoursePlayerHandicaps`, which lost a whole group to any golfer with no established index; partition both responses so one bad row no longer costs the rest; and remove `handicaps.getPlayingHandicaps`, which could never succeed.

  **`handicaps.getPlayingHandicaps` is removed, along with `schemaPlayingHandicapRequest`, `schemaPlayingHandicapEntry`, `schemaPlayingHandicapsResponse` and the `PlayingHandicapRequest`, `PlayingHandicapEntry` and `PlayingHandicapsResponse` types.** The method never functioned. It sent a single `golfer_id` to `POST /playing_handicaps.json`, which requires a `golfers` array, so every call it ever made returned `400 {"errors":{"golfers":["is required"]}}` — verified against `api-uat.ghin.com`. Its `{ playing_handicaps: [...] }` response schema described a payload that endpoint does not return; the real response is a percent → `golfer_id` → handicap record.

  `handicaps.getCoursePlayerHandicaps` is the working replacement. It posts to the same URL with the `golfers` array GHIN actually wants, and returns that percent record:

  ```ts
  await client.handicaps.getCoursePlayerHandicaps([
    { ghin: 13373246, tee_set_id: 262908, tee_set_side: "All 18" },
    { ghin: 13373247, tee_set_id: 262908, tee_set_side: "All 18" },
  ]);
  ```

  Repairing `getPlayingHandicaps` would have produced a byte-for-byte duplicate of it, so the dead method was deleted instead. Nothing can have depended on it, because it always threw.

  The rewritten `schemaCourseHandicapsGetResponse` partitions its rows with `partitionRows`, matching `courses.search`, `courses.getDetails`, and `golfers.search` (#51, #53). This is forward-looking hardening rather than a fix to an observed failure — the old schema never parsed this endpoint at all, so there was no batch to lose. A live course returns fifteen tee sets, and one malformed tee set should cost the caller that tee set rather than the other fourteen. The good rows come back in `tee_sets`, and the response carries an additive `invalid` key holding the rejected rows **raw and untransformed** — a Zod issue list tells you the shape you expected, not the shape GHIN sent.

  `handicaps.getCourseHandicaps` now calls `onDegraded` (entity `course_handicaps_get`) whenever rows are dropped, so degradation is never silent: a response that quietly returns fourteen of fifteen tee sets is otherwise indistinguishable from a course with fourteen.

  **A malformed row no longer throws.** Callers catching `ValidationError` from `handicaps.getCourseHandicaps` will find that throw no longer happens — the row lands in `invalid` and `onDegraded` fires instead, and the caller gets the tee sets that did parse.

  **Schema-object surface.** Adding the transform changes the exported `schemaCourseHandicapsGetResponse` from a `ZodObject` to a `ZodEffects`, so the `ZodObject` methods (`.shape`, `.extend()`, `.pick()`, `.merge()`, `.partial()`, `.passthrough()`) are no longer available on it. Parsing is unaffected. This is part of why the release is `minor` rather than `patch`, matching #51 and #53, which made the same shape change.

  **`handicaps.getCourseHandicaps` failed 100% of the time.** `GET /course_handicaps.json` does not return a `course_handicaps` array and has never contained a `handicap_index`. It returns `tee_sets`, each with its holes and one rating per side, and the Course Handicap nested at `tee_sets[].ratings[].course_handicap`. Every call therefore threw `ValidationError: course_handicaps Required`. The response schema is rewritten against a payload captured from `api-uat.ghin.com` and the tee sets are partitioned, so one malformed tee set costs the caller that tee set rather than the other fourteen.

  `course_handicap` is `null` for a golfer with no established index (`course_handicap_display: "NH"`), and is declared `handicap.nullable()` so the `null` survives instead of coercing to `0` — a fabricated scratch Course Handicap is a wrong number, not a missing one.

  **Breaking, on a method that could not previously succeed:** `schemaCourseHandicapEntry` and its `CourseHandicapEntry` type are removed, since they described a payload GHIN never sent. `schemaCourseHandicapTeeSet`, `schemaCourseHandicapRating`, `schemaCourseHandicapHole` and their types replace them, and `CourseHandicapsGetResponse` is now `{ tee_sets, invalid }`.

  **`tee_set_side` on `handicaps.getCourseHandicaps` must be `'All 18'`, with a space.** The request schema declared the shared `teeSetSide` enum, whose `'All18'` GHIN rejects with `{"errors":{"tee_set_side":["must be one of the following: 'All 18', 'F9', 'B9'"]}}`. It now uses `schemaTeeSetSide`, which has the space. The shared `teeSetSide` is unchanged, because score posting also uses it.

  **`handicaps.getCoursePlayerHandicaps` no longer loses a whole group to one golfer with no index.** Reproduced against `api-uat.ghin.com`: three established golfers succeed, and adding a fourth whose Handicap Index is `NH` throws `ValidationError` and returns nothing for any of the four. GHIN sends that golfer `{ "playing_handicap": null, "playing_handicap_display": "NH", "shots_off": "-" }`, and sends `shots_off` as a _string_ even for established golfers (`"1"`). Both fields were declared as `number` (`z.coerce.number()`), so `Number("-")` was `NaN` and failed the parse.

  `playing_handicap` and `shots_off` now use the shared `handicap` helper, wrapped in `.nullable()` so an explicit `null` stays `null` instead of coercing to `0`. **Their published type widens from `number` to `number | null`** — deliberate, because a fabricated `0` is a scratch handicap, which is a wrong number rather than a missing one. `playing_handicap_display` is untouched and still carries `"NH"` / `"0"` / `"+4"`.

  **`handicaps.getCoursePlayerHandicaps` now partitions per golfer, and its response carries an additive `invalid` key.** Widening `playing_handicap` and `shots_off` only covered the two values GHIN was known to send. The percentage buckets themselves were still all-or-nothing `z.record(...)`s, so the next unmodelled status string — `"N/A"`, a new suffix, anything the shared `handicap` helper rejects — for one golfer would again throw `ValidationError` and lose the whole foursome, with no `onDegraded` to report it.

  Each bucket is now parsed golfer by golfer with `partitionRows`, matching `courses.search`, `courses.getDetails` and `golfers.search` (#51, #53). The percentage buckets are indexed exactly as before (`response[100][golferId]`), and the golfers that were dropped are hoisted into one response-level `invalid`:

  ```ts
  const response = await client.handicaps.getCoursePlayerHandicaps(golfers);

  response[100]["13373246"]; // unchanged
  response.invalid; // [{ golfer_id: '13373258', row: { playing_handicap: null, shots_off: 'N/A' } }]
  ```

  Each entry names the golfer GHIN addressed the row with — the record key is the only thing identifying a reject, since nothing inside the row names the golfer — and carries `row` **raw and untransformed**, because a Zod issue list tells you the shape you expected, not the shape GHIN sent. `invalid` is deduplicated by `golfer_id`: GHIN echoes the same golfer set in all twenty buckets, so a golfer whose row is malformed is malformed twenty times over, and that is one dropped golfer.

  `handicaps.getCoursePlayerHandicaps` now calls `onDegraded` (entity `course_handicaps`) once per dropped golfer, with `total` counting the golfers in the payload rather than twenty times that. **A malformed row no longer throws:** callers catching `ValidationError` from this method will find that throw no longer happens — the golfer lands in `invalid` and the rest of the group comes back.

  The twenty percentage buckets remain **required**. Row-level leniency exists for data variance in a golfer's values, and it is safe there because the dropped row is reported; a missing bucket is the endpoint changing shape, which `GhinDegradation` has no way to report (there is no raw row to sample). Making the buckets nullish would trade a loud `ValidationError` for a silent `undefined` at every call site.

  **Schema-object surface.** As with `schemaCourseHandicapsGetResponse`, the transform changes `schemaCoursePlayerHandicapsResponse` from a `ZodObject` to a `ZodEffects`, so `.shape`, `.extend()`, `.pick()`, `.merge()`, `.partial()` and `.passthrough()` are no longer available on it; parsing is unaffected. `schemaCoursePercentPlayerHandicap` likewise now returns `{ handicaps, invalid }` rather than a bare record, and the `CoursePercentPlayerHandicap` type keeps its old meaning — `Record<golferId, CoursePlayerHandicap>` — as the type of one bucket in the response.

- b87fe4d: Declare the eleven score-row keys and eight `statistics` counters GHIN actually sends on `golfers.getScores`, captured live from `api-uat.ghin.com`.

  #64 gave the score tree `.passthrough()`, so these keys already _arrived_ — but typed `unknown`, absent from `Score`, and unreachable to a typed consumer without a cast. `src/playground/score-keys.ts` then captured what GHIN really sends: 85 score rows across all 13 UAT golfers (including `NH` golfer 13373258), 396 hole details and 26 statistics blocks. These are the keys that diff found.

  On the score row: `handicap_index`, `handicap_index_display`, `to_par_display_value`, `net_score`, `course_handicap`, `posted_on_home_course`, `scaled_up_differential`, `adjusted_scaled_up_differential`, `short_course`, `validation_message` and `validation_message_display`. On `statistics`: `birdies_or_better_total`, `bogeys_total`, `double_bogeys_total`, `pars_total`, `triple_bogeys_or_worse_total`, `one_putt_or_better_total`, `two_putt_total` and `three_putt_or_worse_total`.

  Four decisions are worth stating, because each one is a place a plausible-looking "cleanup" would produce a confidently wrong number:

  - **`course_handicap` is a `string`, and stays one.** GHIN sends `"-7"` and `"NH"`. Running it through the `handicap` helper would coerce a plus handicap `"+2"` to a positive `2`, while this library represents plus handicaps as _negative_ numbers (`playing_handicap: -4` beside `playing_handicap_display: '+4'`) — a sign-flipped Course Handicap, which is the failure mode 0.15.1 (#63) and 0.16.0 (#67) exist to prevent.
  - **`handicap_index` goes through the `handicap` helper, so the `999` no-handicap sentinel maps to `null`.** A golfer with no established index no longer hands a consumer a `999` that passes a `typeof x === 'number'` guard. `net_score` gets the same treatment: `getScores` sends `net_score: 999` on scores predating an index, and 999 is not a reachable net score. The matching display field, `handicap_index_display`, is the literal string `"NH"` on those rows and is kept verbatim — it is rendered, never parsed.
  - **`to_par_display_value` keeps its sign convention verbatim (`"+12"`), and GHIN's `"-"` empty sentinel becomes `null`** — the same convention the response envelope already applies to `average` / `highest_score` / `lowest_score`. `""` becomes `null` as well.
  - **The `*_total` counters arrive as JSON strings (`"3"`) while their `*_percent` siblings arrive as numbers.** They are coerced to numbers, matching `putts_total` and `up_and_downs_total`, which were already declared that way — but with `strictNumber`, so an explicit `null` or a blank string is rejected rather than coerced to a fabricated `0` a consumer would sum (#63). A count is arithmetic the moment someone adds or compares it.

  `challenge_available` and `country_code` are deliberately **left undeclared**. Both arrive on all 85 rows and are `null` on every one, so their real type is unknowable from this capture; `.passthrough()` still carries them, and declaring them `z.unknown()` would only add a useless `unknown` to `Score`. Same reasoning as `eligible_sides` on the course-handicap response.

  **The risk this takes on:** declaring a key means a value that violates the declaration now _fails the row_, where `.passthrough()` previously carried anything through untouched. These types are written from UAT — which is what the current consumer runs against, so it is authoritative rather than a proxy — but a PROD-only _shape_ would bite. A PROD `course_handicap: -7` sent as a number against this UAT-derived string declaration drops that score into `invalid`. The blast radius is one round, not the history: `schemaScoresResponse` partitions rows with `partitionRows` (#74), and `golfers.getScores` reports the drop through `onDegraded`.

  **Every key this change declares is `.nullish()`** — never required, and never a bare `.nullable()` — because GHIN drops keys entirely rather than nulling them (#46, #51, #55, #56, #57). That includes the three present on all 85 captured rows (`handicap_index`, `handicap_index_display`, `to_par_display_value`) and all eight `statistics` counters: "present across a UAT capture" is evidence, not a contract, and this release exists precisely because the documented contract was wrong. Declaring a key must not make the library _more_ fragile than the `.passthrough()` it replaces, and a score row is not unusable without its Handicap Index display string. Concretely, the emitted types are `handicap_index: number | null | undefined`, `handicap_index_display: string | null | undefined`, `to_par_display_value: string | null | undefined`, and each counter `number | null | undefined`.

  `handicap_index_display` also tolerates `""`, since the bare `string` helper is `.min(1)` and would have cost a whole row over an empty display string — the same treatment `validation_message` gets.

  The 27 pre-existing required fields on `statistics` (and the 13 on `hole_details`) are **unchanged** and still all-or-nothing, so a statistics block missing one of those still costs its score row. Loosening them is tracked separately. Re-run `src/playground/score-keys.ts` against PROD when access lands.

- f9ae7bf: Fix the `score_type` labels for the `T` and `C` letters, and partition the `getScores` response so one malformed round no longer costs the caller their whole score history.

  GHIN stores score types under pre-2020 letters and moved only the _display_ to the WHS names. Two letters were mislabelled because the letter was read as the name:

  - **`T` now transforms to `'COMPETITION'`** (was `'TOURNAMENT'`). `T` is the letter GHIN actually puts on the wire for a Competition score. Read raw from `/scores.json` on `api-uat.ghin.com` across all thirteen seeded staging golfers (`from_date_played=2000-01-01`, 85 scores), every row GHIN renders as `C`, `CA` or `NCA` carries `score_type: 'T'`, and no row renders as `T`. Confirmed end to end by round-tripping a live post: a score posted through `scores.postAdjusted` with `score_type: 'T'` came back as wire `score_type: 'T'`, `score_type_display_short: 'C'`, `score_type_display_full: 'CA'`. The name changed from Tournament to Competition; the storage letter did not.
  - **`C` transforms to `'COMBINED'`,** which is what it did before #65. A Combined score is two nine-hole rounds combined into one 18-hole score, and the name never changed, so `C` still means what its letter says.

  **This reverts the `C` relabel from #65, which never shipped.** #65 changed `C` from `'COMBINED'` to `'COMPETITION'` on the strength of the 2020 WHS naming alone, with no observed payload behind it. The payload contradicts it. The single wire-`C` row in the 85-score sample (golfer `13373254`) is the exact arithmetic sum of that golfer's two nine-hole rounds:

  |                      | the two nine-hole rows     | the `C` row |
  | -------------------- | -------------------------- | ----------- |
  | adjusted gross score | 48 + 46 = **94**           | **94**      |
  | course rating        | 34.6 + 35.6 = **70.2**     | **70.2**    |
  | slope rating         | mean of 132, 122 = **127** | **127**     |

  That also explains its display fields, which look wrong until you know what it is: `score_type_display_short: 'N'` and `score_type_display_full: 'N'` on an **18-hole** score. The `N` marks the score as _derived from_ nines, not as a nine-hole round. Because #65 is unreleased, consumers never saw `'COMBINED'` leave, and the net effect of this release on the `C` letter is nothing.

  **What #59 got right, and where it went wrong.** #59 pointed at the [USGA's published letter designations](https://www.usga.org/content/usga/home-page/handicapping/roh/Content/rules/Committee%20Content/USGA/LG_R4g.htm) — `A`, `C`, `E`, `H`, `N`, `P`, where `C` is Competition and there is no `T` — and argued this library's map was using historical letters. That list is correct. It just describes a different field.

  GHIN sends **two** letter sets on every score row, and they are not the same alphabet:

  |         | field                                | letters observed on UAT | source                                 |
  | ------- | ------------------------------------ | ----------------------- | -------------------------------------- |
  | storage | `score_type`                         | `A`, `C`, `H`, `T`      | GHIN's pre-2020 column, never migrated |
  | display | `score_type_display_short` / `_full` | `A`, `C`, `H`, `N`      | the WHS/USGA set #59 cites             |

  The two sets **collide on the letter `C`, where it means different things**: `C` in the display fields is Competition, exactly as #59 says, while `C` in `score_type` is Combined. That collision is the whole trap. #65 read the USGA list as a description of `score_type` and relabelled `C` accordingly, which is how a correct citation produced a wrong mapping. The letter that carries Competition in `score_type` is `T`.

  This also settles #59's third point. `N` really is a WHS designation, but it belongs to the _display_ set — it appears in `score_type_display_short` / `_full` and never in `score_type`, so it should not have been in the storage-letter enum at all. It is left accepted here rather than removed, because narrowing the input enum would also narrow the caller-facing `ScoresRequest['score_types']` and would reject the letter rather than tolerate it; the finding is recorded as a comment in `scores/score.ts`.

  `score_type_display_full` is compositional — `[N]` + `[C]` + `[A]` — so `CA` is "Competition Away" and `NCA` is "nine-hole Competition Away". That closes an open question from #59, which asked whether the swagger's `"score_type_display_full": "CA"` example meant "Combined Away". It does not; Combined is the `N` case above.

  **Consumers matching on `'TOURNAMENT'` will need to switch to `'COMPETITION'`.** The emitted `ScoreType` union is now `'AWAY' | 'COMBINED' | 'COMPETITION' | 'EXCEPTIONAL' | 'HOME' | '9_HOLE_ROUNDS' | 'PENALTY'`, so an exhaustive `switch` or a `Record<ScoreType, Label>` map stops compiling under `strict`. The worse failure is the quiet one: a runtime string comparison like `score.score_type === 'TOURNAMENT'` keeps compiling and silently stops matching, so a Competition round just stops being labelled. `'TOURNAMENT'` is the only member leaving. The reach is narrower than it looks — `scores/index.ts` does not re-export `./score`, so `ScoreType` is not a named package export; consumers reach it structurally, through `ScoresResponse['scores'][number]['score_type']`. Grep for the string literal, not for the type import.

  **`getScores` now partitions its rows, and its response carries an additive `invalid` key.** `schemaScoresResponse` wrapped scores in a plain `z.array(schemaScore)`, which made every round a single point of failure for the whole history: one unrecognised `score_type` letter — or one null differential, per #63 — rejected the entire response, so a golfer with 40 good rounds and 1 odd one saw no rounds at all. Rows are now parsed individually with `partitionRows`, matching `courses.search`, `courses.getDetails` and `golfers.search` (#51, #53). The good rounds come back in `scores`, and the rejects come back in `invalid` **raw and untransformed** — a Zod issue list tells you the shape you expected, not the shape GHIN sent. `golfers.getScores` calls `onDegraded` (entity `scores`) whenever rows are dropped, because a history that quietly comes back one round short is otherwise indistinguishable from a golfer who played one round fewer.

  **A malformed round no longer throws.** Callers catching `ValidationError` from `golfers.getScores` will find that throw no longer happens for a bad row — the round lands in `invalid`, `onDegraded` fires, and the rounds that did parse come back. The envelope is unchanged otherwise: the transform spreads the rest of the object, so the declared sibling fields and the `.passthrough()` keys added in #64 survive it.

  **Schema-object surface.** Adding the transform changes the exported `schemaScoresResponse` from a `ZodObject` to a `ZodEffects`, so the `ZodObject` methods (`.shape`, `.extend()`, `.pick()`, `.merge()`, `.partial()`, `.passthrough()`) are no longer available on it. Parsing is unaffected, and the transform carries an explicit return-type annotation so that `.passthrough()`'s `[k: string]: unknown` index signature survives into the emitted type rather than being dropped by the spread. This is part of why the release is `minor` rather than `patch`, matching #51 and #53, which made the same shape change when they added an `invalid` key.

  Score posting is untouched. `scores/post-request.ts` still declares `z.enum(['H', 'A', 'T'])` — that is the letter this library _sends_, GHIN's POST spec documents `T`, and it is a separate contract from what we parse coming back. Only the inbound labels changed.

  **On the limits of the evidence.** All of the above was read from UAT/staging, not production: thirteen seeded golfers, 85 scores, plus one live round-trip post. The distinct wire letters observed are `A`, `C`, `H` and `T`. `E` and `P` returned 0 rows under `score_types=` filtering across every golfer and are unverified in either direction — this release makes no claim that their mappings were confirmed, only that they were left alone. A control query with a bogus letter (`score_types=Z`) also returns 0 rows, so an empty filter result cannot distinguish "there are no such rows" from "that is not a letter I recognise"; absence stays weak evidence throughout. The `C` finding rests on one row, but it is a positive, arithmetic match rather than an absence, which is why it is strong enough to act on.

  `N` stays in both unions. It never appears as a wire `score_type` — `score_types=N` returns 0 rows — only as a prefix on the display fields, and it does not reliably mean nine holes (the Combined row above displays `N` on 18). Narrowing it would also narrow the caller-facing `ScoresRequest['score_types']` input, so the finding is recorded as a comment in `scores/score.ts` instead.

- b87fe4d: Export the score row model from the package root: `Score`, `ScoreType`, `ScoreStatus`, `schemaScore`, `rawScoreTypes` and `schemaRawScoreStatus`.

  `src/client/ghin/models/scores/index.ts` re-exported every file in that directory except `./score`, so the score row's own type never reached the package's export list while its nested siblings — `HoleDetail`, `Statistics`, `ScoringAdjustment` — all did. A consumer who wanted to type a single score had to reach it structurally, as `ScoresResponse['scores'][number]`, or hand-roll the type.

  Nothing is renamed or removed, and no runtime behavior changes: these six names simply did not exist on the public surface before. The `Score` type this publishes is the widened one from the score-row-keys change above, which is why the two ship together. A test now asserts all six are importable both from the scores model barrel and from the package root, so the surface cannot silently regress again.

- bff792e: Stop an explicit `null` on a required numeric field from parsing as a fabricated `0` (#63).

  `float` is `z.coerce.number()` and `Number(null) === Number('') === 0`, so a required numeric that GHIN sends as `null` came back as `0` — a value that passes a `typeof x === 'number'` guard and is indistinguishable from a real scratch handicap or a real zero differential. Two fixes:

  **The shared `handicap` helper no longer turns `null` or a blank string into `0`.** Its inner union tried `float` before `z.null()`, so the `null` branch was unreachable and `handicap.parse(null)` was `0`. It now returns `null` for `null`, `''` (including whitespace-only), `'NH'` and `'-'`. The published output type was already `number | null`; only the runtime value changes. `handicaps.getOne` held the one live bare use (`golfer.handicap_index`), where a `null` or blank index would have been reported as scratch; it is now `handicap.nullable()`, matching `course_handicap`, `playing_handicap` and `shots_off`. Where a no-index golfer is observable today — `golfers.search` against staging golfer `13373258` on `api-uat.ghin.com` — GHIN sends the string `"NH"` rather than a `null`, and the helper maps that to `null` as it did before.

  **`handicap` also maps GHIN's `999` no-handicap sentinel to `null`.** Probing UAT turned up a second value of the same class: GHIN sends the magic number `999` to mean "no handicap", seen on `hi_value` and `low_hi_value` from `golfers.search`, on `handicap_index` and `net_score` in score payloads, and on the `scores.post` response alongside `handicap_index_display: "NH"`. `golfers.search` declares `hi_value`, `low_hi_value`, `low_hi` and `handicap_index` with this helper, so **those fields previously handed consumers the number `999`** — a value that passes a `typeof x === 'number'` guard and is not a handicap. The WHS maximum Handicap Index is 54.0, so `999` cannot be a real index; it is matched exactly (numeric `999`, the string `'999'`, and a suffixed `'999M'`), and near values like `99.9` and `999.1` are untouched. The sentinel lives only in `handicap` — `999` is a perfectly good score or ID, so `float`, `number`, `strictFloat` and `strictNumber` do not know about it.

  **New `strictFloat` and `strictNumber` exports reject `null` and blank strings outright** — with the same `Expected number, received nan` issue a missing key already produces — while still coercing genuine numeric strings. They are applied at the fields a consumer computes on, where a fabricated `0` is a wrong number rather than a missing one:

  - `scores.post` response: `id`, `golfer_id`, `adjusted_gross_score`, `differential`
  - `golfers.getScores`: `course_rating`, `slope_rating`, `differential`, `unadjusted_differential`
  - `courses.getTeeSetRating`: `CourseRating`, `SlopeRating`
  - `courses.getDetails`: `CourseRating`, `SlopeRating` — one bad tee set lands in `invalidTeeSets` and fires `onDegraded`
  - `handicaps.getCourseHandicaps`: `course_rating`, `slope_rating` — one bad tee set lands in `invalid` and fires `onDegraded`

  **A parse that previously succeeded with a `0` at one of those fields now fails.** For `courses.getDetails` and `handicaps.getCourseHandicaps` that costs one row. For `scores.post`, `golfers.getScores` and `courses.getTeeSetRating` — none of which partition rows — it is a `ValidationError` for the whole call. Probed against `api-uat.ghin.com` on 2026-09-01, including a live score post: 84 scores across all 13 staging golfers — including `UnderReview` and `Temporary` scores, the plausible source of a missing differential — carry a real number at every one of these fields, as do all 59 tee sets from `courses.getDetails`, the `TeeSetRatings` records behind them, and the 15 tee sets from `handicaps.getCourseHandicaps` for both an established and a no-index golfer. A score posted through `scores.post` likewise came back with a real number at `id`, `golfer_id`, `adjusted_gross_score` and `differential`. Nothing that works today starts failing. A caller that was silently receiving `0` will now see the failure instead; `golfers.getScores` is the one to watch, since it does not partition and a single historical score with a null differential would reject the whole history.

  Still untyped: the `scores.post` response passes `handicap_index` and `net_score` through undeclared, so a consumer reading them off that payload continues to see `999`. Declaring them would add published surface and is left to its own change.

  `float` and `number` themselves are unchanged: they still coerce, and every request-side schema, ID field and `getScores` summary (`average`, `highest_score`, `lowest_score`) keeps using them. Schema-level consumers only: `z.input<>` of the affected response schemas now shows the switched fields as `unknown` (they are `ZodEffects` over `ZodNumber`); `z.infer<>` / the exported `*Response` types are unchanged.

- b87fe4d: Fix `courses.getTeeSetRatingsForScorePosting`, which failed on every call, and partition its rows so one bad tee set no longer costs the rest.

  **The endpoint failed 100% of the time.** `GET /Courses/{course_id}/TeeSetRatingsForScorePosting.json` returns a **bare array** of PascalCase rows. The shipped `schemaTeeSetRatingsForScorePostingResponse` expected `{ tee_set_ratings: [...] }` with snake_case entries (`tee_set_id`, `tee_name`, `course_rating`, `tee_set_side`), so every call threw `ValidationError: Response validation failed: Expected object, received array`. That shape came from the SwaggerHub spec, which does not describe this endpoint — the same root cause as #67 and #62. The schema is now written against a payload captured 2026-09-01 from `api-uat.ghin.com` (course 7817), preserved in `models/course/__fixtures__`.

  **The response shape changed**, because there was no working shape to preserve:

  ```ts
  const { tee_set_ratings, invalid } =
    await client.courses.getTeeSetRatingsForScorePosting({ course_id: 7817 });

  // Every tee set arrives three times — pick the side you are posting.
  const eighteen = tee_set_ratings.filter(
    (rating) => rating.RatingType === "Total"
  );
  ```

  Rows are PascalCase and carry `TeeSetRatingId`, `TeeSetRatingName`, `RatingType`, `CourseRating`, `SlopeRating`, `BogeyRating`, `DisplayName`, `Gender`, `TeeSetStatus`, `StrokeAllocation`, `TotalPar`, `IsShorter`, `EligibleSides` and `Holes`. Each entry in `Holes` is PascalCase too — `Number`, `HoleId`, `Length`, `Par` and `Allocation`, of which only `Number` is required — and the schema for one is newly exported as `schemaTeeSetRatingForScorePostingHole`, alongside `schemaTeeSetRatingForScorePostingEntry`.

  **`RatingType` is the field consumers must filter on.** GHIN sends one row per tee set _per rating side_ — `Total`, `Front` and `Back` — so course 7817 answers with 45 rows for 15 tee sets, and `TeeSetRatingId` is shared by all three rows of a tee set rather than identifying a row. A `Front` row's `CourseRating: 33.2` is a nine-hole rating that is indistinguishable from an eighteen-hole one without reading `RatingType`. There is no `tee_set_side` anywhere in the payload.

  The triplet order is not guaranteed, so filter rather than index: on course 13995, `TeeSetRatingId 586548` arrives as `[Total, Back, Front]` while the other 21 tee sets on that course arrive as `[Total, Front, Back]`.

  **`TeeSetRatingId` is the id score posting wants.** Pass it verbatim as `tee_set_id` on `scores.postAdjusted` / `scores.postHoleByHole` / `scores.post18h9and9` — the names differ but the number space does not. Verified 2026-09-01 by posting a real score with `tee_set_id: '605066'`, the `TeeSetRatingId` of Red on course 7817, which GHIN accepted and echoed back as `tee_name: 'Red'` with the matching `course_rating: 67.3`. It is also the `tee_set_id` that `/course_handicaps.json` accepts and returns; across courses 7817, 13995 and 1424 the id sets from this endpoint, `/course_handicaps.json` and `courses.getDetails` are identical.

  `RatingType`, `TeeSetStatus` and `Gender` are typed as plain strings rather than enums: an enum is right on a request, but pinning one on a response drops the whole row the day GHIN publishes a value this library has not seen. Only `TeeSetRatingId`, `TeeSetRatingName`, `RatingType`, `CourseRating` and `SlopeRating` are required; everything else is `.nullish()`, never a bare `.nullable()`, because GHIN drops keys entirely rather than nulling them (#46, #51, #55, #56, #57). Course Rating and Slope Rating use `strictFloat`, so an explicit `null` is rejected rather than coerced to a fabricated scratch rating (#63).

  The response now partitions its rows with `partitionRows`, matching `courses.search`, `courses.getDetails` and `handicaps.getCourseHandicaps` (#51, #53, #67): the good rows come back in `tee_set_ratings`, and the additive `invalid` key holds the rejected rows **raw and untransformed** — a Zod issue list tells you the shape you expected, not the shape GHIN sent. `onDegraded` fires with entity `tee_set_ratings_for_score_posting` whenever rows are dropped, so a response that quietly returns 44 of 45 rows is never mistaken for a course with 44.

  **Schema-object surface.** `schemaTeeSetRatingsForScorePostingResponse` is now a `ZodEffects` over an array rather than a `ZodObject`, so the `ZodObject` methods (`.shape`, `.extend()`, `.pick()`, `.merge()`, `.partial()`, `.passthrough()`) are no longer available on it. Parsing is unaffected. Same reason this release is `minor` rather than `patch` as #51, #53 and #67.

### Patch Changes

- 8765806: Fix user-supplied `CacheClient` being silently disconnected (#79). `schemaCacheClient` used `z.function()`, so every
  config parse rebuilt the cache as a detached clone with unbound method wrappers: pre-seeded tokens were never read,
  writes landed in the clone, and any class-based cache (state on `this`) threw a misleading
  `CacheError: Failed to read from cache: Cannot read properties of undefined`. The schema is now a
  `z.custom<CacheClient>` structural check that passes the caller's instance through by reference, and the redundant
  re-parse in `RequestClient` is gone. Note: `schemaCacheClient`'s type changes from `z.ZodObject` to
  `z.ZodType<CacheClient>` — implementing the `CacheClient` interface is unaffected, but composing the schema itself
  (`.shape`, `.extend()`) would no longer typecheck.
- dc4d9b2: Declare `estimated_handicap_display` on the score post response, and bring the rest of that response in line with the leniency policy.

  GHIN returns `estimated_handicap_display` — the pending Handicap Index® for the score just posted — on every successful `scores.postHoleByHole`, `scores.postAdjusted`, and `scores.post18h9and9`. It was never declared, so it reached consumers only through `.passthrough()`: absent from the emitted TypeScript type, untypechecked, and untested. If GHIN stopped sending it, nothing here or downstream would fail — the value would just quietly stop rendering. `onDegraded` cannot cover it either, since that path counts dropped **rows** in a list response and this is one absent scalar on a single object.

  It is now `z.union([z.string(), z.number()]).transform(String).nullish()`, emitting `string`. A string because `NH` comes back for a golfer with no established index and plus golfers are expected as `+1.2`; the union also accepts a number because the wire type is unconfirmed — observed values print unquoted (`15.4`, `16.2`) — and guessing wrong would reject an otherwise fine post. Same union-then-normalize shape as the `handicap` helper added for the `19.1M` suffix in 0.15.3.

  The rest of `schemaScorePostResponseInner` now follows the same policy as the course and golfer schemas: `id`, `golfer_id`, `status`, `adjusted_gross_score`, and `differential` stay required, and everything descriptive — `validation_message`, hole counts, the scaled-up differentials, `course_id`, `course_name`, `facility_name`, `played_at`, `tee_name`, `tee_set_id`, `course_rating`, `slope_rating`, `score_type` — is `.nullish()`, never a bare `.nullable()`, because GHIN drops keys entirely rather than nulling them (#46, #51, #55, #56, #57). The 0.15.1 carve-out that keeps Course Rating and Slope Rating required does not apply here: on this response they are echoes of the values just posted, not inputs to a Course Handicap calculation.

  **Consumers reading those fields will need null checks.** Eleven of them were plain `string` or `number` in 0.15.3 and are now `T | null | undefined` in the published types — `number_of_holes`, `number_of_played_holes`, `course_id`, `course_name`, `facility_name`, `played_at`, `tee_name`, `tee_set_id`, `course_rating`, `slope_rating`, and `score_type` — so code like `response.course_name.trim()` or `response.number_of_holes === 18` stops compiling under `strict` until it guards. The descriptive strings also normalize `""` to `null` now (GHIN's "no message" sentinel, above all on `validation_message`) rather than rejecting the whole response, so a caller that tested for `''` should test for falsy instead. Nothing about the values GHIN actually sends has changed; only what this library promises about them.

  Leniency matters more on this response than anywhere else in the library, because a parse failure here is the one you cannot walk back. The score is **already posted** at GHIN by the time the response is parsed, `schemaScorePostResponse` is a single object with no `partitionRows` salvage path, and this library exposes no score-delete method — so a rejected parse leaves the caller holding a score they can neither read back nor undo.

  Caught reading live UAT posts (`api-uat.ghin.com`, golfer 13373248), which returned `estimated_handicap_display` on all five posts while the schema said nothing about it.

- 84776ba: `golfers.getOne` now returns a multi-club golfer's home club row

  A golfer comes back from GHIN once per club affiliation. `getOne` searched with
  `per_page: 1`, so it returned whichever row GHIN sorted first — the Handicap
  Index was right either way (it is identical across a golfer's rows) but
  `club_name`, `club_id` and `is_home_club` described an arbitrary affiliation.
  Club is the field that tells two golfers with the same name apart, so this was
  wrong exactly where it mattered.

  `getOne` now delegates to `golfers.getMany`, which prefers the home club row.
  Still a single request. `handicaps.getOne` delegates to `golfers.getOne` and
  inherits the fix.

- 591a919: Add `.passthrough()` across the whole score tree so new fields on scores survive parsing.

  `schemaScore` (`scores/score.ts`) was a plain `z.object`, which strips unknown keys, so any attribute GHIN adds to a score row — the endpoint most likely to grow fields as USGA surfaces new score attributes — was silently deleted in the library before any consumer could see it, with no error to canary on. Its siblings `schemaScorePostResponseInner`, `schemaGolfer`, and the handicap-entry schemas are all already `.passthrough()`; this brings `schemaScore` in line. Because a `.passthrough()` does not reach into nested object schemas, the same treatment is applied to every level of the tree: `schemaHoleDetail`, `schemaStatistics`, `schemaScoringAdjustment`, and the `schemaScoresResponse` envelope, so a new key on a hole detail, a statistics block, an adjustment, or alongside `average`/`total_count` survives too. The `schemaScorePostResponse` envelope gets the same treatment, as it was the last plain `z.object` left in the scores module.

  Undeclared keys now reach consumers typed `unknown` via the emitted index signature (`& { [k: string]: unknown }`) — a widening, not a breaking change; no declared field changes type, and a genuinely invalid row (an explicit `null` on a required numeric, say) is still rejected. A live UAT capture (85 score rows across 13 golfers) confirms this was dropping real data today: 13 undeclared keys on the score row, including `handicap_index`, `handicap_index_display`, `course_handicap`, `net_score` and `to_par_display_value`, plus eight `*_total` counters inside `statistics`. Those now arrive as `unknown` instead of vanishing; declaring them with real Zod types is a follow-up.

## 0.15.4

### Patch Changes

- a5f84ff: Fix `courses.getTeeSetRating`, which was rejecting every valid tee, and bring the schema in line with the course-details leniency policy.

  `LegacyCRPTeeId` was `.nullable()` — which permits `null` but not a **missing** key. GHIN omits it, and `number` is `z.coerce.number()`, so an absent key became `NaN` and failed. Every call to this endpoint failed validation regardless of the tee. Fourth occurrence of that exact class, after issue #46, issue #51, and the same field on `courses.getDetails`.

  The rest of the schema now follows the same policy as `schemaCourseDetailsResponse`: only identity is required (`TeeSetRatingId`, `TeeSetRatingName`, plus holes and ratings), everything descriptive is `.nullish()`, and every object is `.passthrough()`. `CourseRating` and `SlopeRating` stay required on a rating row, for the reason given in 0.15.1 — a defaulted zero passes a `typeof x === 'number'` guard downstream and yields a confidently wrong Course Handicap.

  This endpoint matters more than its usage suggests: `TeeSetStatus` (`Active | Inactive | Deleted`) is the **only** place GHIN reports whether a tee is still current. `courses.getDetails` does not carry it.

  Verified against live GHIN: tee `921728` returns `status: active`, and a retired id returns a clean `400` naming the tee.

## 0.15.3

### Patch Changes

- 9091466: Accept a WHS status suffix on a Handicap Index value.

  GHIN returns values like `19.1M` (modified by the Handicap Committee) and `12.4WD` (withdrawn) in `handicap_index`. The schema only tolerated a bare number, `NH`, or `-`, so a suffixed value failed validation and — since rows are parsed individually — dropped that golfer out of `golfers.search` entirely. The golfer simply didn't appear in results, with no error.

  Caught in production by the `onDegraded` reporter: `GHIN golfers_search dropped 1 of 25 rows`.

  Suffixed values now parse to their numeric part (`19.1M` → `19.1`), matching what every consumer already expects from the field. `NH` / `-` still map to `null`, plain numbers are unchanged, and a string that isn't a handicap at all is still rejected.

## 0.15.2

### Patch Changes

- 1c27d88: Stop validating `Email` as an email address on courses and facilities.

  GHIN puts whatever it has in that field. Parkview Fairways (course 3363) carries `"www.parkview18.com"`, and `.email()` rejected the entire row — so a real, playable course silently vanished from search results over a field no consumer reads.

  Found in production by the `onDegraded` reporter added in 0.15.0, within hours of it shipping: `GHIN course_search dropped 1 of 100 rows`. Exactly the class of quiet data loss that reporter exists to surface.

  The webhook `url()` validations are unchanged — those check configuration we supply ourselves, not payloads GHIN sends us.

## 0.15.1

### Patch Changes

- 79b8f95: Require `CourseRating` and `SlopeRating` on a course-details rating row, and fail the tee set rather than the row when one is malformed.

  0.15.0 made both nullish along with everything else that wasn't strictly identifying. That went too far: a missing value defaults to `0` downstream, and `0` passes a `typeof x === 'number'` guard, so it reached the Course Handicap formula as a real rating and produced a confidently wrong number instead of reporting the handicap as unavailable. Fabricating a handicap is worse than losing a tee.

  Course Rating and Slope Rating aren't partial data — they _are_ the rating. `BogeyRating` stays nullish deliberately: it's absent from the Course Handicap formula, so a bogey-less tee is still perfectly playable.

  `Ratings` is now all-or-nothing within a tee set, matching `Holes`. Dropping a bad rating row on its own left the slot at zero and said nothing about it — indistinguishable from a tee GHIN rates only partially. A tee set with an unparseable rating now fails into `invalidTeeSets`, which fires `onDegraded`.

  Removes the now-unused `dropInvalidRows` export; `partitionRows` is unchanged and still exported.

## 0.15.0

### Minor Changes

- 40a24b8: Stop letting one dropped GHIN key destroy a whole response, and report it when rows are dropped.

  GHIN removes keys from payloads without warning — three outages so far (`Allocation` in #46, the search address keys in #51, `LegacyCRPTeeId` on 2026-08-19). Each was fixed field-by-field, so the next dropped key broke us again. This makes the schemas structurally tolerant instead.

  **Required now means load-bearing.** A field is required only where the caller genuinely cannot proceed without it:

  - Course: `CourseId`, `CourseName`
  - Tee set: `TeeSetRatingId`, `TeeSetRatingName`, and at least one hole
  - Hole: `Number`
  - Golfer: `ghin`, `last_name`

  Everything else is `.nullish()`, and every object is `.passthrough()` so new GHIN fields survive instead of being stripped.

  **Rows degrade individually, responses don't.** `courses.getDetails` parses tee sets one at a time — 21 usable tees beat zero — and returns the rejects as `invalidTeeSets`. `golfers.search` and `golfers.globalSearch` do the same per golfer, so one malformed row no longer empties a search. Holes are deliberately all-or-nothing within a tee set: dropping one bad hole would hand back a 17-hole tee that scores silently wrong.

  **New: `onDegraded`.** An optional `ClientConfig` callback fired whenever rows are dropped, with `{ entity, dropped, total, sample }`. Wire it to your error tracker — silent degradation is indistinguishable from a genuinely short response, which is how all three outages stayed invisible until a user complained. The callback is wrapped so a throwing reporter can't fail the request.

  Verified against live GHIN: Druid Hills (13995) parses 22 tee sets and St. Patrick's Links (31291) parses 6, both unchanged.

## 0.14.1

### Patch Changes

- 4c31618: Tolerate a missing or null `LegacyCRPTeeId` on course-details tee sets. GHIN stopped sending the key on Druid Hills (course 13995) — all 22 tee sets lost it at once. `number` is `z.coerce.number()`, so an absent key coerces to `NaN` and rejected the entire `courses.getDetails` response with a `ValidationError`, leaving callers with no tees at all.

  The field identifies nothing we consume, and `schemaTeeSetRating` already declared it nullable — the course-details schema was the inconsistent one. Same failure class as the per-hole `Allocation` key (#46) and the search address keys (#51).

## 0.14.0

### Minor Changes

- c577576: Make `courses.search` tolerant of the keys GHIN drops. GHIN has started omitting `Address1`, `Address2` and `LegacyCRPCourseId` entirely (not `null`) from search results, which made every row fail validation and rejected the whole response with a `ValidationError`.

  Two changes:

  - Every non-identifying field on `Course` — `Address1`, `Address2`, `City`, `Country`, `Email`, `EntCountryCode`, `EntStateCode`, `LegacyCRPCourseId`, `State`, `Telephone`, `UpdatedOn`, `Zip` — is now `T | null | undefined`, so a missing key no longer fails.
  - **Breaking:** `courses.search` now resolves to `{ courses, invalid }` instead of a bare `Course[]`. Rows are validated individually — valid ones come back in `courses`, rejects come back untouched in `invalid` so callers can log exactly what GHIN sent. One malformed course no longer blanks the entire search.

  Migration: `const courses = await client.courses.search(...)` becomes `const { courses, invalid } = await client.courses.search(...)`.

## 0.13.0

### Minor Changes

- ec6506b: Allow tee set holes to omit `Allocation`. GHIN drops the per-hole `Allocation` key on courses whose tee sets report `StrokeAllocation: false` — every Irish/GB&I course tested — which made `courses.getDetails` and the tee set rating schema reject otherwise-complete payloads with a `ValidationError`. `Allocation` is now `number | null | undefined` on `CourseDetailsResponse` and `TeeSetRatingResponse` holes.

## 0.12.2

### Patch Changes

- b73742e: Accept GHIN responses that omit or return an empty `first_name` on golfer search results (empty values normalize to `null`), and the `Temporary` score status on scores and score post responses. `ScoreStatus` gains a `TEMPORARY` member.

## 0.12.1

### Patch Changes

- b94cad0: Surface optional `course_id`, `course_name`, and `facility_name` on score rows

  `schemaScore` (the `getScores` row) previously stripped course identifiers the
  GHIN API returns per score. These are now passed through as optional fields so
  consumers can tell which course each score was played at — e.g. to corroborate
  player-identity matches by course overlap.

## 0.12.0

### Minor Changes

- 8015734: Fix all four `client.gpa.*` wrappers against staging UAT shapes; previously every method either rejected the real response at the Zod layer or sent a malformed request.

  **Breaking** — `requestAccess(golferId)` is now `requestAccess(golferId, { email })`. USGA requires an `email` body parameter and rejects with `400 { errors: { email: ["can't be blank"] } }` without it.

  **`getAccesses()`** now hits `/users/accesses.json` correctly: the endpoint is USGA's "UserAccesses" and returns `{ federations, associations, clubs, golfers, super_user, subtype }`. The wrapper flattens the `golfers` branch (the only one carrying GPA state) into a clean `Array<{ golferId, userAccessId, golferName, gpaStatus }>` so callers don't have to deal with the unrelated outer fields. IDs arrive as numeric strings on the wire and are coerced to `number`. Observed `gpaStatus` values: `pending` | `approved` | `inactive` (and presumably `denied`).

  **`requestAccess()`**, **`updateStatus()`**, and **`revokeAccess()`** all now expect and return the success-envelope response shape `{ success: string }` (a localized confirmation message). Previous schemas expected `{ golfer_id, status }` / `{ golfer_id }` and would have thrown at parse time against any real call.

  **`updateStatus()`** — `user_id` is the credentialed admin user's `user.id` from `POST /users/login.json` (not the golfer's user, not `userAccessId`). Documented inline on the method.

  Side fact: `revokeAccess()` marks the underlying `user_access` record `inactive` rather than deleting it; re-firing `requestAccess()` against the same golfer reuses that record and flips status back to `pending`.

## 0.11.1

### Patch Changes

- 960b405: Fix webhook settings GET to accept `null` leaves. GHIN returns every event key on every top-level field with `null` as the "unregistered" sentinel rather than omitting the key, which previously caused `schemaWebhookSettings` parsing to fail and `ensureRegistered` to misreport state. The response schema now allows `string | null | undefined` per leaf while PATCH bodies retain the stricter "optional, no null" shape (use `''` to clear a URL).

## 0.11.0

### Minor Changes

- 2ab3a9f: Add webhook support. New `client.webhooks` namespace covers settings CRUD (`get` / `patch` / `delete` / `test`), delivery listing and replay (`list` / `resend`), and higher-level helpers (`ensureRegistered` for idempotent registration, `iterateUndelivered` async generator for missed-delivery recovery workers). Inbound-side helpers `parseWebhookEnvelope`, `signWebhookPayload`, and `verifyWebhookSignature` (HMAC-SHA256, constant-time compare, accepts `string | Buffer | Uint8Array`) are exported from the package root. Envelope `object_type` covers the 6 settings event types plus `'crs'` for Course Rating System deliveries. The signature header name and digest scheme are unconfirmed by USGA; defaults are `X-GHIN-Signature` / `sha256=<hex>` and are exported as constants so a confirmed-different scheme is a one-line change. Additionally, `RequestClient` now emits `%20` instead of `+` for spaces in query strings so endpoints whose backend uses URI-style query parsing (e.g. JAX-RS) decode them correctly.

## 0.10.0

### Minor Changes

- f78af68: Auto re-login on 401/403 responses. Per USGA Data Services §4.2.1, USGA tokens expire after 12 hours regardless of the JWT `exp` claim, so long-running services that hold a `GhinClient` past the session ceiling were failing with `AuthenticationError` until the process restarted. The request client now performs a single-shot re-login + retry on 401/403 (kept outside the exponential-backoff loop to avoid login storms when credentials are actually wrong). Concurrent in-flight requests that all hit 401 share one re-login.

### Patch Changes

- a8712d6: Fix `golfers.getOne` to use the GPA-whitelisted `/golfers/search.json` endpoint instead of `/golfers.json`, which is not allowed for Golfer Product Access credentials and returns 404 AccessDenied in sandbox, UAT, and production.

  Also fix `golfers.search` to include the required `source` query param, and fix `golfers.globalSearch` to pass through all validated request params (previously only `ghin` was sent and other fields like `last_name`, `country`, `status`, `from_ghin`, etc. were silently dropped).

## 0.9.1

### Patch Changes

- 073f2b7: Align GPA and score response schemas with sandbox API
- 5a6c9d5: Fix release workflow to push tags before creating GitHub release

## 0.9.0

### Minor Changes

- 4dc61e3: Add GPA consent, score posting, and handicap calculation endpoints

## 0.8.8

### Patch Changes

- a9f0aab: add `status` field to TeeSetRating model

## 0.8.7

### Patch Changes

- 399c057: chore: 🧹 housekeeping
- 7623160: add TeeSetRatings fetching

## 0.8.6

### Patch Changes

- 6af8d15: fix: 🐛 update tee set request params

## 0.8.5

### Patch Changes

- eb5d1b9: fix: 🐛 course season schema

## 0.8.4

### Patch Changes

- 9b2c679: fix: 🐛 handle geoAddress schema

## 0.8.3

### Patch Changes

- 8df183c: fix: 🐛 Allow courses search with name only

## 0.8.2

### Patch Changes

- 4ef113d: fix: 🐛 handle missing geo fields

## 0.8.1

### Patch Changes

- a000ba8: feat: ✨ Add `facilities` search

## 0.8.0

### Minor Changes

- 1af15bb: feat: ✨ Add approved API access functionality
  publish as `@spicygolf/ghin`

## 0.7.0

### Minor Changes

- 9729d83: ✨ Improve internal code and add full test coverage

## 0.6.0

### Minor Changes

- 13b9e58: feat: ✨ Enhance GHIN client with course-related functionalities

  - Added methods to GhinClient for fetching course countries, details, and searching courses.
  - Introduced new models for course countries, courses, geolocation, and request/response schemas.
  - Updated existing golfer search and handicap response models for consistency.
  - Refactored score models to include new score types and statuses with transformations.
  - Improved validation models for date handling and added short date format.

## 0.5.3

### Patch Changes

- b7af36a: fix: 🐛 Allow parsing handicap value as a float

## 0.5.2

### Patch Changes

- cd83df6: fix: 🐛 Allow parsing of `NH` as a handicap value

## 0.5.1

### Patch Changes

- 6be6085: chore: 💚 Remove requirement for pnpm outside of the library

## 0.5.0

### Minor Changes

- 8d8b27b: chore: 🧹 Make unnecessarily public methods private

## 0.4.2

### Patch Changes

- b2ee106: ⬆️ Update all dependency versions

## 0.4.1

### Patch Changes

- fca6032: fix: 🐛 Properly check cached access token's expiration

## 0.4.0

### Minor Changes

- 4843dd5: feat: ✨ Add `cache client` to `GhinClientConfig`

## 0.3.0

### Minor Changes

- 7012722: feat: ✨ Initial alpha release
