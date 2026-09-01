import { z } from 'zod'
import { handicap, string } from '../../../../models'

// A golfer with no established Handicap Index comes back as
// `{ playing_handicap: null, playing_handicap_display: 'NH', shots_off: '-' }`,
// and `shots_off` is a string on the wire even for established golfers (`'1'`).
// Declaring either as `number` (`z.coerce.number()`) made `Number('-')` = `NaN`
// and threw `ValidationError` for the whole request — reproduced on
// api-uat.ghin.com, where adding NH golfer 13373258 to a foursome of three
// established golfers lost all four.
//
// `handicap` must be wrapped in `.nullable()`: bare, its inner union tries
// `float` first and `Number(null) === 0`, which would fabricate a scratch
// handicap for a golfer who has none.
const schemaPlayerCourseHandicap = z.object({
  playing_handicap: handicap.nullable(),
  playing_handicap_display: string,
  shots_off: handicap.nullable(),
})

type CoursePlayerHandicap = z.infer<typeof schemaPlayerCourseHandicap>

const schemaCoursePercentPlayerHandicap = z.record(string, schemaPlayerCourseHandicap)

type CoursePercentPlayerHandicap = z.infer<typeof schemaCoursePercentPlayerHandicap>

export type { CoursePlayerHandicap, CoursePercentPlayerHandicap }
export { schemaCoursePercentPlayerHandicap, schemaPlayerCourseHandicap }
