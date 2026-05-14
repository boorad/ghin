import { GhinClient } from '../index'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GHIN_PASSWORD: string
      GHIN_USERNAME: string
      GHIN_API_ACCESS: string
      GHIN_API_VERSION: string
      GHIN_BASE_URL: string
      GHIN_WEBHOOK_URL: string
    }
  }
}

const fn = async () => {
  const ghinClient = new GhinClient({
    password: process.env.GHIN_PASSWORD,
    username: process.env.GHIN_USERNAME,
    apiAccess: process.env.GHIN_API_ACCESS === 'true',
    apiVersion: process.env.GHIN_API_VERSION,
    baseUrl: process.env.GHIN_BASE_URL,
  })

  const webhookUrl = process.env.GHIN_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('Set GHIN_WEBHOOK_URL to a public URL (e.g. webhook.site) before running')
    process.exit(1)
  }

  try {
    console.log('-- current webhook settings --')
    const current = await ghinClient.webhooks.get()
    console.dir(current, { depth: null })

    console.log('-- registering revision webhook --')
    const patched = await ghinClient.webhooks.patch({
      webhook_url: { revision: webhookUrl },
      webhook_data_type: { revision: 'changes_only' },
      webhook_enabled: { revision: true },
    })
    console.dir(patched, { depth: null })

    console.log('-- firing test revision event --')
    const test = await ghinClient.webhooks.test('revision')
    console.dir(test, { depth: null })

    console.log('-- listing recent deliveries --')
    const list = await ghinClient.webhooks.list({ page: 1, per_page: 5, object_type: 'revision' })
    console.dir(list, { depth: null })

    const first = list.webhooks[0]
    if (first) {
      console.log(`-- resending webhook id=${first.id} --`)
      const resend = await ghinClient.webhooks.resend({ webhook_id: first.id })
      console.dir(resend, { depth: null })
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

fn()
