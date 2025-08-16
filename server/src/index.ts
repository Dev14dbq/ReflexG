import 'dotenv/config'
import { createApp } from '@/app'
import { ENV } from '@/config/env'
import { createBot } from '@/bot/index'
import { attachWsServer } from '@/ws/index'

const app = createApp()
const server = app.listen(ENV.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API on :${ENV.PORT}`)
})

attachWsServer(server)

// start Telegram bot (grammY)
const bot = createBot()
if (bot) {
  bot.start().then(() => {
    // eslint-disable-next-line no-console
    console.log('Bot started')
  }).catch(err => {
    // eslint-disable-next-line no-console
    console.error('Bot start failed:', err)
  })
}
