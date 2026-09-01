import { z } from 'zod'
import { float, gender, handicap, number, partitionRows, string, teeSetSide } from '../../../../models'

const schemaCourseHandicapGetRequest = z.object({
  golfer_id: number,
  course_id: number,
  tee_set_id: number,
  tee_set_side: teeSetSide,
  played_at: string,
  gender,
})

type CourseHandicapGetRequest = z.infer<typeof schemaCourseHandicapGetRequest>

// `handicap_index` goes through the `handicap` helper. A WHS status suffix is a
// real value, not malformed data: GHIN returned `"19.1M"` in production and
// `float` (`z.coerce.number()`) turned it into NaN, which dropped the golfer
// from `golfers.search` (#56). This response is a plain array, so the same
// suffix here fails the whole batch — a foursome with one `M`/`WD` player
// returns nothing for anyone. `course_handicap` deliberately stays `float`: it
// carries the `z.coerce.number()` `null` -> `0` hazard, which is #63's
// repo-wide call to make, not this issue's.
const schemaCourseHandicapEntry = z
  .object({
    golfer_id: number,
    course_handicap: float,
    handicap_index: handicap.nullish(),
  })
  .passthrough()

type CourseHandicapEntry = z.infer<typeof schemaCourseHandicapEntry>

// Rows are parsed individually: one entry GHIN sends malformed used to reject
// every golfer beside it, so a foursome came back empty because of one bad row.
// Rejects come back raw in `invalid` so the caller can log what GHIN actually
// sent rather than discovering it during an outage.
const schemaCourseHandicapsGetResponse = z
  .object({
    course_handicaps: z.array(z.unknown()),
  })
  .transform(({ course_handicaps }) => {
    const { valid, invalid } = partitionRows(schemaCourseHandicapEntry, course_handicaps)
    return { course_handicaps: valid, invalid }
  })

type CourseHandicapsGetResponse = z.infer<typeof schemaCourseHandicapsGetResponse>

export { schemaCourseHandicapEntry, schemaCourseHandicapGetRequest, schemaCourseHandicapsGetResponse }
export type { CourseHandicapEntry, CourseHandicapGetRequest, CourseHandicapsGetResponse }
