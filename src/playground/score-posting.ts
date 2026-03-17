import { GhinClient } from '../index'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GHIN_PASSWORD: string
      GHIN_USERNAME: string
      GHIN_API_ACCESS: string
      GHIN_API_VERSION: string
      GHIN_BASE_URL: string
    }
  }
}

const fn = async () => {
  const ghinClient = new GhinClient({
    password: process.env.GHIN_PASSWORD as string,
    username: process.env.GHIN_USERNAME as string,
    apiAccess: process.env.GHIN_API_ACCESS === 'true',
    apiVersion: process.env.GHIN_API_VERSION as string,
    baseUrl: process.env.GHIN_BASE_URL as string,
  })

  try {
    // Get tee set ratings for score posting
    console.log('--- Tee Set Ratings for Score Posting ---')
    const teeSetRatings = await ghinClient.courses.getTeeSetRatingsForScorePosting({ course_id: 2539 })
    console.dir(teeSetRatings, { depth: null })

    // Post a hole-by-hole score (replace with actual values)
    // const hbhResult = await ghinClient.scores.postHoleByHole({
    //   golfer_id: '12345',
    //   course_id: '2539',
    //   tee_set_id: '262908',
    //   tee_set_side: 'All18',
    //   played_at: '2026-03-17',
    //   score_type: 'H',
    //   hole_details: Array.from({ length: 18 }, (_, i) => ({
    //     hole_number: i + 1,
    //     raw_score: 4,
    //   })),
    //   number_of_holes: '18',
    //   gender: 'M',
    // })
    // console.log('HBH result:', hbhResult)
  } catch (error) {
    console.error('Error:', error)
  }
}

fn()
