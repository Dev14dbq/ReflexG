import 'dotenv/config'
import { startBot } from './bot'
import { createApp } from '@/app'
import { ENV } from '@/config/env'
import { attachWsServer } from '@/ws/index'

const app = createApp()
const server = app.listen(ENV.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API on :${ENV.PORT}`)
})

attachWsServer(server)
startBot()