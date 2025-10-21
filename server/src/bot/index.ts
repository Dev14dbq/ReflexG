import { Bot, InlineKeyboard } from 'grammy'
import { ENV } from '@/config/env'
import { getUserRole } from '@/services/auth'

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
      'Добро пожаловать в Okeano (ранее Reflex) 🏳️‍🌈',
      '',
      'Здесь знакомятся ЛГБТК+ персоны из СНГ — быстро, безопасно и прямо в Telegram. Все профили проходят верификацию.',
      '',
      'Мы создали эксклюзивное сообщество для приятных знакомств с реальными людьми из СНГ.',
      '',
      linkHtml
    ].join('\n')

    const kb = new InlineKeyboard()
    if (startAppUrl) kb.url('Открыть Okeano', startAppUrl)
    
    // Проверяем роль пользователя и добавляем кнопку админки
    try {
      if (ctx.from) {
        const userRole = await getUserRole(BigInt(ctx.from.id))
        if (userRole === 'MODERATOR' || userRole === 'ADMIN') {
          const adminUrl = startAppUrl ? startAppUrl.replace('?startapp', '/admin') : undefined
          if (adminUrl) {
            kb.row().url('🔐 Админ панель', adminUrl)
          }
        }
      }
    } catch (error) {
      console.error('Failed to check user role for bot:', error)
    }

    const imgUrl = 'https://imagedelivery.net/tiG5wLsWR2QYY4sb4--BKw/f2aa1a15-74ba-45d0-52cd-7f8b5f130b00/avatar'
    try {
      await ctx.replyWithPhoto(imgUrl, { caption: text, reply_markup: kb, parse_mode: 'HTML' })
    } catch {
      await ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' })
    }
  })

  return bot
}


