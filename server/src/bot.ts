import { createBot } from '@/bot/index'

export function startBot() {
    const bot = createBot()

    if (bot) {
        bot.start().then(() => {
            console.log('Bot started')
        }).catch(err => {
            console.error('Bot start failed:', err)
        })
    }
}