import { describe, expect, it } from 'vitest'
import { ValidationError } from '../errors'
import { parseWebhookEnvelope } from './parse-envelope'

const makeEnvelope = (overrides: { payload?: Record<string, unknown>; id?: number; status?: string } = {}) => {
  const { payload: payloadOverrides, ...rest } = overrides
  return {
    id: 42,
    status: 'sent',
    ...rest,
    payload: {
      object: { foo: 'bar' },
      object_type: 'revision',
      action: 'created',
      webhook_key: 'abc123',
      webhook_sent_at: '2026-05-12T12:00:00Z',
      environment: 'sandbox',
      ...(payloadOverrides ?? {}),
    },
  }
}

describe('parseWebhookEnvelope', () => {
  it.each(['revision', 'score', 'golfer', 'club', 'course', 'gpa'] as const)(
    'accepts a valid envelope for object_type=%s',
    (objectType) => {
      const result = parseWebhookEnvelope(makeEnvelope({ payload: { object_type: objectType, object: { id: 1 } } }))
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.payload.object_type).toBe(objectType)
        expect(result.value.id).toBe(42)
      }
    },
  )

  it('preserves the object field verbatim and allows narrowing via generic', () => {
    interface RevisionObject {
      golfer_id: number
      hi_value: number
    }
    const body = makeEnvelope({
      payload: { object_type: 'revision', object: { golfer_id: 1234567, hi_value: 12.3 } },
    })

    const result = parseWebhookEnvelope<RevisionObject>(body)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.payload.object.golfer_id).toBe(1234567)
      expect(result.value.payload.object.hi_value).toBe(12.3)
    }
  })

  it('accepts not-sent status on listing replays', () => {
    const result = parseWebhookEnvelope(makeEnvelope({ status: 'not sent' }))
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.status).toBe('not sent')
    }
  })

  it('rejects an unknown object_type', () => {
    const result = parseWebhookEnvelope(makeEnvelope({ payload: { object_type: 'tournament' } }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ValidationError)
    }
  })

  it('rejects an envelope missing payload', () => {
    const result = parseWebhookEnvelope({ id: 1, status: 'sent' })
    expect(result.isErr()).toBe(true)
  })

  it('rejects an envelope missing id', () => {
    const result = parseWebhookEnvelope({ payload: makeEnvelope().payload, status: 'sent' })
    expect(result.isErr()).toBe(true)
  })

  it('rejects null/non-object payloads', () => {
    expect(parseWebhookEnvelope(null).isErr()).toBe(true)
    expect(parseWebhookEnvelope('not json').isErr()).toBe(true)
    expect(parseWebhookEnvelope([makeEnvelope()]).isErr()).toBe(true)
  })

  it('allows an array-valued object field (envelope still wraps a single delivery)', () => {
    const result = parseWebhookEnvelope(makeEnvelope({ payload: { object: [{ id: 1 }, { id: 2 }] } }))
    expect(result.isOk()).toBe(true)
  })
})
