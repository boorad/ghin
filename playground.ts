import { GhinClient } from './src'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GHIN_PASSWORD: string
      GHIN_USERNAME: string
    }
  }
}

const fn = async () => {
  const ghinClient = new GhinClient({
    password: process.env.GHIN_PASSWORD as string,
    username: process.env.GHIN_USERNAME as string,
  })

  try {
    const golfer = await ghinClient.golfers.getOne(Number(process.env.GHIN_USERNAME))
    if (golfer) {
      console.dir(golfer, { depth: null })
    } else {
      console.log('Golfer not found')
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

fn()
