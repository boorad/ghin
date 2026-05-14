# Webhook Support

**Goal**: Add webhook settings CRUD + envelope/signature helpers to the ghin library so callers don't have to re-implement login + raw fetch against `/user/webhook_settings`.
**Branch**: `feat/webhooks`

## Context

USGA's "Golfer Product Access API End Points" (Feb 2023) lists `GET / PATCH / DELETE /user/webhook_settings.{format}` but doesn't publish the request/response shapes. The authenticated SwaggerHub spec (GHIN/GHIN2020AllStage) does.

Real settings shape — a flat object with three parallel per-event-type maps:

```json
{
  "webhook_url":       { "revision": "https://...", "golfer": "...", "score": "...", "club": "...", "course": "...", "gpa": "..." },
  "webhook_data_type": { "revision": "changes_only", "score": "all", ... },
  "webhook_enabled":   { "revision": true,  "score": false, ... }
}
```

Real outbound delivery envelope (one event per POST):

```json
{
  "id": 0,
  "payload": {
    "object": { /* event-specific body, shape per object_type */ },
    "object_type": "revision" | "score" | "golfer" | "club" | "course" | "gpa",
    "action": "string",
    "webhook_key": "string",
    "webhook_sent_at": "string",
    "environment": "string"
  },
  "status": "sent" | "not sent"
}
```

## API Surface

### Settings CRUD (current user)

```
GET    /user/webhook_settings.{format}
PATCH  /user/webhook_settings.{format}
DELETE /user/webhook_settings.{format}
GET    /user/webhook_settings/test.{format}?type=revision|score|golfer|club|course|gpa
```

`PATCH` updates only the fields sent. Sending `{ webhook_url: { revision: "..." } }` leaves the other event types alone. There is no POST — `PATCH` acts as upsert.

`GET /user/webhook_settings/test.json?type=<X>` POSTs a synthetic event to whichever URL is registered under `webhook_url.<X>` (response body of the GET is just `{ "success": "Check your URL for test response." }`). Per the doc: "GPA Users do not have permissions to use the following input values: golfer, club" — so the library should not reject those at the type level, but callers should know.

### Delivery history / replay

```
GET  /user/webhooks.{format}?page=1&per_page=25
       &from_date=…&to_date=…&status=sent|not%20sent
       &object_type=golfer|score|revision|club|crs|gpa
       &object_id=…
       &secondary_object_type=golfer  (only when object_type is revision|score)
       &secondary_object_id=…
       &entity_type=CrsCourse|CrsFacility|AssociationSeason|CrsTeeSet  (object_type=crs only)

POST /user/resend_webhook.{format}?webhook_id=N&is_crs_webhook=false
```

`/user/webhooks` is the listing/recovery endpoint. Polling for `status=not sent` is the basis of a missed-delivery worker. `/user/resend_webhook` replays a single delivery — partner has to provide the webhook_id from the listing.

## Steps

### Phase 1: Models + envelope/signature helpers

| # | Step | Status |
|---|------|--------|
| 1 | Add webhook models (settings, envelope, listing, event types) under `src/client/ghin/models/webhooks.ts` | pending |
| 2 | Export `parseWebhookEnvelope(payload)` from `src/utils/` (or a new `src/webhooks/`) — validates the documented envelope shape and returns a typed discriminated union by `object_type` | pending |
| 3 | Export `verifyWebhookSignature(rawBody, header, secret)` and `signWebhookPayload(rawBody, secret)`. Default HMAC-SHA256 with `sha256=<hex>` prefix; structure so the algorithm can be swapped from one place once USGA confirms the canonical scheme. | pending |
| 4 | Tests for envelope parser (each `object_type`, malformed payloads, array vs single `object`) and signature verifier (matching/mismatched, length-mismatch, missing secret/header) | pending |

#### Model sketches

```typescript
export type WebhookEventType =
  | 'golfer'
  | 'score'
  | 'revision'
  | 'club'
  | 'course'
  | 'gpa'

export type WebhookDataType = 'all' | 'changes_only'

export interface WebhookSettings {
  webhook_url:       Partial<Record<WebhookEventType, string>>
  webhook_data_type: Partial<Record<WebhookEventType, WebhookDataType>>
  webhook_enabled:   Partial<Record<WebhookEventType, boolean>>
}

// Patch body — same shape as WebhookSettings but every leaf optional.
export type WebhookSettingsPatch = Partial<WebhookSettings>

export interface WebhookEnvelope<T = unknown> {
  id: number
  payload: {
    object: T
    object_type: WebhookEventType
    action: string
    webhook_key: string
    webhook_sent_at: string
    environment: string
  }
  status: 'sent' | 'not sent' | string
}

// Listing/recovery
export interface WebhooksListRequest {
  page: number
  per_page: number
  from_date?: string
  to_date?: string
  status?: 'sent' | 'not sent'
  object_type?: WebhookEventType | 'crs'
  object_id?: number
  secondary_object_type?: 'golfer'
  secondary_object_id?: number
  entity_type?: 'CrsCourse' | 'CrsFacility' | 'AssociationSeason' | 'CrsTeeSet'
}

export interface WebhooksListResponse {
  webhooks: WebhookEnvelope[]
  // pagination shape TBD from sandbox
}
```

The shape of `payload.object` for `object_type === 'revision'` is **NOT** documented in Swagger (the example shows `object: {}`). Plan: capture a real test-event body via the playground script and lock the shape down here once we see it.

For now: `WebhookEnvelope<T>` stays generic. Library exports `WebhookEnvelope<unknown>` from the parser; callers can narrow `T` to their own shape until USGA publishes the inner payload shapes.

### Phase 2: `client.webhooks.*` namespace

| # | Step | Status |
|---|------|--------|
| 5 | Add `WebhookClient` (or `client.webhooks`) following the existing namespace pattern in `src/client/ghin/index.ts` | pending |
| 6 | `get()` → `WebhookSettings` (GET /user/webhook_settings.json) | pending |
| 7 | `patch(settings: WebhookSettingsPatch)` → `WebhookSettings` (PATCH) | pending |
| 8 | `delete()` → `{ success: string }` (DELETE) | pending |
| 9 | `test(type: WebhookEventType)` → `{ success: string }` (GET .../test.json?type=…) | pending |
| 10 | `list(req: WebhooksListRequest)` → `WebhooksListResponse` (GET /user/webhooks.json) | pending |
| 11 | `resend(webhookId: number, opts?: { isCrs?: boolean })` → `{ success: string }` (POST /user/resend_webhook.json) | pending |
| 12 | Playground script `playground/webhook-flow.ts` — login, GET settings, PATCH to register a webhook.site URL, fire `test('revision')`, list deliveries, resend the first one | pending |
| 13 | Tests for each method (happy path + 401 refresh path inherited from RequestClient) | pending |

These methods sit on the **GPA / apiAccess: true** auth path — they're partner-API endpoints, not consumer-facing. Confirm `RequestClient` is in `apiAccess` mode for the namespace.

### Phase 3 (optional): higher-level helpers

| # | Step | Status |
|---|------|--------|
| 14 | `client.webhooks.ensureRegistered({ event, url, dataType })` — GETs current, PATCHes only if a leaf differs (idempotent). | pending |
| 15 | `client.webhooks.iterateUndelivered({ objectType, fromDate })` — async generator that pages through `status=not sent` and yields envelopes. Foundation for missed-delivery recovery workers. | pending |

Phase 3 is nice-to-have. Phase 1 + 2 unblock all current webhook integration work; Phase 3 lets callers skip the registration comparator and write a one-liner for the recovery loop.

## Implementation Notes

- **Auth**: `apiAccess: true` mode in `RequestClient` already handles the `/users/login.json` + Bearer + 12h refresh used by webhook endpoints. The new namespace should be wired through that, not bypass it.
- **Source header**: GHIN expects `source: GHINcom` on first-party API requests. `RequestClient.CLIENT_SOURCE` already provides this; reuse it.
- **Signature scheme is unconfirmed**: ship `verifyWebhookSignature` with the most-common default (HMAC-SHA256, header `X-GHIN-Signature`, `sha256=<hex>` value) but make the algorithm/header swappable from one config point so a USGA reply confirming a different scheme is a one-line change. Document the assumption in the function's docstring.
- **Test-event body capture**: the cleanest way to lock down the inner `payload.object` shapes is to register a webhook.site (or your own) URL via `webhooks.patch()`, fire `webhooks.test('revision')`, copy the body USGA POSTs into a fixture, and write the parser/type against the real data. Do this for each `object_type` we care about (revision first, then score and gpa).
- **Empty `payload.object`** in the Swagger example is intentional — Swagger uses `{}` as a placeholder rather than documenting the inner shape. Don't be misled into typing it as `Record<string, never>`.
- **`status` field on listing entries**: Swagger shows `"sent"` and `"not sent"` (with a space) — match exact string when filtering. Library should expose a `WebhookDeliveryStatus` enum/union with those literal values.
- **`is_crs_webhook` on resend**: defaults to `false`. Only set true for `object_type === 'crs'` deliveries. Keep it an optional param with a sensible default in the method signature.
