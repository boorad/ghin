import { z } from 'zod'

const schemaSeasonDate = z.preprocess((value) => {
  // Handle missing, null, or empty values
  if (value === undefined || value === null || value === '') {
    return null
  }
  return value
}, z.string().nullable())

const schemaSeasonName = z.preprocess((value) => {
  // Handle missing, null, or empty values
  if (value === undefined || value === null || value === '') {
    return null
  }
  return value
}, z.string().nullable())

export { schemaSeasonDate, schemaSeasonName }
