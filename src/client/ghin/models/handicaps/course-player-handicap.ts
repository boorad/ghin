import { z } from 'zod'
import { handicap, partitionRows, string } from '../../../../models'

// A golfer with no established Handicap Index comes back as
// `{ playing_handicap: null, playing_handicap_display: 'NH', shots_off: '-' }`,
// and `shots_off` is a string on the wire even for established golfers (`'1'`).
// Declaring either as `number` (`z.coerce.number()`) made `Number('-')` = `NaN`
// and threw `ValidationError` for the whole request — reproduced on
// api-uat.ghin.com, where adding NH golfer 13373258 to a foursome of three
// established golfers lost all four.
//
// Before #63 a bare `handicap` tried `float` first and `Number(null) === 0`,
// which fabricated a scratch handicap for a golfer who has none. `handicap` now
// maps null to null at the source; `.nullable()` is kept so the intent is
// explicit at the field.
const schemaPlayerCourseHandicap = z.object({
  playing_handicap: handicap.nullable(),
  playing_handicap_display: string,
  shots_off: handicap.nullable(),
})

type CoursePlayerHandicap = z.infer<typeof schemaPlayerCourseHandicap>

/** The golfers in one percentage bucket that parsed, keyed by `golfer_id`. */
type CoursePercentPlayerHandicap = Record<string, CoursePlayerHandicap>

/**
 * A golfer dropped from a percentage bucket: which `golfer_id` was lost, and the
 * value GHIN sent for them, raw and untransformed.
 *
 * The row is a bare `unknown` rather than a Zod issue list for the usual reason —
 * an issue list describes the shape we expected, not the shape we got. The
 * `golfer_id` rides alongside it because this payload addresses golfers by record
 * key, so the key is the only thing identifying the reject; nothing inside the
 * row names the golfer.
 */
type InvalidCoursePlayerHandicap = {
  golfer_id: string
  row: unknown
}

type CoursePercentPlayerHandicapResult = {
  handicaps: CoursePercentPlayerHandicap
  invalid: InvalidCoursePlayerHandicap[]
}

// `partitionRows` works on an array, and this bucket is a record, so each entry
// is paired with its key on the way in. That pairing is also exactly the shape a
// reject surfaces as, which keeps the raw row untouched inside `row`.
const schemaCoursePlayerHandicapEntry = z.object({
  golfer_id: string,
  row: schemaPlayerCourseHandicap,
})

// Golfers are parsed individually. Fixing `playing_handicap` and `shots_off` only
// closed the two values GHIN was known to send; the bucket was still
// all-or-nothing, so the next unmodelled status string (`'N/A'`, a new suffix,
// anything the `handicap` helper rejects) for one golfer would again cost the
// caller the whole foursome, silently, with no `onDegraded` to report it.
const schemaCoursePercentPlayerHandicap = z
  .record(string, z.unknown())
  .transform((bucket): CoursePercentPlayerHandicapResult => {
    const entries = Object.entries(bucket).map(([golfer_id, row]) => ({ golfer_id, row }))
    const { valid, invalid } = partitionRows(schemaCoursePlayerHandicapEntry, entries)

    return {
      handicaps: Object.fromEntries(valid.map(({ golfer_id, row }) => [golfer_id, row])),
      // Sound by construction: `partitionRows` hands back the very elements it
      // was given, and every one of them was built as an entry just above.
      invalid: invalid as InvalidCoursePlayerHandicap[],
    }
  })

export type {
  CoursePercentPlayerHandicap,
  CoursePercentPlayerHandicapResult,
  CoursePlayerHandicap,
  InvalidCoursePlayerHandicap,
}
export { schemaCoursePercentPlayerHandicap, schemaCoursePlayerHandicapEntry, schemaPlayerCourseHandicap }
