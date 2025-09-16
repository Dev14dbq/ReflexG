import express from 'express'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'
import { ENV } from '@/config/env'
import type { Prisma } from '../../generated/prisma'

const ChatSettingsDto = z.object({
  initData: z.string().min(1),
  pinned: z.array(z.string()).optional(),
  archive: z.array(z.string()).optional(),
  topic: z.string().nullable().optional()
})

const router = express.Router()

function serializeChatSettings(settings: any) {
  if (!settings) return null
  return {
    userId: String(settings.userId),
    pinned: settings.pinned,
    archive: settings.archive,
    topic: settings.topic,
  }
}

// ===== Chat Settings =====

router.get('/settings/chat', async (req: express.Request, res: express.Response) => {
  const initData = req.query.initData as string
  if (!initData) return res.status(400).json({ message: 'initData query parameter is required' })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    const chatSettings = await prisma.chatSettings.findUnique({
        where: { userId: telegramId },
    })

    return res.json({ ok: true, settings: serializeChatSettings(chatSettings) })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// POST роут для обновления настроек чата
router.post('/settings/chat', async (req: express.Request, res: express.Response) => {
  const parsed = ChatSettingsDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const { initData, pinned, archive, topic } = parsed.data

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    // Обновляем или создаем настройки чата
    const chatSettings = await prisma.chatSettings.upsert({
      where: { userId: telegramId },
      update: {
        pinned: pinned || [],
        archive: archive || [],
        topic: topic || null
      },
      create: {
        userId: telegramId,
        pinned: pinned || [],
        archive: archive || [],
        topic: topic || null
      }
    })

    return res.json({ ok: true, settings: serializeChatSettings(chatSettings) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

export const settingsChatRouter = router