import { z } from 'zod'
import { float, gender, handicap, number, partitionRows, string, teeSetSide } from '../../../../models'

const schemaPlayingHandicapRequest = z.object({
  golfer_id: number,
  course_id: number,
  tee_set_id: number,
  tee_set_side: teeSetSide,
  played_at: string,
  gender,
})

type PlayingHandicapRequest = z.infer<typeof schemaPlayingHandicapRequest>

// `handicap_index` goes through the `handicap` helper. A WHS status suffix is a
// real value, not malformed data: GHIN returned `"19.1M"` in production and
// `float` (`z.coerce.number()`) turned it into NaN, which dropped the golfer
// from `golfers.search` (#56). This response is a plain array, so the same
// suffix here fails the whole batch — a foursome with one `M`/`WD` player
// returns nothing for anyone. `playing_handicap`/`course_handicap` deliberately
// stay `number`/`float`: they carry the `z.coerce.number()` `null` -> `0`
// hazard, which is #63's repo-wide call to make, not this issue's.
const schemaPlayingHandicapEntry = z
  .object({
    golfer_id: number,
    playing_handicap: number,
    course_handicap: float,
    handicap_index: handicap.nullish(),
  })
  .passthrough()

type PlayingHandicapEntry = z.infer<typeof schemaPlayingHandicapEntry>

// Rows are parsed individually: one entry GHIN sends malformed used to reject
// every golfer beside it, so a foursome came back empty because of one bad row.
// Rejects come back raw in `invalid` so the caller can log what GHIN actually
// sent rather than discovering it during an outage.
const schemaPlayingHandicapsResponse = z
  .object({
    playing_handicaps: z.array(z.unknown()),
  })
  .transform(({ playing_handicaps }) => {
    const { valid, invalid } = partitionRows(schemaPlayingHandicapEntry, playing_handicaps)
    return { playing_handicaps: valid, invalid }
  })

type PlayingHandicapsResponse = z.infer<typeof schemaPlayingHandicapsResponse>

export { schemaPlayingHandicapEntry, schemaPlayingHandicapRequest, schemaPlayingHandicapsResponse }
export type { PlayingHandicapEntry, PlayingHandicapRequest, PlayingHandicapsResponse }
