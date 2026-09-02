import { z } from 'zod'

export type CacheClient = {
  read: () => string | undefined | Promise<string | undefined>
  write: (value: string) => void | Promise<void>
}

/**
 * Deliberately `z.custom`, not a `z.object` of `z.function()`s: `z.function()`
 * cannot validate a function without replacing it with an unbound validating
 * wrapper, and `z.object` rebuilds the object, so a caller's `CacheClient`
 * instance (and any state on `this`) never reached the client — pre-seeded
 * tokens were ignored and writes landed in a discarded clone (issue #79).
 * This structural check passes the caller's reference through untouched.
 * Do not "tighten" it back into `z.object({ read: z.function(), ... })`.
 */
export const schemaCacheClient = z.custom<CacheClient>(
  (value) =>
    typeof (value as CacheClient | undefined)?.read === 'function' &&
    typeof (value as CacheClient | undefined)?.write === 'function',
  { message: 'CacheClient must be an object with read() and write(value) functions' },
)
