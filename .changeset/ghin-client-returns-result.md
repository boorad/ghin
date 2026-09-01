---
'@spicygolf/ghin': minor
---

Return `Result<T, GhinError>` from every `GhinClient` method instead of throwing (#42).

All 27 public methods across `courses`, `facilities`, `golfers`, `gpa`, `handicaps`, `scores` and `webhooks` change from `Promise<T>` to `Promise<Result<T, GhinError>>`, and `webhooks.iterateUndelivered` changes from `AsyncGenerator<WebhookEnvelope>` to `AsyncGenerator<Result<WebhookEnvelope, GhinError>>`. `RequestClient` has always returned `Result`; `GhinClient` unwrapped it and rethrew, discarding the typed-error guarantee at exactly the boundary that `CLAUDE.md` says should carry it. This is that discard removed.

Migrating one surface at a time would leave an API where some methods throw and some return `Result` — strictly worse than uniformly-wrong — so every surface moves in this one release.

**The dangerous case is silent. `catch` blocks stop catching, and pass-through code keeps compiling.** These methods no longer reject, so a consumer's

```ts
try {
  const scores = await ghin.golfers.getScores(ghinNumber)
} catch (error) {
  reportToSentry(error) // never runs again
}
```

still compiles and still runs — the `catch` is simply dead. Worse, code that only *moves the value along* — logs it, stores it, spreads it, returns it from an API handler — now handles a `Result` object where a payload used to be, **with no throw and no compile error at that boundary**:

```ts
const golfer = await ghin.handicaps.getOne(ghinNumber)

await db.golfers.insert({ ghinNumber, ...golfer }) // writes a Result, not a golfer
logger.info({ golfer })                            // logs a Result
```

A `Result` serialized into a database row is not recoverable after the fact — the payload is inside `.value` and nothing downstream will tell you it went missing. Before upgrading, grep every `ghin.` call site and confirm each one either unwraps or is caught by the compiler. If you consume this package from JavaScript, or through `any`, the compiler will not help you at all and this grep is the only check you get.

**Every direct `await client.x.y()` use site stops compiling under `strict`.** That is the good case, and it is most of them: `golfer.handicap_index`, `response.scores.map(...)`, `settings.url` and friends are all errors on a `Result` now, so `tsc` walks you to each one.

Migration is mechanical — guard, then use `.value`:

```ts
// before
const golfer = await ghin.handicaps.getOne(ghinNumber)
console.log(golfer?.handicap_index)

// after
const result = await ghin.handicaps.getOne(ghinNumber)

if (result.isErr()) {
  console.error(result.error.code, result.error.message)
  return
}

console.log(result.value?.handicap_index)
```

`neverthrow` is already a runtime dependency of this package, so there is nothing to install; import `Result` from `neverthrow` directly if you need to name the type. In tests, `_unsafeUnwrap()` / `_unsafeUnwrapErr()` are the quick port, but `isErr()` is what belongs in application code.

**`E` is `GhinError`, not `Error`.** The error channel is typed to the library's own hierarchy, so `error.code`, `error.statusCode` and `error.cause` are reachable without an `instanceof` narrowing or a cast (`retryAfter` and `field` still need narrowing to `RateLimitError` / `ValidationError`, which now actually works, because the declared type is in the hierarchy). Making that honest required narrowing the layer beneath: `RequestClient.fetch` and `RequestClient.fetchCustomPath`, and `withRetry`/`withRetryAsync` in `src/utils/retry.ts`, all move from `Result<T, Error>` to `Result<T, GhinError>` — a public-surface change for anyone calling `RequestClient` directly (it widens what you can read off `error`, but changes the declared type). Only two error values actually changed class to make that true: the missing-token login failure became `AuthenticationError` (it was a bare `Error`), and `withRetry`'s "Retry exhausted" fallback became `NetworkError` (unreachable in practice — the loop always carries the last real error out).

**The constructor still throws, deliberately.** `new GhinClient(config)` continues to raise `ConfigurationError` on an invalid config rather than returning a `Result`. This is an explicit carve-out, not an oversight: a bad config is a boot-time programmer error, not a runtime API failure, and there is no useful recovery for it at the call site. `RequestClient`'s constructor throws for the same reason. The library's rule is "no method rejects"; construction is not a method.

**`webhooks.iterateUndelivered` yields a `Result` per envelope and never throws or rejects.** A failure — invalid request, a failed page fetch, or the page cap — arrives as a yielded `err`, so a recovery worker can decide for itself whether to keep going instead of losing the scan to an exception:

```ts
for await (const result of ghin.webhooks.iterateUndelivered({ from_date })) {
  if (result.isErr()) {
    logger.warn({ error: result.error }, 'skipping')
    continue
  }

  await handle(result.value)
}
```

Two behavioural notes on the generator. First, **envelopes read before a mid-scan failure are now delivered.** The old code threw on a failed page fetch, discarding every envelope it had already read; the generator now yields them all, then yields the `err`, then returns — so a missed-delivery recovery worker drains what it got instead of starting over. All three failure modes are still terminal (there is nothing further to page through), but the per-envelope `Result` shape leaves room for skip-and-continue recovery later without a second breaking change. Second, the page-cap failure is now a `ValidationError` rather than a bare `Error` — the cap only trips when the caller's filters are too broad, which is the same "your request was bad" class as the other input failures.

**A not-found golfer is `ok(undefined)`, not `err`.** `golfers.getOne` and `handicaps.getOne` resolve `ok(undefined)` when the search matches nothing — "no such active golfer" is a normal GHIN answer, not a failure. This is the one spot where a reader would reasonably expect an `Err`, so: `isErr()` stays `false` and the `undefined` is in `result.value`. Both surfaces assert it explicitly in tests.

**New public export: `toGhinError(error: unknown): GhinError`** from `src/errors`. It narrows an unknown thrown value to the `GhinError` every `Result` surface promises — a `GhinError` passes through untouched so `statusCode`, `retryAfter`, `field` and `cause` survive, and anything else becomes a `NetworkError` carrying the original message verbatim. It backs the client's own `catch` arms and is exported because consumers bridging throwing third-party code into this package's error type need the same thing.

Unchanged, and worth stating because the migration touched the surrounding code: no Zod schema moved. Nothing that parsed before is rejected now, and every error message string is byte-identical to the one the old `throw` carried, so message-matching assertions still pass. `onDegraded` still fires only on the success path, still outside the `Result`, and still cannot turn an `Ok` into an `Err` — a response with rows dropped into the `invalid` array remains `Ok` with the survivors.

**This ships as `minor`, not `major`.** It is unambiguously breaking, and on a `1.x` package it would be a major. On `0.x` this repo has consistently shipped breaking public-surface changes as `minor` — #67 removes `handicaps.getPlayingHandicaps` outright along with six exported names, and #68 repoints `handicaps.getOne`, deleting three more exported names and widening a return type; both are `minor`, and both ride in this same release. Under semver, `0.y` bumps carry no compatibility promise regardless; making this one `major` would signal a stability commitment for `1.0.0` that the API surface has not earned yet. The bump is `minor` for consistency with that precedent, and the breakage is documented here in full rather than encoded in the version number.
