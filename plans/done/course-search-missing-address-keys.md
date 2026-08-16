# Handoff — `courses.search` rejects whole payload on missing address keys

**Date:** 2026-08-16
**Repo:** `~/dev/ghin` (boorad/ghin) — branch `main`, clean, **1 commit behind
`origin/main`** (`eeabe42 chore: release v0.13.0`). `git pull` first.
**Published:** 0.13.0 is live on npm. Local `package.json` still says 0.12.2.
**Consumer:** `spicy` — `packages/api/package.json` pins `@spicygolf/ghin` at
`0.12.1`. Issue spicygolf/spicy#977 ("bump `ghin` to 0.13.0") is open and asks
whether the bump fixes this. **It does not** — see below.
**Issue:** none filed in boorad/ghin yet. File one, mirroring #46.

---

### The bug

`GET /v4/ghin/courses/search` 500s in the Spicy API. Every row of the GHIN
response fails validation (from `/tmp/spicy-api.log`, 2026-08-16):

```
courses[N].Address1           → invalid_type: expected string, received undefined  ("Required")
courses[N].Address2           → invalid_type: expected string, received undefined  ("Required")
courses[N].LegacyCRPCourseId  → invalid_type: expected number, received nan
```

Thrown from `_fetch` → `withRetry` → `authedRequest`. Six results in the first
observed search, all six invalid → whole array rejected → 500 → course search is
dead in the web "add game to a series" flow.

**Root cause** — `src/client/ghin/models/course/course.ts`:

```ts
Address1: string.nullable(),          // line 8
Address2: string.nullable(),          // line 9
LegacyCRPCourseId: number.nullable(), // line 24
```

`.nullable()` accepts an explicit `null` but **not a missing key**. GHIN has
started omitting these three keys entirely on search results. `number` is
`float.int()` (coercing), so an absent value coerces to `NaN` rather than
failing as "undefined" — which is why that one reads `received nan`.

This is the **third** instance of the same class of bug in this package:
`golfers.search` (empty optional field kills the batch) and `courses.getDetails`
(`Allocation` missing on `StrokeAllocation: false` courses, #46 / PR #50, shipped
in 0.13.0). Pattern: `null` coerces and passes; a **missing key** kills the whole
response.

---

### Why 0.13.0 does not fix it

Diff of the published 0.12.1 and 0.13.0 dists — only three schema changes:

| Change | Schema |
|---|---|
| `Allocation: number` → `number.nullish()` | `schemaCourseDetailsTeeSetHole` |
| `Allocation: number` → `number.nullish()` | tee-set-rating hole |
| `first_name: string` → `emptyStringToNull.optional()` | golfer |

`schemaCourse` (line 782 of the dist, used by `schemaCourseSearchResponse`) is
byte-identical in both versions. So bumping Spicy to 0.13.0 leaves the course
search 500 fully intact.

---

### The fix

**1. Field-level (required).** `src/client/ghin/models/course/course.ts`:

```ts
Address1: string.nullish(),
Address2: string.nullish(),
LegacyCRPCourseId: number.nullish(),
```

Follow the #46 precedent exactly: add a short comment above each naming *why*
(GHIN omits the key on search results), the way `ec6506b` did for `Allocation`.

Consider auditing the rest of `schemaCourse` in the same pass — `City`,
`Country`, `State`, `Telephone`, `Email`, `EntCountryCode`, `EntStateCode`,
`UpdatedOn` are all `.nullable()` and would fail identically the day GHIN drops
one of them. Non-identifying, non-load-bearing fields on a search *result* have
no business being required.

**2. Array-level (recommended, ask Brad first).**
`src/client/ghin/models/course/response.ts:17`:

```ts
const schemaCourseSearchResponse = z.object({
  courses: z.array(schemaCourse.passthrough()),
})
```

One malformed course blanks the entire search. Dropping invalid rows instead
(e.g. `z.array(schemaCourse.passthrough().catch(...))` filtered, or a
`preprocess` that filters) would make search resilient to the *next* field GHIN
drops, rather than fixing this one field and waiting for round four. This is a
behaviour change (silent partial results) — get Brad's call before building it.
The field-level fix ships regardless.

**3. Tests.** `src/client/ghin/models/course/course.test.ts` and
`response.test.ts` already exist; `ec6506b` added 51 lines to `response.test.ts`
and 28 to `tee-set-rating.test.ts` for the same shape of fix — mirror it. The
one that matters: a course object with `Address1`/`Address2`/`LegacyCRPCourseId`
**absent** (not null) parses, and the surrounding `courses` array survives.

**4. Changeset.** `bun run changeset` → **patch** (0.13.1). `.changeset/*.md`,
prose style per `tidy-pugs-shake.md`: what GHIN does, which call it broke, what
the field type is now.

**5. Gates.** `bun run lint` (biome + tsc) and `bun run test:run` before commit.

---

### Then, in `~/dev/spicy`

Once 0.13.1 publishes (CI release workflow runs on merge to `main`):

- [ ] `packages/api/package.json` — `"@spicygolf/ghin": "0.13.1"` (pin, no `^`).
- [ ] `bun install`, restart the API, re-run a course search from the web
      "add game to a series" flow, confirm `/tmp/spicy-api.log` is clean.
- [ ] Close spicygolf/spicy#977 with a note that 0.13.0 alone was insufficient
      and 0.13.1 carries the actual fix.

**API-vs-app note:** `api` and `web` ship on merge, so this fix is live the
moment it deploys — no App Store dependency. The mobile app hits the same
endpoint through the API, so it benefits without a release.

---

### Verify before you start

The observed failure is from the *live* GHIN API, so confirm the current shape
rather than trusting the log:

```bash
cd ~/dev/ghin && bun run dev     # src/playground/ghin.ts — needs GHIN creds
```

Search a course that appeared in the failing batch and dump the raw JSON before
validation. If GHIN has started returning `Address1` again, the fix is still
correct (tolerating absence costs nothing) but the urgency drops.

---

### Key files, in order

1. `src/client/ghin/models/course/course.ts` — the three fields
2. `src/client/ghin/models/course/response.ts:17` — `schemaCourseSearchResponse`
3. `src/client/ghin/models/course/course.test.ts` / `response.test.ts`
4. `git show ec6506b` — the #46 fix, use as the template for everything above
5. `src/client/ghin/index.ts:356` — the `courses.search` call site

---

### Open questions

- Array-level tolerance: fix-the-field-only, or make search drop bad rows?
  Brad's call (see #2).
- Whether `schemaCourse`'s other `.nullable()` fields get the same treatment now
  or wait for them to break individually.

> `git mv` this to `plans/done/` in the same PR that ships the fix.
