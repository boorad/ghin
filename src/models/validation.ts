import { isValid, parse, parseISO } from 'date-fns'
import { z } from 'zod'

export const boolean = z
  .union([z.boolean(), z.literal('true'), z.literal('false'), z.null()])
  .transform((value) => value === true || value === 'true')

export const date = z
  .union([z.date(), z.string(), z.null(), z.undefined()])
  .refine(
    (value) => {
      // Handle null, undefined, and empty string as valid (will transform to undefined)
      if (value === null || value === undefined || value === '') {
        return true
      }

      // If it's already a Date object, check if it's valid
      if (value instanceof Date) {
        return isValid(value)
      }

      // For strings, try to parse with date-fns
      if (typeof value === 'string') {
        // Try ISO format first (most common and reliable)
        let parsed = parseISO(value)
        if (isValid(parsed)) {
          return true
        }

        // Try common date formats
        const formats = [
          'yyyy-MM-dd',
          'yyyy/MM/dd',
          'MM/dd/yyyy',
          'dd/MM/yyyy',
          'MMMM dd, yyyy', // September 15, 2022
          'MMM dd, yyyy', // Sep 15, 2022
          'MMM dd yyyy', // Sep 15 2022
          'dd MMM yyyy', // 15 Sep 2022
        ]

        return formats.some((format) => {
          try {
            parsed = parse(value, format, new Date())
            return isValid(parsed)
          } catch {
            return false
          }
        })
      }

      return false
    },
    {
      message: 'Invalid date',
    },
  )
  .transform((value) => {
    // Handle null, undefined, and empty string
    if (value === null || value === undefined || value === '') {
      return undefined
    }

    // If it's already a Date object, return it
    if (value instanceof Date) {
      return value
    }

    // For strings, parse with date-fns
    if (typeof value === 'string') {
      // Try ISO format first
      let parsed = parseISO(value)
      if (isValid(parsed)) {
        return parsed
      }

      // Try common date formats
      const formats = [
        'yyyy-MM-dd',
        'yyyy/MM/dd',
        'MM/dd/yyyy',
        'dd/MM/yyyy',
        'MMMM dd, yyyy', // September 15, 2022
        'MMM dd, yyyy', // Sep 15, 2022
        'MMM dd yyyy', // Sep 15 2022
        'dd MMM yyyy', // 15 Sep 2022
      ]

      for (const format of formats) {
        try {
          parsed = parse(value, format, new Date())
          if (isValid(parsed)) {
            return parsed
          }
        } catch {
          // Continue to next format
        }
      }
    }

    return undefined
  })

const emptyString = z.string().trim()
export const emptyStringToNull = emptyString.nullable().transform((value) => value || null)
export const float = z.coerce.number()
export const gender = z.enum(['M', 'F'])

/**
 * A Handicap Index value carrying a WHS status suffix, e.g. `19.1M` (modified by
 * the Handicap Committee) or `12.4WD` (withdrawn). GHIN returns these in
 * `handicap_index`, and only `hi_display` is guaranteed to be a display string —
 * so the numeric field has to cope with them too.
 */
const HANDICAP_WITH_SUFFIX = /^([+-]?\d+(?:\.\d+)?)[A-Za-z]+$/

// `z.null()` and `''` are ordered ahead of `float` on purpose: `float` is
// `z.coerce.number()` and `Number(null) === Number('') === 0`, so with `float`
// first a no-handicap golfer parsed as scratch (issue #63). Unions take the
// first branch that succeeds, so the null-ish inputs must win before coercion.
export const handicap = z
  .union([z.null(), z.literal(''), float, z.string()])
  .refine((value) => {
    if (value === null || value === '' || typeof value === 'number') {
      return true
    }

    if (value === 'NH' || value === '-') {
      return true
    }

    // A suffixed index is a real value, not malformed data. Rejecting it dropped
    // the entire golfer from `golfers.search` — caught in production, where GHIN
    // returned `"19.1M"` for a golfer who then simply didn't appear in results.
    return typeof value === 'string' && HANDICAP_WITH_SUFFIX.test(value)
  })
  .transform((value) => {
    if (value === null || value === '' || value === 'NH' || value === '-') {
      return null
    }

    if (typeof value === 'string') {
      const match = value.match(HANDICAP_WITH_SUFFIX)
      // Sign handling is unchanged from the plain-number path: `float` is
      // `z.coerce.number()`, so a leading `+` on a plus handicap already parsed
      // to a positive number and callers apply their own plus convention.
      return match?.[1] ? Number(match[1]) : null
    }

    return value
  })

export const number = float.int()

// ponytail: `float` is `z.coerce.number()` and `Number(null) === Number('') === 0`, so a required
// `float` accepts an explicit null as a fabricated 0 that passes a `typeof x === 'number'` guard
// (issue #63). `strictFloat` / `strictNumber` reject null and '' outright — they fail the same way
// a missing key does, not as 0 — while still coercing genuine numeric strings, for fields a
// consumer computes on. They are `ZodEffects`, so use `float` / `number` where a ZodNumber method
// (`.int` / `.min` / `.max` / `.positive`) is needed, or where a null is salvageable.
export const strictFloat = z.preprocess((value) => (value === null || value === '' ? undefined : value), float)
export const strictNumber = z.preprocess((value) => (value === null || value === '' ? undefined : value), number)
export const string = emptyString.min(1)
export const teeSetSide = z.enum(['All18', 'F9', 'B9'])

export const monthDay = string.or(emptyString).transform((value) => {
  if (!value) {
    return null
  }

  const [month, day] = value.split('/')

  return `${month?.toString().padStart(2, '0')}-${day?.toString().padStart(2, '0')}`
})

export const shortDate = z
  .union([z.date(), z.string(), z.null()])
  .refine((value) => (value ? !Number.isNaN(Date.parse(value.toString())) : true), {
    message: 'Invalid date',
  })
  .transform((value) => {
    if (typeof value !== 'string') {
      return value
    }

    const [year, month, day] = value.split('-')

    return new Date(`${year}-${month}-${day}T00:00Z`)
  })

/**
 * Parse each row independently, returning the ones that validated and the raw
 * ones that didn't.
 *
 * The rejects come back untouched rather than as Zod issues so callers can log
 * exactly what GHIN sent — that log is the early warning that GHIN changed a
 * payload again, and it is the only signal that a response silently got smaller.
 *
 * @param schema - Row schema applied to each element.
 * @param rows - Raw rows straight from the upstream payload.
 */
export function partitionRows<T extends z.ZodTypeAny>(
  schema: T,
  rows: unknown[],
): { valid: z.infer<T>[]; invalid: unknown[] } {
  const valid: z.infer<T>[] = []
  const invalid: unknown[] = []

  for (const row of rows) {
    const result = schema.safeParse(row)
    if (result.success) {
      valid.push(result.data)
    } else {
      invalid.push(row)
    }
  }

  return { valid, invalid }
}
