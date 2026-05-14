import { z } from 'zod'

export const WEBHOOK_EVENT_TYPES = ['golfer', 'score', 'revision', 'club', 'course', 'gpa'] as const

export const schemaWebhookEventType = z.enum(WEBHOOK_EVENT_TYPES)
export type WebhookEventType = z.infer<typeof schemaWebhookEventType>

export const schemaWebhookDataType = z.enum(['all', 'changes_only'])
export type WebhookDataType = z.infer<typeof schemaWebhookDataType>

const partialEventMap = <T extends z.ZodTypeAny>(value: T) =>
  z.object(
    Object.fromEntries(WEBHOOK_EVENT_TYPES.map((event) => [event, value.optional()])) as {
      [K in WebhookEventType]: z.ZodOptional<T>
    },
  )

// PATCH URL leaves accept a valid URL or an empty string. The empty-string
// case lets callers clear a registered URL via PATCH. The response schema
// stays permissive (`z.string()`) because GHIN's returned URLs aren't ours
// to validate.
const webhookPatchUrl = z.union([z.literal(''), z.string().url()])

export const schemaWebhookSettings = z.object({
  webhook_url: partialEventMap(z.string()).optional().default({}),
  webhook_data_type: partialEventMap(schemaWebhookDataType).optional().default({}),
  webhook_enabled: partialEventMap(z.boolean()).optional().default({}),
})

export type WebhookSettings = z.infer<typeof schemaWebhookSettings>

export const schemaWebhookSettingsPatch = z
  .object({
    webhook_url: partialEventMap(webhookPatchUrl).optional(),
    webhook_data_type: partialEventMap(schemaWebhookDataType).optional(),
    webhook_enabled: partialEventMap(z.boolean()).optional(),
  })
  .refine(
    (value) =>
      value.webhook_url !== undefined || value.webhook_data_type !== undefined || value.webhook_enabled !== undefined,
    { message: 'At least one of webhook_url, webhook_data_type, or webhook_enabled must be provided' },
  )

export type WebhookSettingsPatch = z.infer<typeof schemaWebhookSettingsPatch>

export const schemaEnsureRegisteredRequest = z.object({
  event: schemaWebhookEventType,
  url: z.string().url(),
  dataType: schemaWebhookDataType.optional().default('changes_only'),
  enabled: z.boolean().optional().default(true),
})

export type EnsureRegisteredRequest = z.input<typeof schemaEnsureRegisteredRequest>

export interface EnsureRegisteredResult {
  changed: boolean
  reason?: string
  settings: WebhookSettings
}

export const schemaWebhookSuccessResponse = z
  .object({
    success: z.string(),
  })
  .passthrough()

export type WebhookSuccessResponse = z.infer<typeof schemaWebhookSuccessResponse>
