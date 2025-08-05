import { z } from "zod";
import { boolean, emptyStringToNull, string } from "../../../models";

export const schemaLoginAPIRequest = z.object({
  user: z.object({
    email: string,
    password: string,
    remember_me: boolean,
  }),
});

export type LoginRequest = z.infer<typeof schemaLoginAPIRequest>;

export const schemaLoginResponse = z.object({
  golfer_user: z.object({
    golfer_user_token: string,
  }),
});

export const schemaLoginAPIResponse = z.object({
  user: z.object({
    id: string,
    email: emptyStringToNull.optional(),
    prefix: emptyStringToNull.optional(),
    first_name: emptyStringToNull.optional(),
    middle_name: emptyStringToNull.optional(),
    last_name: emptyStringToNull.optional(),
    suffix: emptyStringToNull.optional(),
    phone: emptyStringToNull.optional(),
    last_sign_in_at: emptyStringToNull.optional(),
  }),
  token: string,
});

export type LoginResponse =
  | z.infer<typeof schemaLoginResponse>
  | z.infer<typeof schemaLoginAPIResponse>;
