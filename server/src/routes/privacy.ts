import express from 'express'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'
import { ENV } from '@/config/env'
import { AutoDeletePeriod } from '../../generated/prisma'

const router = express.Router()

// Схемы валидации
const PrivacySettingsDto = z.object({
  initData: z.string().min(1),
  autoDeleteMessages: z.nativeEnum(AutoDeletePeriod).optional(),
  allowDataForTraining: z.boolean().optional()
})

const BlacklistActionDto = z.object({
  initData: z.string().min(1),
  action: z.enum(['add', 'remove', 'clear']),
  targetUserId: z.string().optional() // Для add/remove
})

const ArchiveActionDto = z.object({
  initData: z.string().min(1),
  action: z.enum(['clear'])
})

const LikesHistoryActionDto = z.object({
  initData: z.string().min(1),
  action: z.enum(['clear'])
})

// ===== Получение всех настроек конфиденциальности =====

router.get('/privacy/settings', async (req: express.Request, res: express.Response) => {
  const initData = req.query.initData as string
  if (!initData) return res.status(400).json({ message: 'initData query parameter is required' })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    // Получаем настройки пользователя
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: telegramId }
    })

    // Получаем черный список
    const blacklist = await prisma.blacklist.findMany({
      where: { userId: telegramId },
      include: {
        blockedUser: {
          select: {
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Получаем архивные чаты
    const archivedChats = await prisma.chatSettings.findUnique({
      where: { userId: telegramId },
      select: { archive: true }
    })

    // Получаем историю лайков
    const likesHistory = await prisma.like.findMany({
      where: { userId: telegramId },
      include: {
        target: {
          select: {
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Ограничиваем для производительности
    })

    return res.json({
      ok: true,
      settings: {
        autoDeleteMessages: userSettings?.autoDeleteMessages || AutoDeletePeriod.HALF_YEAR,
        allowDataForTraining: userSettings?.allowDataForTraining ?? true
      },
      blacklist: blacklist.map(item => ({
        id: String(item.blockedUserId),
        username: item.blockedUser.username,
        firstName: item.blockedUser.firstName,
        lastName: item.blockedUser.lastName,
        photoUrl: item.blockedUser.photoUrl,
        blockedAt: item.createdAt
      })),
      archive: archivedChats?.archive || [],
      likesHistory: likesHistory.map(like => ({
        id: String(like.targetUserId),
        username: like.target.username,
        firstName: like.target.firstName,
        lastName: like.target.lastName,
        photoUrl: like.target.photoUrl,
        isLike: like.isLike,
        createdAt: like.createdAt
      }))
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// ===== Обновление настроек конфиденциальности =====

router.post('/privacy/settings', async (req: express.Request, res: express.Response) => {
  const parsed = PrivacySettingsDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const { initData, autoDeleteMessages, allowDataForTraining } = parsed.data

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    // Обновляем или создаем настройки пользователя
    const userSettings = await prisma.userSettings.upsert({
      where: { userId: telegramId },
      update: {
        autoDeleteMessages: autoDeleteMessages || AutoDeletePeriod.HALF_YEAR,
        allowDataForTraining: allowDataForTraining ?? true
      },
      create: {
        userId: telegramId,
        autoDeleteMessages: autoDeleteMessages || AutoDeletePeriod.HALF_YEAR,
        allowDataForTraining: allowDataForTraining ?? true
      }
    })

    return res.json({
      ok: true,
      settings: {
        autoDeleteMessages: userSettings.autoDeleteMessages,
        allowDataForTraining: userSettings.allowDataForTraining
      }
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// ===== Управление черным списком =====

router.post('/privacy/blacklist', async (req: express.Request, res: express.Response) => {
  const parsed = BlacklistActionDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const { initData, action, targetUserId } = parsed.data

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    if (action === 'add' && targetUserId) {
      const targetId = BigInt(targetUserId)
      
      // Проверяем, что пользователь не блокирует сам себя
      if (telegramId === targetId) {
        return res.status(400).json({ message: 'Cannot block yourself' })
      }

      // Добавляем в черный список
      await prisma.blacklist.upsert({
        where: {
          userId_blockedUserId: {
            userId: telegramId,
            blockedUserId: targetId
          }
        },
        update: {},
        create: {
          userId: telegramId,
          blockedUserId: targetId
        }
      })

      return res.json({ ok: true, message: 'User added to blacklist' })
    }

    if (action === 'remove' && targetUserId) {
      const targetId = BigInt(targetUserId)
      
      // Удаляем из черного списка
      await prisma.blacklist.deleteMany({
        where: {
          userId: telegramId,
          blockedUserId: targetId
        }
      })

      return res.json({ ok: true, message: 'User removed from blacklist' })
    }

    if (action === 'clear') {
      // Очищаем весь черный список
      await prisma.blacklist.deleteMany({
        where: { userId: telegramId }
      })

      return res.json({ ok: true, message: 'Blacklist cleared' })
    }

    return res.status(400).json({ message: 'Invalid action' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// ===== Управление архивом =====

router.post('/privacy/archive', async (req: express.Request, res: express.Response) => {
  const parsed = ArchiveActionDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const { initData, action } = parsed.data

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    if (action === 'clear') {
      // Очищаем архив
      await prisma.chatSettings.upsert({
        where: { userId: telegramId },
        update: { archive: [] },
        create: { userId: telegramId, archive: [] }
      })

      return res.json({ ok: true, message: 'Archive cleared' })
    }

    return res.status(400).json({ message: 'Invalid action' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// ===== Управление историей лайков =====

router.post('/privacy/likes-history', async (req: express.Request, res: express.Response) => {
  const parsed = LikesHistoryActionDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const { initData, action } = parsed.data

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    if (action === 'clear') {
      // Очищаем историю лайков
      await prisma.like.deleteMany({
        where: { userId: telegramId }
      })

      return res.json({ ok: true, message: 'Likes history cleared' })
    }

    return res.status(400).json({ message: 'Invalid action' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

export const privacyRouter = router
