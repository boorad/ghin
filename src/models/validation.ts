import { z } from 'zod'

export const boolean = z
  .union([z.boolean(), z.literal('true'), z.literal('false'), z.null()])
  .transform((value) => value === true || value === 'true')

export const date = z
  .union([z.date(), z.string()])
  .refine((value) => (value ? !Number.isNaN(Date.parse(value.toString())) : true), {
    message: 'Invalid date',
  })
  .transform((value) => (value ? new Date(value) : undefined))

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
