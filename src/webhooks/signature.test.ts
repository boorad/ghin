import { describe, expect, it } from 'vitest'
import { WEBHOOK_SIGNATURE_HEADER, signWebhookPayload, verifyWebhookSignature } from './signature'

const SECRET = 'test-secret-do-not-use-in-prod'
const BODY = JSON.stringify({ revisions: [{ golfer_id: 1234567 }] })

describe('verifyWebhookSignature', () => {
  it('accepts a correct sha256= signature', () => {
    const sig = signWebhookPayload(BODY, SECRET)
    expect(verifyWebhookSignature(BODY, sig, SECRET)).toEqual({ ok: true })
  })

  it('accepts a signature without the sha256= prefix', () => {
    const sig = signWebhookPayload(BODY, SECRET).replace(/^sha256=/, '')
    expect(verifyWebhookSignature(BODY, sig, SECRET)).toEqual({ ok: true })
  })

  it('rejects a tampered body', () => {
    const sig = signWebhookPayload(BODY, SECRET)
    const result = verifyWebhookSignature(`${BODY} `, sig, SECRET)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('signature mismatch')
  })

  it('rejects a wrong secret', () => {
    const sig = signWebhookPayload(BODY, 'other-secret')
    expect(verifyWebhookSignature(BODY, sig, SECRET).ok).toBe(false)
  })

  it('rejects when signature header is missing', () => {
    const result = verifyWebhookSignature(BODY, undefined, SECRET)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('missing signature header')
  })

  it('rejects when secret is not configured', () => {
    const sig = signWebhookPayload(BODY, SECRET)
    const result = verifyWebhookSignature(BODY, sig, '')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('webhook secret not configured')
  })

  it('rejects a same-length signature with wrong bytes (timing-safe path)', () => {
    const decoy = signWebhookPayload('different body', SECRET)
    const result = verifyWebhookSignature(BODY, decoy, SECRET)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('signature mismatch')
  })

  it('rejects a signature of the wrong length', () => {
    const result = verifyWebhookSignature(BODY, 'sha256=abc123', SECRET)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('signature length mismatch')
  })

  it('exports the canonical header name in lowercase for header lookups', () => {
    expect(WEBHOOK_SIGNATURE_HEADER).toBe('x-ghin-signature')
  })
})

describe('signWebhookPayload', () => {
  it('is deterministic for a given body+secret pair', () => {
    expect(signWebhookPayload(BODY, SECRET)).toBe(signWebhookPayload(BODY, SECRET))
  })

  it('changes when body changes', () => {
    expect(signWebhookPayload(BODY, SECRET)).not.toBe(signWebhookPayload(`${BODY} `, SECRET))
  })

  it('changes when secret changes', () => {
    expect(signWebhookPayload(BODY, SECRET)).not.toBe(signWebhookPayload(BODY, 'other-secret'))
  })
})
