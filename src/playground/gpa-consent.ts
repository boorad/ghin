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
  try {
    const ghinClient = new GhinClient({
      password: process.env.GHIN_PASSWORD as string,
      username: process.env.GHIN_USERNAME as string,
      apiAccess: process.env.GHIN_API_ACCESS === 'true',
      apiVersion: process.env.GHIN_API_VERSION as string,
      baseUrl: process.env.GHIN_BASE_URL as string,
    })

    // List current GPA accesses
    console.log('--- GPA Accesses ---')
    const accesses = await ghinClient.gpa.getAccesses()
    console.dir(accesses, { depth: null })

    // Request access for a golfer (replace with actual golfer ID)
    // const requestResult = await ghinClient.gpa.requestAccess(12345)
    // console.log('Request result:', requestResult)

    // Update status (sandbox/staging only)
    // const updateResult = await ghinClient.gpa.updateStatus({
    //   user_id: 1,
    //   golfer_id: 12345,
    //   status: 'approved',
    // })
    // console.log('Update result:', updateResult)
  } catch (error) {
    console.error('Error:', error)
  }
}

fn()
