import { z } from 'zod'
import { schemaCacheClient } from './cache-client'
import type { GhinDegradation } from './degradation'
import { boolean, string } from './validation'

export const schemaClientConfig = z.object({
  apiAccess: boolean.optional(),
  apiVersion: string.optional(),
  baseUrl: string.optional(),
  cache: schemaCacheClient.optional(),
  /**
   * Called when a response arrived smaller than GHIN sent it because some rows
   * failed validation. Wire this to your error tracker — it is the only signal
   * that GHIN changed a payload, and it fires before a user reports a blank
   * screen. See {@link GhinDegradation}.
   */
  onDegraded: z.custom<(event: GhinDegradation) => void>((value) => typeof value === 'function').optional(),
  password: string,
  username: string,
})

export type ClientConfig = z.infer<typeof schemaClientConfig>
