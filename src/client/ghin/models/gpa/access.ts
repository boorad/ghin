import { z } from 'zod'
import { number, string } from '../../../../models'

const schemaGpaAccessStatus = z
  .object({
    golfer_id: number,
    status: string,
  })
  .passthrough()

type GpaAccessStatus = z.infer<typeof schemaGpaAccessStatus>

const schemaGpaAccessesResponse = z.object({
  accesses: z.array(schemaGpaAccessStatus),
})

type GpaAccessesResponse = z.infer<typeof schemaGpaAccessesResponse>

const schemaGpaRequestAccessResponse = z
  .object({
    golfer_id: number,
    status: string,
  })
  .passthrough()

type GpaRequestAccessResponse = z.infer<typeof schemaGpaRequestAccessResponse>

const schemaGpaUpdateStatusRequest = z.object({
  user_id: number,
  golfer_id: number,
  status: z.enum(['approved', 'denied']),
})

type GpaUpdateStatusRequest = z.infer<typeof schemaGpaUpdateStatusRequest>

const schemaGpaUpdateStatusResponse = z
  .object({
    golfer_id: number,
    status: string,
  })
  .passthrough()

type GpaUpdateStatusResponse = z.infer<typeof schemaGpaUpdateStatusResponse>

const schemaGpaRevokeAccessResponse = z
  .object({
    golfer_id: number,
  })
  .passthrough()

type GpaRevokeAccessResponse = z.infer<typeof schemaGpaRevokeAccessResponse>

export {
  schemaGpaAccessesResponse,
  schemaGpaAccessStatus,
  schemaGpaRequestAccessResponse,
  schemaGpaRevokeAccessResponse,
  schemaGpaUpdateStatusRequest,
  schemaGpaUpdateStatusResponse,
}
export type {
  GpaAccessesResponse,
  GpaAccessStatus,
  GpaRequestAccessResponse,
  GpaRevokeAccessResponse,
  GpaUpdateStatusRequest,
  GpaUpdateStatusResponse,
}
