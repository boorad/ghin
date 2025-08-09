import { z } from "zod";
import {
  boolean,
  date,
  emptyStringToNull,
  gender,
  handicap,
  number,
  string,
} from "../../../../models";

const schemaStatus = z.enum(["Active", "Inactive"]);

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
  .partial();

export const schemaGolfersSearchRequest = z
  .object({
    page: number,
    per_page: number.max(100),
    golfer_id: number.optional(),
    last_name: string.optional(),
    first_name: emptyStringToNull.optional(),
    state: emptyStringToNull.transform((value) => value?.toUpperCase()).optional(),
    country: string.transform((value) => value?.toUpperCase()).optional(),
    local_number: emptyStringToNull.optional(),
    email: emptyStringToNull.optional(),
    phone_number: emptyStringToNull.optional(),
    association_id: number.optional(),
    club_id: emptyStringToNull.optional(),
    sorting_criteria: z.enum([
      "first_name",
      "last_name",
      "status",
      "id",
      "gender",
      "date_of_birth",
      "handicap_index",
      "status_date",
      "full_name",
      "home_club",
      "last_name_first_name",
    ]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    status: schemaStatus.optional(),
    updated_since: emptyStringToNull.optional(),
  })
  .partial();

export type GolfersSearchRequest = z.infer<typeof schemaGolfersSearchRequest>;
export type GolfersGlobalSearchRequest = z.infer<typeof schemaGolfersGlobalSearchRequest>;

export const schemaGolfer = z.object({
  ghin: number,
  first_name: string,
  last_name: string,
  association_id: number,
  association_name: string,
  handicap_index: handicap,
  club_affiliation_id: number,
  club_id: number,
  club_name: emptyStringToNull,
  country: emptyStringToNull,
  entitlement: boolean,
  gender,
  hard_cap: boolean,
  has_digital_profile: boolean,
  hi_display: string,
  hi_value: handicap,
  is_home_club: boolean,
  low_hi_date: date.nullable(),
  low_hi_display: string,
  low_hi_value: handicap,
  low_hi: handicap,
  message_club_authorized: string.nullable(),
  middle_name: emptyStringToNull.nullable().optional(),
  phone_number: emptyStringToNull.nullable().optional(),
  prefix: emptyStringToNull.optional(),
  rev_date: date.nullable(),
  soft_cap: boolean,
  state: emptyStringToNull,
  status: schemaStatus,
  suffix: emptyStringToNull.optional(),
});

export type Golfer = z.infer<typeof schemaGolfer>;

export const schemaGolfersSearchResponse = z.object({
  golfers: z.array(schemaGolfer),
});

export type GolfersSearchResponse = z.infer<typeof schemaGolfersSearchResponse>;
