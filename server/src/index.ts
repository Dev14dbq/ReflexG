import 'dotenv/config'
import { createApp } from '@/app'
import { ENV } from '@/config/env'

const app = createApp()
app.listen(ENV.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API on :${ENV.PORT}`)
})
