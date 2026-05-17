import { z } from 'zod'
import { number, string } from '../../../../models'

// Raw entry as returned under `golfers[]` from `GET /users/accesses.json`
// (the USGA "UserAccesses" endpoint). `golfer.id` and `user_access.id`
// arrive as numeric strings; `number` (z.coerce.number().int()) handles
// the coercion.
const schemaUserAccessGolferEntry = z
  .object({
    golfer: z
      .object({
        id: number,
      })
      .passthrough(),
    user_access: z
      .object({
        id: number,
        golfer_name: string,
        gpa_status: z.string(),
      })
      .passthrough(),
  })
  .passthrough()

// The endpoint also returns `federations` / `associations` / `clubs` /
// `super_user` / `subtype` siblings unrelated to GPA — passthrough keeps
// them on the parsed object so the wrapper can ignore them without Zod
// rejecting the response.
const schemaUserAccessesResponse = z
  .object({
    golfers: z.array(schemaUserAccessGolferEntry).default([]),
  })
  .passthrough()

type UserAccessesResponse = z.infer<typeof schemaUserAccessesResponse>

// Flat, caller-friendly shape returned by `client.gpa.getAccesses()`.
// Observed `gpaStatus` values: 'pending' | 'approved' | 'inactive'
// (and presumably 'denied'). Left as `string` so an unexpected value
// from USGA doesn't throw at parse time.
const schemaGpaAccess = z.object({
  golferId: number,
  userAccessId: number,
  golferName: string,
  gpaStatus: z.string(),
})

type GpaAccess = z.infer<typeof schemaGpaAccess>

const schemaGpaRequestAccessRequest = z.object({
  email: string,
})

type GpaRequestAccessRequest = z.infer<typeof schemaGpaRequestAccessRequest>

const schemaGpaUpdateStatusRequest = z.object({
  user_id: number,
  golfer_id: number,
  status: z.enum(['approved', 'denied']),
})

type GpaUpdateStatusRequest = z.infer<typeof schemaGpaUpdateStatusRequest>

// `requestAccess`, `updateStatus`, and `revokeAccess` all return
// `{ success: "<message>" }` — a localized confirmation string. Callers
// typically discard it; surfaced so a UI can display it verbatim.
const schemaGpaSuccessResponse = z
  .object({
    success: z.string(),
  })
  .passthrough()

type GpaSuccessResponse = z.infer<typeof schemaGpaSuccessResponse>

export {
  schemaGpaAccess,
  schemaGpaRequestAccessRequest,
  schemaGpaSuccessResponse,
  schemaGpaUpdateStatusRequest,
  schemaUserAccessesResponse,
}
export type { GpaAccess, GpaRequestAccessRequest, GpaSuccessResponse, GpaUpdateStatusRequest, UserAccessesResponse }
