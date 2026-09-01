import { z } from 'zod'
import { boolean, handicap, number, string } from '../../../../models'
import {
  type CoursePercentPlayerHandicap,
  type InvalidCoursePlayerHandicap,
  schemaCoursePercentPlayerHandicap,
} from './course-player-handicap'

const schemaGolferHandicapClub = z.object({
  active: boolean,
  association_id: number,
  club_name: string,
  id: number,
})

const schemaGolferHandicapResponse = z
  .object({
    golfer: z.object({
      clubs: z.array(schemaGolferHandicapClub),
      // `handicap_index` is an explicit `null` on the wire for a golfer with no
      // established index (staging golfer 13373258), so this is `.nullable()` and
      // not `.nullish()` — GHIN sends the key, it does not drop it. Before #63 a
      // bare `handicap` tried `float` (`z.coerce.number()`) first and
      // `Number(null) === 0`, so `handicaps.getOne` reported that golfer as
      // scratch. `handicap` now maps `null` / `''` / `'NH'` / `'-'` to `null` at
      // the source; the wrapper is kept so this schema reads the same as
      // `course_handicap` and `playing_handicap` in its two siblings.
      handicap_index: handicap.nullable(),
    }),
  })
  .passthrough()

type HandicapResponse = z.infer<typeof schemaGolferHandicapResponse>

// All twenty buckets stay required, deliberately. Row-level leniency exists for
// data variance — one golfer whose values GHIN sends in a shape we haven't
// modelled — and it is safe there because the dropped row is reported through
// `onDegraded`. A missing percentage bucket is not data variance; it is the
// endpoint changing shape, and `GhinDegradation` has no way to report it (there
// is no raw row to sample). Making the buckets `.nullish()` would therefore trade
// a loud `ValidationError` for a silent `undefined` at every call site, which is
// the outcome `src/models/degradation.ts` exists to prevent.
const schemaCoursePlayerHandicapPercentages = {
  100: schemaCoursePercentPlayerHandicap,
  95: schemaCoursePercentPlayerHandicap,
  90: schemaCoursePercentPlayerHandicap,
  85: schemaCoursePercentPlayerHandicap,
  80: schemaCoursePercentPlayerHandicap,
  75: schemaCoursePercentPlayerHandicap,
  70: schemaCoursePercentPlayerHandicap,
  65: schemaCoursePercentPlayerHandicap,
  60: schemaCoursePercentPlayerHandicap,
  55: schemaCoursePercentPlayerHandicap,
  50: schemaCoursePercentPlayerHandicap,
  45: schemaCoursePercentPlayerHandicap,
  40: schemaCoursePercentPlayerHandicap,
  35: schemaCoursePercentPlayerHandicap,
  30: schemaCoursePercentPlayerHandicap,
  25: schemaCoursePercentPlayerHandicap,
  20: schemaCoursePercentPlayerHandicap,
  15: schemaCoursePercentPlayerHandicap,
  10: schemaCoursePercentPlayerHandicap,
  5: schemaCoursePercentPlayerHandicap,
}

type CoursePlayerHandicapPercent = keyof typeof schemaCoursePlayerHandicapPercentages

// The percentage buckets stay indexed exactly as GHIN sends them
// (`response[100][golferId]`), and the golfers that were dropped are hoisted into
// a single `invalid` alongside them.
//
// Hoisted rather than left per-bucket because GHIN echoes the same golfer set in
// all twenty buckets: a golfer whose row is malformed is malformed twenty times
// over, and that is one dropped golfer, not twenty. `invalid` is deduplicated by
// `golfer_id` so `onDegraded` fires once with a count a human can act on.
type CoursePlayerHandicapsResponse = Record<CoursePlayerHandicapPercent, CoursePercentPlayerHandicap> & {
  invalid: InvalidCoursePlayerHandicap[]
}

const schemaCoursePlayerHandicapsResponse = z
  .object(schemaCoursePlayerHandicapPercentages)
  .transform((buckets): CoursePlayerHandicapsResponse => {
    const handicaps = {} as Record<CoursePlayerHandicapPercent, CoursePercentPlayerHandicap>
    const invalid = new Map<string, InvalidCoursePlayerHandicap>()

    for (const [percent, bucket] of Object.entries(buckets)) {
      handicaps[Number(percent) as CoursePlayerHandicapPercent] = bucket.handicaps

      for (const reject of bucket.invalid) {
        if (!invalid.has(reject.golfer_id)) {
          invalid.set(reject.golfer_id, reject)
        }
      }
    }

    return { ...handicaps, invalid: [...invalid.values()] }
  })

export { schemaCoursePlayerHandicapsResponse, schemaGolferHandicapResponse }
export type { CoursePlayerHandicapPercent, CoursePlayerHandicapsResponse, HandicapResponse }
