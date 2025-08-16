import { Bot, InlineKeyboard } from 'grammy'
import { ENV } from '@/config/env'

export function createBot(): Bot | null {
  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return null

  const bot = new Bot(token)
  const username = ENV.TELEGRAM_BOT_USERNAME || ''
  const startAppUrl = username ? `https://t.me/${username}?startapp` : undefined

  bot.command('start', async ctx => {
    const linkHtml = startAppUrl
      ? `<a href="${startAppUrl}">Создайте анкету и смотрите, кто рядом</a>`
      : 'Создайте анкету и смотрите, кто рядом'
    const text = [
      'Добро пожаловать в Reflex 🏳️‍🌈',
      '',
      'Здесь знакомятся ЛГБТК+ персоны из СНГ — быстро, безопасно и прямо в Telegram. Все профили проходят верификацию.',
      '',
      'Мы создали эксклюзивное сообщество для приятных знакомств с реальными людьми из СНГ.',
      '',
      linkHtml
    ].join('\n')

    const kb = new InlineKeyboard()
    if (startAppUrl) kb.url('Открыть Reflex', startAppUrl)

    const imgUrl = 'https://cdn.spectrmod.ru/Reflex.png'
    try {
      await ctx.replyWithPhoto(imgUrl, { caption: text, reply_markup: kb, parse_mode: 'HTML' })
    } catch {
      await ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' })
    }
  })

  return bot
}


