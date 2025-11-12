import { z } from 'zod'

const schemaGeoCoordinate = z.preprocess((value) => {
  // Handle missing, null, or empty values
  if (value === undefined || value === null || value === '') {
    return null
  }
  // Handle string numbers
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  // Handle actual numbers
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value
  }
  return null
}, z.number().nullable())

export { schemaGeoCoordinate }
