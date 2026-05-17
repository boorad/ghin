import { z } from 'zod'

export const WEBHOOK_EVENT_TYPES = ['golfer', 'score', 'revision', 'club', 'course', 'gpa'] as const

export const schemaWebhookEventType = z.enum(WEBHOOK_EVENT_TYPES)
export type WebhookEventType = z.infer<typeof schemaWebhookEventType>

export const schemaWebhookDataType = z.enum(['all', 'changes_only'])
export type WebhookDataType = z.infer<typeof schemaWebhookDataType>

// GHIN's GET response always includes every event key under each top-level
// field, with `null` as the "unregistered" sentinel — fields aren't omitted,
// they're nulled. So response inner schemas must accept both undefined
// (defensive — older deployments may omit) and null (observed shape).
const partialEventMapResponse = <T extends z.ZodTypeAny>(value: T) =>
  z.object(
    Object.fromEntries(WEBHOOK_EVENT_TYPES.map((event) => [event, value.nullable().optional()])) as {
      [K in WebhookEventType]: z.ZodOptional<z.ZodNullable<T>>
    },
  )

// PATCH bodies we send keep the original "optional, no null" shape — we
// don't want to invite callers to send `null`, which GHIN's docs don't
// cover. The empty-string sentinel below handles the "clear a URL" case.
const partialEventMapRequest = <T extends z.ZodTypeAny>(value: T) =>
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
  webhook_url: partialEventMapResponse(z.string()).optional().default({}),
  webhook_data_type: partialEventMapResponse(schemaWebhookDataType).optional().default({}),
  webhook_enabled: partialEventMapResponse(z.boolean()).optional().default({}),
})

export type WebhookSettings = z.infer<typeof schemaWebhookSettings>

export const schemaWebhookSettingsPatch = z
  .object({
    webhook_url: partialEventMapRequest(webhookPatchUrl).optional(),
    webhook_data_type: partialEventMapRequest(schemaWebhookDataType).optional(),
    webhook_enabled: partialEventMapRequest(z.boolean()).optional(),
  })
  .refine(
    (value) => {
      // Treat empty event maps (`{ webhook_url: {} }`) as not provided —
      // they'd PATCH nothing and silently no-op against GHIN.
      const hasNonEmpty = (m: Record<string, unknown> | undefined) => m !== undefined && Object.keys(m).length > 0
      return (
        hasNonEmpty(value.webhook_url) || hasNonEmpty(value.webhook_data_type) || hasNonEmpty(value.webhook_enabled)
      )
    },
    {
      message:
        'At least one of webhook_url, webhook_data_type, or webhook_enabled must be provided with a non-empty event map',
    },
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
