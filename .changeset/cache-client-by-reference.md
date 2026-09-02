---
'@spicygolf/ghin': patch
---

Fix user-supplied `CacheClient` being silently disconnected (#79). `schemaCacheClient` used `z.function()`, so every
config parse rebuilt the cache as a detached clone with unbound method wrappers: pre-seeded tokens were never read,
writes landed in the clone, and any class-based cache (state on `this`) threw a misleading
`CacheError: Failed to read from cache: Cannot read properties of undefined`. The schema is now a
`z.custom<CacheClient>` structural check that passes the caller's instance through by reference, and the redundant
re-parse in `RequestClient` is gone. Note: `schemaCacheClient`'s type changes from `z.ZodObject` to
`z.ZodType<CacheClient>` — implementing the `CacheClient` interface is unaffected, but composing the schema itself
(`.shape`, `.extend()`) would no longer typecheck.
