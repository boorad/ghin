# 58 — Declare `estimated_handicap_display` in `schemaScorePostResponseInner`

## Problem

`estimated_handicap_display` is returned on every successful score post but is
not declared in `schemaScorePostResponseInner`. It reaches consumers only
because that object is `.passthrough()`, so:

- it is not in the emitted TypeScript type — consumers hand-write their own
- nothing typechecks it, and no test here or downstream fails if USGA stops sending it
- `onDegraded` cannot fire: that path counts dropped **rows** in a list response,
  and this is a single absent scalar on a non-partitioned object

Downstream (Spicy Golf displays it as the pending Handicap Index®) the row
silently stops rendering, with no error anywhere. Fields going **absent rather
than null** is the established GHIN failure mode — #51, #52, #55, #56, #57 — and
this one has no detection at all.

Observed values (real UAT posts, `api-uat.ghin.com`, 2026-08-28, golfer 13373248):
`15.4, 16.4, 16.4, 16.2, 14.1`, plus `"NH"` for a golfer with no established index.

## Live tracker

- [x] **Phase 1** — Declare `estimated_handicap_display` + model-level tests
      (new `src/client/ghin/models/scores/post-response.test.ts`)
- [x] **Phase 2** — Apply the leniency policy to the rest of
      `schemaScorePostResponseInner`
- [ ] **Phase 3** — Client-level round trip in `index.test.ts` + changeset

## Decisions

Both asked and answered before implementation:

1. **Declaration accepts string *or* number, emits string.**
   `z.union([z.string(), z.number()]).transform(String).nullish()`.
   The issue prints established indexes unquoted (`15.4`) but `"NH"` quoted, so
   the wire type is unconfirmed. A plain `z.string()` would reject every normal
   post if GHIN sends a number — and a parse failure on this response is
   expensive: the score is **already posted** at GHIN, `schemaScorePostResponse`
   has no `partitionRows` salvage path, and this library exposes no score-delete
   method. The union-then-normalize shape mirrors the `handicap` helper
   (`src/models/validation.ts`) added for the `"19.1M"` suffix in #56.
   Emitted type stays `string`; `"NH"` and `"+1.2"` survive verbatim.

2. **The leniency pass ships in this PR**, as a separate commit.
   #57 set the precedent: fix the field that prompted the issue *and* bring the
   schema in line with the policy. Descriptive fields become `.nullish()`;
   `id`, `golfer_id`, `status`, `adjusted_gross_score`, `differential` stay
   required.

## Assumptions

- `course_rating` / `slope_rating` on **this** response are echoes of the posted
  request, not inputs to a Course Handicap calculation, so the 0.15.1 carve-out
  in `tee-set-rating.ts` ("a zero there is a fabricated rating") does not apply
  and they may be `.nullish()`.
- Changeset is `patch` — a fix in the established leniency line, no new
  capability, no new export. The type widening (`unknown` → `string | null |
  undefined`) is non-breaking.

## Out of scope (recon findings, worth their own issues)

- `handicaps/course-handicap.ts` and `handicaps/playing-handicap.ts` declare
  `handicap_index: float.nullable().optional()`. `float` is `z.coerce.number()`,
  so the `"19.1M"` value #56 fixed would produce `NaN` and fail here — and
  neither response uses `partitionRows`, so one bad golfer kills the whole batch
  with no `onDegraded`. Higher severity than #58.
- `schemaScore` (`scores/score.ts`) is **not** `.passthrough()` — any field GHIN
  adds to a score-list row is silently stripped.
- A wider passthrough audit needs a live payload capture; none exists in the repo.
