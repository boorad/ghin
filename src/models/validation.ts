import { z } from 'zod'
import { parseISO, isValid, parse } from 'date-fns'

export const boolean = z
  .union([z.boolean(), z.literal('true'), z.literal('false'), z.null()])
  .transform((value) => value === true || value === 'true')

export const date = z
  .union([z.date(), z.string(), z.null(), z.undefined()])
  .refine((value) => {
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
        'MMMM dd, yyyy',  // September 15, 2022
        'MMM dd, yyyy',   // Sep 15, 2022
        'MMM dd yyyy',    // Sep 15 2022
        'dd MMM yyyy'     // 15 Sep 2022
      ]
      
      return formats.some(format => {
        try {
          parsed = parse(value, format, new Date())
          return isValid(parsed)
        } catch {
          return false
        }
      })
    }
    
    return false
  }, {
    message: 'Invalid date',
  })
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
        'MMMM dd, yyyy',  // September 15, 2022
        'MMM dd, yyyy',   // Sep 15, 2022
        'MMM dd yyyy',    // Sep 15 2022
        'dd MMM yyyy'     // 15 Sep 2022
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

export const handicap = z
  .union([float, z.string(), z.null()])
  .refine((value) => {
    if (typeof value === 'number') {
      return true
    }

    if (typeof value === 'string' && (value === 'NH' || value === '-')) {
      return true
    }

    return false
  })
  .transform((value) => {
    if (value === 'NH' || value === '-') {
      return null
    }

    return value
  })

export const number = float.int()
export const string = emptyString.min(1)

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
