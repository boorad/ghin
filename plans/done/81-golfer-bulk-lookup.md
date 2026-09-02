# 81 — Golfer bulk lookup, HI delta feed, golfers-by-club

Started as a spec read; the read turned up a usable bulk lookup, so it shipped as
`golfers.getMany`. Spec read from the resolved OpenAPI
(`https://api.swaggerhub.com/apis/GHIN/GHIN2020AllStage/1.0`, whose golfer paths `$ref`
into `https://api.swaggerhub.com/domains/GHIN/golfer/1`) and every shape probed live
against UAT (`api-uat.ghin.com/api/v1`) with the Spicy dev credentials.

## Headline

**None of the three endpoints in the issue are the answer, and two of them we are not
even allowed to call.** But the probe turned up the thing #1147 actually wants, on an
endpoint the client already implements: **`golfers/search.json` accepts a
comma-separated list in `golfer_id`.** See "The endpoint that does work" below.

## 1. `POST /golfers/match_ghin_numbers_with_last_name` — bulk, but useless payload

Accessible with our credentials. It is genuinely bulk, and that is all the good news.

Request:

```json
{ "golfers": [ { "id": 10532, "last_name": "Smith" }, { "id": 12679, "last_name": "ZZZNOPE" } ] }
```

Response (verified on UAT):

```json
{ "matched_golfers": [10532], "unmatched_golfers": [12679, 999999999] }
```

Two arrays of bare numbers. **No golfer records, no `hi_display`, no `hi_value`, no
`rev_date`.** It is a validator, not a lookup — the answer to the issue's question is
"a boolean match per pair", expressed as set membership.

Two behaviours worth writing down if we ever do wrap it:

- `id` must be a JSON **number**. Sending the GHIN as a string (which is how
  `golfers/search` returns it — `"ghin": "10532"`) gets
  `400 {"errors":{"golfers":["every golfer should contain a number 'id'"]}}`.
- A GHIN that does not exist at all lands in `unmatched_golfers` alongside a real
  golfer with the wrong surname. The response cannot distinguish "wrong last name"
  from "no such golfer".

**Verdict for spicygolf/spicy#1147: no.** It collapses N calls to 1 only if the question
is "do these name/number pairs agree", which is not the question. It cannot feed a picker.

## 2. `hi_changed_golfers` / `hi_modified_golfers` — right shape, no access

The spec answers the issue's questions cleanly:

- **What scopes the bare `/golfers/` variant:** the `golfer_ids[]` query array. That
  parameter exists *only* on the bare variant — the `/clubs/{club_id}/` and
  `/associations/{association_id}/` variants take no id list, just the path scope. So
  the bare one is exactly the "golfer set we already hold" shape the issue was hoping for.
- **What bounds the window:** `start_date` (a date, `2019-10-31`, not a cursor), meaning
  "between start_date and today". Plus `page` / `per_page`, max 100.
- **`changed` vs `modified`:** the guess in the issue is right, and the response shapes
  confirm it. `hi_changed` = "Handicap Index was **revised**"; `hi_modified` = "Handicap
  Index was **modified**". The `hi_changed` golfer record carries four extra fields the
  `hi_modified` one does not — `hi_modified`, `low_hi_modified`, `hi_withdrawn`,
  `low_hi_date` — i.e. the revision feed tells you whether a committee touched the value,
  which is precisely the distinction.

Both return full golfer records: `id`, names, `gender`, `handicap_index`, `hi_value`,
`hi_display`, `low_hi_value`, `low_hi_display`, `rev_date`, `is_minor`, `is_merged`,
`message_club_authorized`.

**And every one of the six paths returns `404 {"error":"AccessDenied: You are not
authorized to access this page."}` for us.** Verified on `/golfers/`, `/clubs/{id}/` and
`/associations/{id}/` variants, with `start_date` present and absent, with and without
`golfer_ids[]`, and under four different `source` header values. This is not a parameter
problem — these are Admin Portal endpoints and our account tier cannot reach them.

**Verdict: blocked, not deferred.** Wrapping them is dead work until USGA grants the
account access. Worth an ask if we ever open a channel to them, because the shape is right.

## 3. `GET /clubs/{club_id}/golfers` — richest record in the API, no access

The record answers #1148 on paper. Each golfer carries `club_name` **and** `club_id`,
`association_id`, `association_name`, plus full address — `state`, `country`, `city`,
`street_1`, `street_2`, `zip` — plus `status`, `status_date`, `handicap_index`, `hi_value`,
`hi_display`, `rev_date`, `low_hi_*`, `soft_cap`, `hard_cap`, `is_home_club`,
`has_digital_profile`, `technology_provider`, `local_number`. Response also carries
`meta.active_golfers_count` / `meta.inactive_golfers_count`. Filters include `golfer_id`,
`full_name`, `last_name`, `gender`, `status`, `membership_code`, `local_number`; sortable;
`per_page` max 100.

**Also `AccessDenied`.** Note the failure mode is confusing: param validation runs *before*
authorization, so `?per_page=1` without `page` returns a plausible-looking
`400 {"errors":{"page":["can't be blank"]}}` and only once you supply `page=1` does it
turn into the 404/AccessDenied. Do not read that 400 as "the endpoint works".

**Verdict: blocked.** And unnecessary — see below, the club/state fields #1148 wants are
already on the `golfers/search` row we can reach.

## 4. `GET /clubs/{club_id}/golfers/{id}/handicap_display` — not what the name suggests

Not a sanctioned display payload. It returns one golfer with nine fields —
`id`, `first_name`, `last_name`, `middle_name`, `prefix`, `suffix`, `gender`, `status`,
and `handicap_index` as a string. That is a strict subset of what `golfers/search`
already gives us, it requires a `club_id` we would have to look up first, it is one
golfer per call, and it is `AccessDenied` for us anyway.

**Verdict: no.** It is not an answer to the "store the ID, retrieve the Index" thread —
`hi_display` on the rows we already fetch is the same string with more context around it.

## The endpoint that does work: `golfers/search.json` takes a list

`golfer_id` accepts **comma-separated GHIN numbers**. Verified on UAT:

```
GET /golfers/search.json?page=1&per_page=100&golfer_id=10532,12679,37984
```

Every row is the full `golfers/search` record we already parse in
`src/client/ghin/models/golfers/search.ts` — `hi_display`, `hi_value`, `rev_date`,
`handicap_index`, `low_hi_*`, `club_name`, `club_id`, `state`, `country`, `city`,
`is_home_club`, `status`. That is #1147's handicap need **and** #1148's club/state
backfill from one call, on an endpoint the client already implements and is authorized for.

Measured behaviour, all of it worth encoding before anyone builds on this:

- **Pagination counts rows, not golfers.** A golfer returns one row per club affiliation
  (a 3-club golfer is 3 rows, same `ghin`, different `club_id`/`club_name`). 100 ids at
  `per_page=100` returned 100 rows covering only **50 distinct golfers**; `page=2` returned
  the remaining 98 rows. So N ids needs roughly `ceil(N * avg_affiliations / 100)` pages,
  and the caller must dedupe by `ghin`.
- **No `meta` block**, so there is no total to page against — you page until a short page.
- **Unknown GHINs are silently dropped.** `golfer_id=10532,999999999` returns only 10532's
  rows, no error, no marker. The caller has to diff requested against returned.
- **`updated_since` composes with a multi-id `golfer_id`.** That is the delta feed
  spicygolf/spicy#1149 wanted from `hi_changed_golfers`, minus the authorization problem:
  ask for the golfers you hold, filtered to those that moved.
- Only the comma form works. `golfer_id[]=a&golfer_id[]=b` is a **500**; `golfer_ids[]`
  is a 400 ("golfer_id, last_name and state, ... are not present").
- Batch ceiling not probed beyond 100 ids — the URL is the practical limit and 100 ids is
  already ~1.3 KB of query string. Worth finding the real cap before relying on it.

**This makes the viewport windowing in #1147 unnecessary for the reason the issue hoped,
just via a different endpoint.** ~10-12 golfers is one call, not 10-12.

## Bonus find: bulk low-HI, and a spec drift

`POST /golfers/low_hi_last_year.json` (also `low_hi_last_3months`, `low_hi_last_6months`,
`low_hi_date_range`) takes a list and **is accessible** to us:

```json
{ "ghinNumber": ["10532", "13373258"] }
```

Returns low HI only — `GHINNumber`, `LowHIValue`, `LowHIDisplay`, `Holes`, `RevDate`,
`OK` — so it is not a substitute for current Index. Two things if we ever wrap it:

- **The spec is wrong about the envelope.** It documents `{"ArrayOfLowHI": [...]}`; the
  wire returns `{"d": [...]}`. Same drift class as #68/#71/#73.
- It drops unknown GHINs silently, and signals failure with a row whose `GHINNumber` is
  `""` and `OK` is `"false"` rather than an error status.

## What shipped

`golfers.getMany(ghinNumbers, { status?, updated_since? })` →
`Result<{ golfers, missing }, GhinError>`.

- `schemaGolfersSearchRequest.golfer_id` widened to `number | number[]`, with the
  array joined into GHIN's comma-separated form. `GolfersSearchRequest` is now
  `z.input` rather than `z.infer` so the caller-facing type is the array, not the
  joined string.
- The scalar branch of that union is `z.number().or(z.string()).pipe(number)`,
  not a bare `number`. `number` is `z.coerce.number()` and `Number([]) === 0`, so
  a bare branch would have quietly accepted `golfer_id: []` as a search for
  golfer 0 — the same coercion trap as #63.
- `golfersSearch` split: `golfersSearchPage` returns `rowsReceived` (parsed rows
  plus rows `partitionRows` dropped) so the page loop measures "short page"
  against what GHIN sent. Paging on the parsed count would treat a full page
  holding one malformed row as the last page and truncate the batch silently.
- Batches of 100 GHIN numbers, `per_page=100`, pages each batch until short,
  25-page-per-batch safety cap.
- Deduplicates to one row per GHIN preferring `is_home_club`. Verified on UAT
  across 138 golfers: every one had exactly one home-club row, and `hi_value`,
  `rev_date`, `handicap_index` and `status` never differed between a golfer's
  affiliation rows — so this drops club duplicates, never handicap data.
- Requested numbers with no row come back in `missing`.
- `golfers.getOne` now routes through `getMany`. Its old `per_page: 1` returned
  whichever affiliation row GHIN sorted first, so `club_name` was a coin flip for
  a multi-club golfer — the field that tells two same-named golfers apart. The
  index it returned was never wrong (identical across a golfer's rows). Still one
  request; the page just holds every affiliation of the one golfer.
  `handicaps.getOne` delegates to it and inherits the fix.

Measured against UAT: 12 GHIN numbers is 1 HTTP call, 50 is 1, 121 is 3.
Previously 121 calls.

## Deliberately not done

- **No `status: 'All'`.** GHIN accepts the value and returns zero rows. Covering
  both statuses means asking twice.
- **Batch ceiling above 100 GHIN numbers is unprobed.** 100 is what was verified;
  the real limit is URL length.

## Still blocked

Do not plan around `hi_changed_golfers` / `hi_modified_golfers` /
`clubs/{id}/golfers` / `handicap_display` until the account gets Admin Portal
access. The sections above are the record of what they would give us if it ever
happens.

Probe scripts were throwaway (`/tmp`), read-only, and are not checked in.
