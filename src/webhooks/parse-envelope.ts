import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import {
  type WebhookEnvelope,
  type WebhookEnvelopePayload,
  schemaWebhookEnvelope,
} from '../client/ghin/models/webhooks'
import { ValidationError } from '../errors'

/**
 * Validates an inbound webhook body against the documented GHIN delivery
 * envelope and returns a typed result. The inner `payload.object` shape is
 * not documented by USGA in Swagger; callers can narrow it by passing the
 * expected payload type, but no further validation happens here.
 */
export function parseWebhookEnvelope<T = unknown>(payload: unknown): Result<WebhookEnvelope<T>, ValidationError> {
  const parsed = schemaWebhookEnvelope.safeParse(payload)

  if (!parsed.success) {
    return err(new ValidationError(`Invalid webhook envelope: ${parsed.error.message}`, undefined, undefined, payload))
  }

  return ok({
    id: parsed.data.id,
    payload: parsed.data.payload as WebhookEnvelopePayload<T>,
    status: parsed.data.status,
  })
}
