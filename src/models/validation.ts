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

/**
 * GHIN's numeric "no handicap" sentinel. The WHS maximum Handicap Index is 54.0,
 * so `999` cannot be a real index, course handicap, playing handicap or shots-off
 * value — it is unambiguously a marker, the numeric twin of the `"NH"` string GHIN
 * sends in the matching display field.
 *
 * Confirmed against `api-uat.ghin.com` on 2026-09-01: `golfers.search` returns
 * `hi_value: 999` and `low_hi_value: 999` for staging golfer 13373258 (whose
 * `hi_display` is `"NH"`), and `low_hi_value: 999` for established golfer 13373246,
 * who simply has no recorded low index; `getScores` returns `handicap_index: 999`
 * and `net_score: 999` on scores predating an index; the `scores.post` response
 * returns `handicap_index: 999` and `net_score: 999` alongside
 * `handicap_index_display: "NH"`.
 *
 * This is the same class of hazard as issue #63 — a number that passes a
 * `typeof x === 'number'` guard but is not a real handicap — so it is mapped to
 * `null` here. It deliberately does not live in `float` / `number` / `strictFloat` /
 * `strictNumber`: `999` is a legitimate value for a non-handicap numeric.
 */
const NO_HANDICAP_SENTINEL = 999

// `z.null()` and the blank-string branch are ordered ahead of `float` on purpose:
// `float` is `z.coerce.number()` and `Number(null) === Number('') === Number('  ') === 0`,
// so with `float` first a no-handicap golfer parsed as scratch (issue #63). Unions
// take the first branch that succeeds, so the null-ish inputs must win before
// coercion. The blank branch trims, so whitespace-only reaches the refine as `''`.
export const handicap = z
  .union([z.null(), z.string().trim().length(0), float, z.string()])
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

    let parsed: number | null
    if (typeof value === 'string') {
      const match = value.match(HANDICAP_WITH_SUFFIX)
      // Sign handling is unchanged from the plain-number path: `float` is
      // `z.coerce.number()`, so a leading `+` on a plus handicap already parsed
      // to a positive number and callers apply their own plus convention.
      parsed = match?.[1] ? Number(match[1]) : null
    } else {
      parsed = value
    }

    // Checked once, after the suffix parsing, so every branch that can yield a
    // number is covered — the bare `999`, the numeric string `'999'` that `float`
    // coerces, and a suffixed `'999M'` alike.
    return parsed === NO_HANDICAP_SENTINEL ? null : parsed
  })

export const number = float.int()

// ponytail: `float` is `z.coerce.number()` and `Number(null) === Number('') === 0`, so a required
// `float` accepts an explicit null as a fabricated 0 that passes a `typeof x === 'number'` guard
// (issue #63). `strictFloat` / `strictNumber` reject null and blank strings (including
// whitespace-only, which `Number` also coerces to 0) outright — they fail the same way a missing
// key does, not as 0 — while still coercing genuine numeric strings, for fields a consumer
// computes on. They are `ZodEffects`, so use `float` / `number` where a ZodNumber method
// (`.int` / `.min` / `.max` / `.positive`) is needed, or where a null is salvageable.
const blankToUndefined = (value: unknown) =>
  value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value
export const strictFloat = z.preprocess(blankToUndefined, float)
export const strictNumber = z.preprocess(blankToUndefined, number)
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
