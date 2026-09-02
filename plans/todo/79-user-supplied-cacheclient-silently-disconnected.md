# #79 — User-supplied CacheClient is silently disconnected

`schemaClientConfig.parse()` clones a user-supplied `CacheClient` through `z.function()`, which rebuilds the object
and wraps each method in an unbound validating proxy. The caller's instance never reaches the client: pre-seeded
tokens are never read, writes land in a discarded clone, and any class-based cache (state on `this`) throws a
misleading `CacheError: Failed to read from cache: Cannot read properties of undefined`. The `CacheClient`
extension point is non-functional in published `0.15.4`.

Recon correction to the issue: the issue's "delete the re-parse at `request-client/index.ts:116`" fix is
insufficient on its own — the **first** `safeParse` already detaches the cache, and `ghin/index.ts:167` is a third
detach site. The only working fix is making `schemaCacheClient` pass the reference through with `z.custom`.

## Live tracker

- [x] Phase 1 — schema fix: `z.custom<CacheClient>` in `src/models/cache-client.ts`, explicit `CacheClient` type, drop dead helper schemas, rewrite/add tests in `cache-client.test.ts` (identity: `parse(x) === x` for plain object and class instance) and `client-config.test.ts`
- [x] Phase 2 — request-client: drop the redundant re-parse at `index.ts:116` (`this.config = results.data`), delete the lying test at `index.test.ts:104` (`'should use cached token if valid'`), update the stale `makeCache` comment, add class-based stateful-cache tests (identity, cross-instance reuse, pre-seeded read)
- [ ] Phase 3 — GhinClient hop: test in `src/client/ghin/index.test.ts` that a class-based cache passed to `new GhinClient(...)` reaches `RequestClient` by reference
- [ ] Phase 4 — changeset (`patch`) + full gate

## Decisions

(none — no structural questions were put to the user)

## Assumptions

- **CacheClient type declaration**: explicit `export type CacheClient = { read: ...; write: ... }` above the schema,
  then `z.custom<CacheClient>(...)` — mirrors the shipped `onDegraded` pattern at `client-config.ts:17`. Not
  breaking for implementers; `schemaCacheClient` goes `ZodObject` → `ZodType`, noted in the changeset.
- **Identity assertion on private `config`**: tests cast `(client as unknown as { config: ClientConfig })` (house
  style in that test file) plus behavioural stateful-cache tests. `config` stays `private` — publishing it would
  expose credentials.
- **Version bump**: `patch` — repairs a documented extension point to do what it always claimed; precedent
  `score-passthrough.md`.

## Verification

- Probes A–F from recon (all read-only UAT): stateful file-cache end-to-end with fetch counting, closure-cache
  non-regression, invalid-cache construction throw with `['cache']` path, `score-keys.ts` drift check, second
  read surface, `main`-worktree baseline capture of the real `CacheError` message.
- Manual verification: none.
