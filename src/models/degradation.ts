/**
 * Emitted when a response parsed successfully but arrived smaller than GHIN
 * sent it — some rows failed validation and were dropped so the rest could
 * still reach the caller.
 *
 * This is the signal that GHIN changed a payload. Without it, degradation is
 * indistinguishable from a genuinely short response: "this course has 3 tees"
 * reads as working software. Three outages (issues #46, #51, and
 * `LegacyCRPTeeId` on 2026-08-19) were each found by a human noticing a broken
 * screen, not by a system noticing bad data.
 */
export interface GhinDegradation {
  /** Which call degraded, e.g. `courses_details`, `golfers_search`. */
  entity: string
  /** How many rows were dropped. */
  dropped: number
  /** How many rows GHIN sent in total. */
  total: number
  /**
   * The rejected rows, raw and untransformed, capped at
   * {@link DEGRADATION_SAMPLE_LIMIT}. Raw because the whole point is seeing
   * exactly what GHIN sent — a Zod issue list tells you the shape you expected,
   * not the shape you got.
   */
  sample: unknown[]
}

/**
 * Cap on {@link GhinDegradation.sample}. A search can drop hundreds of rows for
 * one root cause; the first few are diagnostic and the rest are noise that would
 * bloat whatever log or error tracker receives them.
 */
export const DEGRADATION_SAMPLE_LIMIT = 3

/**
 * Report dropped rows through `onDegraded`, if the caller supplied one.
 *
 * Never throws: a broken reporting callback must not turn a working GHIN
 * response into a failed one. Reporting is strictly a side channel.
 *
 * @param onDegraded - Caller's handler, if configured.
 * @param entity - Which call degraded.
 * @param invalid - The rejected raw rows.
 * @param total - Row count GHIN sent, before any were dropped.
 */
export function reportDegradation(
  onDegraded: ((event: GhinDegradation) => void) | undefined,
  entity: string,
  invalid: unknown[],
  total: number,
): void {
  if (!onDegraded || invalid.length === 0) {
    return
  }

  try {
    onDegraded({
      entity,
      dropped: invalid.length,
      total,
      sample: invalid.slice(0, DEGRADATION_SAMPLE_LIMIT),
    })
  } catch {
    // A throwing reporter is the caller's bug, not a reason to fail their request.
  }
}
