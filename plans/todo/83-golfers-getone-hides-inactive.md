# 83 — `golfers.getOne` hides inactive golfers

Issue: https://github.com/boorad/ghin/issues/83

## Problem

`golfers.getOne` passes `status: 'Active'` explicitly into `golfersGetMany`, so a
lapsed or inactive member resolves `undefined` — indistinguishable from "no such
GHIN number". `handicaps.getOne` delegates to it and inherits the blindness, so
downstream (spicygolf/spicy#1153) an inactive golfer silently falls back to a
four-year-old cached Handicap Index.

Measured against `api-uat`, 2026-09-02, golfer 2890015:

```
golfer_id=2890015 status=Active   -> 0 rows
golfer_id=2890015 status=Inactive -> 3 rows
golfer_id=2890015 status=All      -> 0 rows
golfer_id=2890015 (no status)     -> 3 rows
golfer_id=2890015 status=         -> 3 rows
```

`status=All` is not the "both" value — **omitting** the parameter is.

Two things found alongside:

1. `schemaStatus` is `z.enum(['Active', 'Inactive'])` but UAT returns
   `status: "Archived"` rows. `.nullish()` does not rescue an invalid non-null
   value, so an archived golfer fails `schemaGolfer` and is partitioned into
   `invalid` — the same silent-drop the fix is trying to remove.
2. `{ page: undefined }` reaches the query-string loop (zod `.partial()` keeps a
   present-but-undefined key) and is written as `page=`, which GHIN answers with
   `400 {"errors":{"page":["can't be blank"]}}`.

## Live tracker

- [x] Phase 1 — Split `schemaStatus`; widen the response side to include `Archived`
- [x] Phase 2 — `status: null` means "no filter"; omit the param on the wire
- [ ] Phase 3 — `getOne` stops filtering; comments + README rewritten
- [ ] Phase 4 — The empty-`page` 400
- [ ] Phase 5 — Changeset

## Decisions

Asked and answered by the user before implementation:

- **Scope: `getOne` only.** `golfers.getOne` and `handicaps.getOne` stop
  filtering by status. `golfers.search` and `golfers.getMany` keep their
  `status: 'Active'` default and gain `status: null` as an explicit opt-out.
  Dropping the default from `searchDefaults` entirely would change what spicy's
  name typeahead (`players.ts:155-170`) shows users — a product decision, not a
  bug fix.
- **Status enum: split, widen the response only.** The response-side status
  becomes `'Active' | 'Inactive' | 'Archived'`; the request filter stays
  `'Active' | 'Inactive'`, because only those two are proven to work as filters
  against GHIN. Archived rows stop being dropped; the request surface stays
  honest about what has been measured.

## Assumptions

Decided during implementation without asking:

- **Wire encoding of "no status" is omission, scoped to `status`.** `status: null`
  deletes the parameter rather than sending `status=` (both return 3 rows per the
  table above; omission is the cleaner contract). Implemented by handling
  `status` specifically, *not* by making every `null` value omit its key —
  `first_name`, `state`, `club_id`, `email`, `phone_number` and `updated_since`
  all run through `emptyStringToNull`, so a blanket change would alter six other
  params' wire shape with nothing measured to back it.
- **`undefined` inherits the default, `null` clears it.** Zod `.partial()` keeps
  a present-but-`undefined` key, so the query-string loop must distinguish three
  states: key absent, key present-and-`undefined` (use the default), key
  present-and-`null` (omit). This is also the mechanism behind the `page=` 400.

## Published surface

`minor`. New capability (`status: null` opt-out on search/getMany) plus a
behaviour fix. Not breaking in the API-contract sense, but the changeset must
call out two things: a TS consumer with an exhaustive `switch` over
`golfer.status` and no `default` stops compiling, and a consumer that treated
"`getOne` returned something" as "this golfer is an active member" now needs to
read `status` — that inference was never sound, the old behaviour made it work
by accident.

## Verification

Driveable against UAT (`.env` is Staging-ready). Note `src/playground/ghin.ts`
passes only username/password and therefore defaults to **production** — copy
the config block from `src/playground/score-keys.ts:133-139` for any probe.

- `golfers.getOne(2890015)` — `undefined` on `main`, a record with
  `status: 'Inactive'` after. Then `handicaps.getOne(2890015)` for the inheritance.
- No regression on the Druid Golf set `13373246`–`13373258`; `13373258` still
  comes back `handicap_index: null`, not `999`.
- `getOne`'s query string carries no `status`.
- A name search wide enough to surface an `Archived` row parses with `invalid`
  empty and `onDegraded` never firing.
- `status=All` returns zero rows (justifies the comment rewrite).
- `{ page: undefined }` is a 400 on `main`, rows after Phase 4.

## Carried

- Production (`api2.ghin.com`) confirmation that omitting `status` returns
  inactive golfers — every measurement is UAT and `.env` has no production
  credentials. Owner: user. Precedent for accepting this risk:
  `plans/done/62-handicap-index-suffix-leniency.md`.
