import { z } from 'zod'
import { schemaWebhookEnvelope } from './envelope'
import { schemaWebhookEventType } from './settings'

export const schemaWebhooksListObjectType = z.union([schemaWebhookEventType, z.literal('crs')])
export type WebhooksListObjectType = z.infer<typeof schemaWebhooksListObjectType>

export const schemaWebhooksListEntityType = z.enum(['CrsCourse', 'CrsFacility', 'AssociationSeason', 'CrsTeeSet'])
export type WebhooksListEntityType = z.infer<typeof schemaWebhooksListEntityType>

export const schemaWebhooksListRequest = z.object({
  page: z.number().int().positive().default(1),
  per_page: z.number().int().positive().default(25),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  status: z.union([z.literal('sent'), z.literal('not sent')]).optional(),
  object_type: schemaWebhooksListObjectType.optional(),
  object_id: z.number().int().optional(),
  secondary_object_type: z.literal('golfer').optional(),
  secondary_object_id: z.number().int().optional(),
  entity_type: schemaWebhooksListEntityType.optional(),
})

export type WebhooksListRequest = z.input<typeof schemaWebhooksListRequest>

export const schemaWebhooksListResponse = z
  .object({
    webhooks: z.array(schemaWebhookEnvelope),
  })
  .passthrough()

export type WebhooksListResponse = z.infer<typeof schemaWebhooksListResponse>

export const schemaWebhookResendRequest = z.object({
  webhook_id: z.number().int().positive(),
  is_crs_webhook: z.boolean().optional().default(false),
})

export type WebhookResendRequest = z.input<typeof schemaWebhookResendRequest>
