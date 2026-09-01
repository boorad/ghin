# #42 — Migrate `GhinClient` public API to neverthrow `Result`

## Problem

Every public method on `GhinClient` (`src/client/ghin/index.ts`) returns `Promise<T>`
and throws on error. The underlying `RequestClient` already returns `Result<T, E>`;
`GhinClient` unwraps it (throwing on `isErr()`) before handing values back, discarding
the typed-error guarantee at the public boundary — which contradicts `CLAUDE.md`'s
stated convention.

Migrating one surface at a time would leave a mixed API where some methods throw and
some return `Result` — strictly worse than the current uniform-but-wrong state. So all
surfaces change, in one release.

**Scope correction to the issue text:** `handicaps` has 3 methods, not 4
(`getPlayingHandicaps` was removed in #67). `webhooks` has 8 surfaces, not 7 — the issue
omits `iterateUndelivered`. Actual count: 27 `Promise` methods + 1 async generator.

## Live tracker

- [x] Phase 1 — Foundation + `courses` + `facilities` (6 methods)
- [ ] Phase 2 — `golfers` + `handicaps` + `scores` (10 methods)
- [ ] Phase 3 — `gpa` + `webhooks` (11 methods + `iterateUndelivered`)
- [ ] Phase 4 — README + changeset

## Decisions (answered by the user, 2026-09-01)

1. **`webhooks.iterateUndelivered` yields `Result` per envelope** —
   `AsyncGenerator<Result<WebhookEnvelope, GhinError>, void, void>`. The only option
   that makes the whole class uniform, and it lets a recovery worker skip one bad
   envelope instead of aborting the scan. Rewrites the 7 existing generator tests.
2. **`E` is `GhinError`** — narrow `RequestClient.fetch`/`fetchCustomPath` and
   `withRetry` from `Result<T, Error>` to `Result<T, GhinError>`. Two real changes
   outside `ghin/index.ts`: `request-client/index.ts:326`
   (`new Error('Login response did not contain a token.')` → `AuthenticationError`) and
   `utils/retry.ts:74` (`new Error('Retry exhausted')` → `NetworkError`, unreachable in
   practice). Every other `err()` in those files already builds a `GhinError` subclass.
3. **Bump is `minor` → 0.17.0**, not the `major` the issue asks for. Matches this repo's
   own precedent for a breaking `0.x` public-surface change, stated in
   `.changeset/handicaps-get-one-golfers-search.md` and in #67.
4. **The constructor stays throwing.** `new GhinClient(config)` keeps throwing
   `ConfigurationError`; `RequestClient`'s constructor throws for the same reason. Config
   errors are boot-time programmer errors, not runtime API failures. Documented as an
   explicit carve-out in the changeset and in a test comment.

## Assumptions

_(anything decided without asking, recorded as it comes up)_

- **Phase 1:** the `throw error instanceof Error ? error : new Error(String(error))`
  fallback became a shared `toGhinError(error)` helper in `src/errors/index.ts` (a
  `GhinError` passes through untouched, anything else becomes a `NetworkError` carrying
  the original message). It lives in `errors` rather than `utils` because
  `utils/retry.ts` needs it too — `withRetryAsync`'s catch had the same wrap — and
  `src/index.ts` already re-exports `./errors`, so it is now public. The remaining
  phases should reuse it instead of hand-rolling the catch.
- **Phase 1:** narrowing `fetch`/`fetchCustomPath` to `GhinError` required narrowing the
  whole private chain behind them (`_fetch`, `refreshSessionToken`, `getAccessToken`,
  `persistRefreshedToken`, `forceRefreshAccessToken`, `apiLogin`, `refreshAccessToken`,
  `authedRequest`); every `err()` in them already built a `GhinError` subclass, so only
  the two spots Decision 2 names changed behaviour.

## Files

### Core
- `src/client/ghin/index.ts` — add `neverthrow` import; all 8 public surface type
  literals (`:96-145`); all 27 method bodies. Non-mechanical spots:
  - `handicapsGetOne` (`:574`) delegates to `golfersGetOne` — becomes a pass-through.
  - `golfersGetOne` (`:780`) calls `golfersSearch` and indexes `[0]` — thread the Result.
  - `webhooksEnsureRegistered` (`:1103`) chains `webhooksGet` + `webhooksPatch` — the one
    method needing real control-flow rewriting.
  - `webhooksIterateUndelivered` (`:1146`) — per Decision 1.
- `src/client/request-client/index.ts:326,426-454` — narrow to `GhinError` (Decision 2).
- `src/utils/retry.ts:41-77` — narrow to `GhinError` (Decision 2).

### Tests
- `src/client/ghin/index.test.ts` — 121 `it()` blocks, 60 `.rejects.toThrow(...)`
  assertions. Mock setup at `:14-23` already returns `ok()`/`err()`; no change there.

### Consumers — inside the `tsc` program, so these block the pre-commit hook
`tsconfig.json` declares no `include`/`exclude`, so `bun run lint` type-checks `docs/`
and `src/playground/` too. Each phase updates the call sites for the surfaces it migrates.
- `src/playground/ghin.ts:19`, `gpa.ts:25`, `gpa-consent.ts:27`, `score-posting.ts:27`,
  `webhook-flow.ts:33,37,45,49,55`, `score-keys.ts:143-164`
- `src/playground/wire-score-types.ts:42` — **no change**, calls `RequestClient.fetch`
  directly
- `docs/llm-output/test-course-details.ts:17`, `docs/llm-output/test-facilities.ts:29,47,66,84`

### Docs / release
- `README.md:56-75` — the one usage example
- `.changeset/*.md` — new, `minor`, at the depth of
  `.changeset/handicaps-get-one-golfers-search.md`

## Pattern to mirror

`src/webhooks/parse-envelope.ts:20-31` — the only already-shipped public function
returning a `Result`. `safeParse` rather than `parse`-in-a-`try`; the error is a specific
`GhinError` subclass, not `Error`. Also `request-client/index.ts:221,322-327` for
`.map()`/`.andThen()` over `isErr()`-and-unwrap, and `utils/retry.ts:41-77` for threading
a `Result` without ever unwrapping to a throw.

## Gotchas (verbatim to each implementation agent)

From `CLAUDE.md`:
> **neverthrow Result types** for error handling — functions return `Result<T, E>` instead of throwing
> - **Biome** handles formatting and linting (not ESLint/Prettier)
> - Single quotes, no semicolons, 2-space indent, 120 char line width, LF endings
> - Import organization is enforced by Biome
> - Run `bun run format` to auto-fix
> The pre-commit hook runs `./scripts/code-quality.sh` which checks: biome (format + lint), lint + tsc, and build.
> Conventional commit messages: `type: short description`

Repo conventions that bite here:
1. **Do not touch any Zod schema.** This is purely a wrapping change. If a migrated
   method starts rejecting a payload it previously accepted, the refactor is wrong.
   Everything descriptive is `.nullish()` — "never a bare `.nullable()`, because GHIN
   drops keys entirely rather than nulling them (#46, #51, #55, #56, #57)".
2. **`parse` → `safeParse`, message strings byte-identical.** Every
   `catch (error) { if (error instanceof z.ZodError) throw new ValidationError(...) }`
   becomes `err(new ValidationError(<the same string>))`. Watch the bare parses at
   `:459`, `:523`, `:584-586`, `:782`, `:802`, `:1012` — easy to miss, no `schema*` identifier.
3. **`reportDegradation` stays outside the `Result` and stays non-throwing.** "Never
   throws: a broken reporting callback must not turn a working GHIN response into a
   failed one. Reporting is strictly a side channel." Call it on the `ok` path only. The
   `invalid` array and `total` arithmetic at `:263-268, :336-341, :375-380, :622,
   :656-661, :709-714, :764-769, :843-848` must survive unchanged.
4. **`partitionRows` degradation is not an error.** A response with dropped rows is `Ok`,
   with the survivors and the `invalid` array. Never convert a non-empty `invalid` into `err`.
5. **Preserve the error *instance*, don't rewrap.** `return err(result.error)`, not
   `err(new GhinError(result.error.message))`. `statusCode`, `retryAfter`, `field`,
   `response`, `cause`, `code` are the whole point of the typed surface.
6. **`tsc` covers `docs/` and `src/playground/`.** Leaving them un-migrated blocks the
   commit, not just the PR.
7. **`noUncheckedIndexedAccess: true`, `strict: true`.** `results[0]` is already
   `T | undefined`; don't add a non-null assertion while restructuring `golfersGetOne`.
8. **The wall-of-comment blocks are load-bearing.** `:426-430, :453-456, :486-489,
   :518-520, :550-573, :578-579, :1099-1102, :1142-1145, :1191-1201` document USGA
   quirks and 404 archaeology. None of it is about error handling — carry every comment
   across verbatim.
9. **Preserve the non-`Error` throw wrap.**
   `throw error instanceof Error ? error : new Error(String(error))` becomes a `return
   err(...)`, and under Decision 2 the fallback must construct a `GhinError` subclass.
   10 tests assert those messages.
10. **Run `bun run format` before committing** — Biome re-sorts the `neverthrow` import.

## Tests

New cases needed beyond the mechanical conversion:
1. **Nothing rejects.** At least one method per surface: assert the promise *resolves* on
   a failing fetch, alongside the `isErr()` check. An `isErr()` assertion alone still
   passes if a throw is reintroduced elsewhere.
2. **Error identity survives the wrap** — `expect(result._unsafeUnwrapErr()).toBe(theInstancePassedToTheMock)`.
3. **`ensureRegistered` short-circuits on an inner error** — result is `err` *and* the
   PATCH was never attempted.
4. **`golfers.getOne` / `handicaps.getOne` "not found" is `Ok(undefined)`, not `Err`.**
5. **`onDegraded` still fires on the ok path**, and a throwing reporter can't turn `Ok`
   into `Err`.
6. **Non-`Error` throw wrapping** — the 10 existing cases assert `err` with the message.
7. **Constructor still throws** — unchanged, with a comment so it isn't "fixed" later.
8. Keep the nine `@ts-expect-error - testing invalid input` directives valid.

## Manual verification (carried to the user; blocks the PR)

1. **Downstream consumer behaviour is silent.** A consumer that only passes a value
   through — logs it, stores it, spreads it — gets a `Result` where a payload used to be,
   with no throw and no compile error. Grep the primary consumer (`spicygolf`, spicy#419)
   for `ghin.` call sites; a `Result` serialized into a DB row is not recoverable.
2. **One live smoke run per surface against `api-uat.ghin.com`.** Run `gpa-consent.ts`,
   `score-posting.ts`, `webhook-flow.ts`, `score-keys.ts` (the drift detector) with the
   `.env` credentials. Confirm values still arrive, `onDegraded` fires with the same
   counts, and no `Result` reaches a `console.dir` unwrapped.
3. **Auth-token refresh across the new boundary.** The 401 force-refresh-and-retry
   (`request-client/index.ts:406-423`) must surface a refresh failure as
   `err(AuthenticationError)` with `statusCode` intact and no second login attempt. The
   mutex login-storm guard is only exercised under real concurrency.
