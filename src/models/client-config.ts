import { z } from 'zod'
import { schemaCacheClient } from './cache-client'
import { boolean, string } from './validation'

export const schemaClientConfig = z.object({
  apiAccess: boolean.optional(),
  apiVersion: string.optional(),
  baseUrl: string.optional(),
  cache: schemaCacheClient.optional(),
  password: string,
  username: string,
})

export type ClientConfig = z.infer<typeof schemaClientConfig>
