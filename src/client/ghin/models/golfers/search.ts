import { z } from 'zod'
import { boolean, date, emptyStringToNull, gender, handicap, number, partitionRows, string } from '../../../../models'

// The request filter and the response field are not the same set, so the enum is
// split. Measured against `api-uat`, 2026-09-02: a name search with an empty
// status returned rows with `status: "Archived"` alongside `Active` and
// `Inactive`. `.nullish()` does not rescue those — it accepts `null`/`undefined`
// but an unknown *string* still fails the enum, so `partitionRows` was dropping
// every archived golfer into `invalid`. Only `Active` and `Inactive` are proven
// to work as request *filters* against GHIN, which is why the request side is not
// widened; and three observed values is not proof that `Archived` is the last one.
const schemaStatus = z.enum(['Active', 'Inactive'])
const schemaGolferStatus = z.enum(['Active', 'Inactive', 'Archived'])

export const schemaGolfersGlobalSearchRequest = z
  .object({
    country: string.transform((value) => value?.toUpperCase()),
    first_name: string,
    from_ghin: boolean,
    ghin: number,
    last_name: string.optional(),
    order: z.enum(['asc', 'desc']),
    page: number,
    per_page: number.max(100),
    sorting_criteria: z.enum(['country', 'full_name', 'handicap_index', 'state', 'status']),
    state: string.transform((value) => value?.toUpperCase()),
    status: schemaStatus,
  })
  .partial()

export const schemaGolfersSearchRequest = z
  .object({
    page: number,
    per_page: number.max(100),
    // GHIN accepts a *comma-separated* list here, which is the only bulk
    // golfer lookup the API grants ordinary (non-Admin-Portal) credentials —
    // see plans/done/81-golfer-bulk-lookup.md. Note the bracket forms the rest
    // of the API uses do not work: `golfer_id[]=a&golfer_id[]=b` is a 500 and
    // `golfer_ids[]` is a 400. Prefer `golfers.getMany`, which handles the
    // row-based paging and deduping this raw parameter leaves to the caller.
    //
    // The scalar branch is `z.number().or(z.string()).pipe(number)` rather than a
    // bare `number`: `number` is `z.coerce.number()` and `Number([]) === 0`, so a
    // bare branch would quietly accept an empty array as a search for golfer 0
    // (the coercion trap from #63). Narrowing the input to number-or-string first
    // makes an empty array fail the whole union instead.
    golfer_id: z
      .union([
        z
          .array(number)
          .min(1)
          .transform((ids) => ids.join(',')),
        z.number().or(z.string()).pipe(number),
      ])
      .optional(),
    last_name: string.optional(),
    first_name: emptyStringToNull.optional(),
    state: emptyStringToNull.transform((value) => value?.toUpperCase()).optional(),
    country: string.transform((value) => value?.toUpperCase()).optional(),
    local_number: emptyStringToNull.optional(),
    email: emptyStringToNull.optional(),
    phone_number: emptyStringToNull.optional(),
    association_id: number.optional(),
    club_id: emptyStringToNull.optional(),
    sorting_criteria: z
      .enum([
        'first_name',
        'last_name',
        'status',
        'id',
        'gender',
        'date_of_birth',
        'handicap_index',
        'status_date',
        'full_name',
        'home_club',
        'last_name_first_name',
      ])
      .optional(),
    order: z.enum(['asc', 'desc']).optional(),
    status: schemaStatus.optional(),
    updated_since: emptyStringToNull.optional(),
  })
  .partial()

// `getMany` owns `golfer_id`, `page` and `per_page` — passing them would fight
// the batching and paging it does on the caller's behalf. What is left is the
// two filters that change *which* golfers come back:
//
// - `status` defaults to `'Active'` inside `golfers.search`, so inactive
//   golfers land in `missing` rather than `golfers` unless it is set to
//   `'Inactive'`. There is no "both" value — `status=All` is accepted by GHIN
//   and returns zero rows, which is why the enum does not offer it. Callers
//   who need both statuses have to ask twice.
// - `updated_since` filters the batch to golfers whose record moved since a
//   date, which is the delta feed the Admin-Portal-only `hi_changed_golfers`
//   would have given us (#81).
export const schemaGolfersGetManyRequest = z
  .object({
    status: schemaStatus,
    updated_since: emptyStringToNull,
  })
  .partial()

export type GolfersGetManyRequest = z.infer<typeof schemaGolfersGetManyRequest>

export type GolfersGetManyResponse = {
  golfers: GolfersSearchResponse['golfers']
  // GHIN drops GHIN numbers it does not recognize from the response without an
  // error, so "asked for 12, got 11" is otherwise silent. These are the
  // requested numbers no row came back for — unknown to GHIN, or filtered out
  // by `status` / `updated_since`.
  missing: number[]
}

// `z.input`, not `z.infer`: `golfer_id` accepts `number | number[]` and the
// schema transforms the array into GHIN's comma-separated string, so the output
// type is what goes on the wire rather than what a caller may hand us.
export type GolfersSearchRequest = z.input<typeof schemaGolfersSearchRequest>
export type GolfersGlobalSearchRequest = z.infer<typeof schemaGolfersGlobalSearchRequest>

// `ghin` is the only field that makes a golfer usable — it's what a handicap
// links against. `last_name` is what a human picks from a result list. Every
// other key is descriptive, and GHIN has already dropped optional fields mid-
// batch once (an empty optional field rejected an entire `golfers.search`).
export const schemaGolfer = z
  .object({
    ghin: number,
    first_name: emptyStringToNull.nullish(),
    last_name: string,
    association_id: number.nullish(),
    association_name: string.nullish(),
    handicap_index: handicap.nullish(),
    club_affiliation_id: number.nullish(),
    club_id: number.nullish(),
    club_name: emptyStringToNull.nullish(),
    country: emptyStringToNull.nullish(),
    entitlement: boolean.nullish(),
    gender: gender.nullish(),
    hard_cap: boolean.nullish(),
    has_digital_profile: boolean.nullish(),
    hi_display: string.nullish(),
    hi_value: handicap.nullish(),
    is_home_club: boolean.nullish(),
    low_hi_date: date.nullish(),
    low_hi_display: string.nullish(),
    low_hi_value: handicap.nullish(),
    low_hi: handicap.nullish(),
    message_club_authorized: string.nullish(),
    middle_name: emptyStringToNull.nullish(),
    phone_number: emptyStringToNull.nullish(),
    prefix: emptyStringToNull.nullish(),
    rev_date: date.nullish(),
    soft_cap: boolean.nullish(),
    state: emptyStringToNull.nullish(),
    status: schemaGolferStatus.nullish(),
    suffix: emptyStringToNull.nullish(),
  })
  .passthrough()

export type Golfer = z.infer<typeof schemaGolfer>

// Rows are parsed individually: one golfer GHIN sends malformed used to reject
// every golfer beside them, turning a partial-data problem into "no search
// results at all". Rejects come back raw in `invalid` so the caller can log what
// GHIN actually sent rather than discovering it during an outage.
export const schemaGolfersSearchResponse = z
  .object({
    golfers: z.array(z.unknown()),
  })
  .transform(({ golfers }) => {
    const { valid, invalid } = partitionRows(schemaGolfer, golfers)
    return { golfers: valid, invalid }
  })

export type GolfersSearchResponse = z.infer<typeof schemaGolfersSearchResponse>
