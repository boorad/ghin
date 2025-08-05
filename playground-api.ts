import { GhinClient } from './src'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GHIN_PASSWORD: string
      GHIN_USERNAME: string,
      GHIN_API_ACCESS: string,
      GHIN_API_VERSION: string,
      GHIN_BASE_URL: string,
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
    const golfers = await ghinClient.golfers.search({
      country: 'USA',
      last_name: 'smi%',
      first_name: 's%',
      status: 'Active',
    })
    if (golfers) {
      console.dir(golfers, { depth: null })
    } else {
      console.log('Golfers not found')
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

fn()
