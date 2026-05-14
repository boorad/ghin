import { z } from 'zod'
import { schemaWebhookEventType } from './settings'

export const schemaWebhookDeliveryStatus = z.union([z.literal('sent'), z.literal('not sent'), z.string()])
export type WebhookDeliveryStatus = 'sent' | 'not sent' | (string & {})

// Envelopes can carry settings-subscribable events (the 6 in WebhookEventType)
// AND 'crs' Course Rating System deliveries, which aren't subscribable via the
// flat settings map but flow through the same listing/resend endpoints.
export const schemaWebhookEnvelopeObjectType = z.union([schemaWebhookEventType, z.literal('crs')])
export type WebhookEnvelopeObjectType = z.infer<typeof schemaWebhookEnvelopeObjectType>

export const schemaWebhookEnvelopePayload = z
  .object({
    object: z.unknown(),
    object_type: schemaWebhookEnvelopeObjectType,
    action: z.string(),
    webhook_key: z.string(),
    webhook_sent_at: z.string(),
    environment: z.string(),
  })
  .passthrough()

export const schemaWebhookEnvelope = z
  .object({
    id: z.number(),
    payload: schemaWebhookEnvelopePayload,
    status: schemaWebhookDeliveryStatus,
  })
  .passthrough()

export type WebhookEnvelopePayload<T = unknown> = {
  object: T
  object_type: WebhookEnvelopeObjectType
  action: string
  webhook_key: string
  webhook_sent_at: string
  environment: string
}

export type WebhookEnvelope<T = unknown> = {
  id: number
  payload: WebhookEnvelopePayload<T>
  status: WebhookDeliveryStatus
}
