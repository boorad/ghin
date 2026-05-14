import { z } from 'zod'
import { schemaWebhookEventType } from './settings'

export const schemaWebhookDeliveryStatus = z.union([z.literal('sent'), z.literal('not sent'), z.string()])
export type WebhookDeliveryStatus = 'sent' | 'not sent' | (string & {})

export const schemaWebhookEnvelopePayload = z
  .object({
    object: z.unknown(),
    object_type: schemaWebhookEventType,
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
  object_type: z.infer<typeof schemaWebhookEventType>
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
