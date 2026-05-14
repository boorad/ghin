import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Canonical header name GHIN uses to carry the HMAC signature on outbound
 * webhook deliveries. Lower-cased for case-insensitive header lookups.
 *
 * Note: the exact header name and digest scheme are not yet confirmed by
 * USGA. This implementation defaults to the most common scheme (HMAC-SHA256,
 * `sha256=<hex>` prefix). If USGA confirms a different scheme, update
 * {@link WEBHOOK_SIGNATURE_ALGORITHM} and {@link WEBHOOK_SIGNATURE_PREFIX}.
 */
export const WEBHOOK_SIGNATURE_HEADER = 'x-ghin-signature'
export const WEBHOOK_SIGNATURE_ALGORITHM = 'sha256'
export const WEBHOOK_SIGNATURE_PREFIX = 'sha256='

export interface VerifyWebhookSignatureResult {
  ok: boolean
  reason?: string
}

/**
 * Compute the canonical HMAC signature for a given raw body and shared secret.
 * Returned in the `sha256=<hex>` form GHIN's docs reference.
 *
 * @param rawBody - The exact bytes of the request body, as received.
 * @param secret - The shared webhook secret.
 */
export function signWebhookPayload(rawBody: string, secret: string): string {
  return `${WEBHOOK_SIGNATURE_PREFIX}${createHmac(WEBHOOK_SIGNATURE_ALGORITHM, secret).update(rawBody).digest('hex')}`
}

/**
 * Verify an inbound GHIN webhook signature against the configured secret.
 *
 * Uses a constant-time comparison to defend against timing oracles, and
 * tolerates the signature being sent with or without the `sha256=` prefix.
 *
 * @param rawBody - The exact request body bytes, as received (NOT re-stringified JSON).
 * @param signatureHeader - Value of the X-GHIN-Signature header.
 * @param secret - Shared webhook secret. Pass an empty string to short-circuit
 *   verification with a misconfigured-secret error (callers should treat this
 *   as a 500-level config issue, not a 401).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): VerifyWebhookSignatureResult {
  if (!secret) {
    return { ok: false, reason: 'webhook secret not configured' }
  }

  if (!signatureHeader) {
    return { ok: false, reason: 'missing signature header' }
  }

  const expected = signWebhookPayload(rawBody, secret)
  const provided = signatureHeader.startsWith(WEBHOOK_SIGNATURE_PREFIX)
    ? signatureHeader
    : `${WEBHOOK_SIGNATURE_PREFIX}${signatureHeader}`

  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)

  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, reason: 'signature length mismatch' }
  }

  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, reason: 'signature mismatch' }
  }

  return { ok: true }
}
