import express from 'express'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'
import { ENV } from '@/config/env'
import type { Prisma } from '../../generated/prisma'

const router = express.Router()

// ===== Schemas =====

const SubmitBaseProfileDto = z.object({
  initData: z.string().min(1),
  city: z.string().min(1).max(128),
  displayName: z.string().min(2).max(16).regex(/^[А-Яа-яЁё]+$/),
  birthDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/), // DD/MM/YYYY
  gender: z.enum(['GAY','LESBIAN','BISEXUAL','PANSEXUAL','QUEER','ASEXUAL']),
  sex: z.enum(['MALE','FEMALE']).nullable().optional(),
  photos: z.array(z.object({ url: z.string().url() })).length(3),
})

const GetStatusDto = z.object({ initData: z.string().min(1) })
const LookingForEnum = z.enum(['LONG_DISTANCE','LOCAL','SEX','COMMUNICATION','EXCHANGE'])
const SubmitDetailsDto = z.object({
  initData: z.string().min(1),
  description: z.string().min(24).max(1200),
  consentAccepted: z.literal(true),
  lookingFor: z.array(LookingForEnum).max(5).optional().default([]),
  heightCm: z.number().int().min(130).max(220).optional(),
  weightKg: z.number().int().min(30).max(300).optional(),
  wandSizeCm: z.number().int().min(3).max(30).optional(),
})

// Новые схемы для работы с аватарами
const UpdateAvatarDto = z.object({
  initData: z.string().min(1),
  photoUrl: z.string().url(),
})

const RemoveCustomAvatarDto = z.object({
  initData: z.string().min(1),
})

// ===== Helpers =====

function parseBirthDateDDMMYYYY(input: string): Date | null {
  const [dd, mm, yyyy] = input.split('/')
  const d = Number(dd), m = Number(mm), y = Number(yyyy)
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return null
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  // быстрая проверка корректности даты (например 31/02)
  if (date.getUTCDate() !== d || date.getUTCMonth() !== m - 1 || date.getUTCFullYear() !== y) return null
  return date
}

function calcAge(date: Date): number {
  const now = new Date()
  let age = now.getUTCFullYear() - date.getUTCFullYear()
  const m = now.getUTCMonth() - date.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < date.getUTCDate())) age--
  return age
}

// Функция для проверки, является ли URL кастомным аватаром
function isCustomAvatar(url: string): boolean {
  return url.includes('spectrmod.ru')
}

// Функция для проверки актуальности аватара из Telegram
async function checkTelegramAvatarFreshness(userId: BigInt, currentPhotoUrl: string | null): Promise<boolean> {
  // Если нет аватара или это кастомный аватар - не проверяем
  if (!currentPhotoUrl || isCustomAvatar(currentPhotoUrl)) {
    return true
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: Number(userId) },
    select: { lastPhotoCheck: true }
  })

  if (!user) return true

  // Проверяем раз в час (3600000 мс)
  const ONE_HOUR = 3600000
  const now = new Date()
  const lastCheck = user.lastPhotoCheck

  if (!lastCheck || (now.getTime() - lastCheck.getTime()) > ONE_HOUR) {
    // Обновляем время проверки
    await prisma.user.update({
      where: { telegramId: Number(userId) },
      data: { lastPhotoCheck: now }
    })
    return false // Нужно проверить актуальность
  }

  return true // Проверка недавно была, считаем актуальным
}

// ===== Routes =====

router.post('/profile/submit-base', async (req: express.Request, res: express.Response) => {
  const parsed = SubmitBaseProfileDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const { initData, city, displayName, birthDate, gender, sex, photos } = parsed.data

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  const bd = parseBirthDateDDMMYYYY(birthDate)
  if (!bd) return res.status(400).json({ message: 'Invalid birthDate' })
  const age = calcAge(bd)
  if (age < 13 || age > 19) return res.status(400).json({ message: 'Age out of range' })

  // гендеры, для которых требуется указать пол явно — например, GAY, LESBIAN
  const requiresSex = gender === 'GAY' || gender === 'LESBIAN'
  if (requiresSex && (sex !== 'MALE' && sex !== 'FEMALE')) {
    return res.status(400).json({ message: 'Sex is required for selected gender' })
  }

  try {
    const telegramId = BigInt(verification.user.id)

    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        username: verification.user.username ?? null,
        firstName: verification.user.first_name ?? null,
        lastName: verification.user.last_name ?? null,
        languageCode: verification.user.language_code ?? null,
        isPremium: verification.user.is_premium ?? null,
        photoUrl: verification.user.photo_url ?? null,
      },
      create: {
        telegramId,
        username: verification.user.username ?? null,
        firstName: verification.user.first_name ?? null,
        lastName: verification.user.last_name ?? null,
        languageCode: verification.user.language_code ?? null,
        isPremium: verification.user.is_premium ?? null,
        photoUrl: verification.user.photo_url ?? null,
      }
    })

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.profile.upsert({
        where: { userId: user.telegramId },
        update: {
          city,
          displayName,
          birthDate: bd,
          gender,
          sex: sex ?? null,
          initialModerationStatus: 'PENDING',
          initialModerationNote: null,
        },
        create: {
          userId: user.telegramId,
          city,
          displayName,
          birthDate: bd,
          gender,
          sex: sex ?? null,
          initialModerationStatus: 'PENDING',
        }
      })

      // Сбросим старые фото и создадим новые 3 слота
      await tx.photo.deleteMany({ where: { userId: user.telegramId } })
      await tx.photo.createMany({
        data: photos.map((p, i) => ({ userId: user.telegramId, url: p.url, position: i, status: 'PENDING' })),
        skipDuplicates: true,
      })

      await tx.moderationItem.create({
        data: {
          userId: user.telegramId,
          type: 'INITIAL',
          status: 'PENDING',
          payload: {
            city,
            displayName,
            birthDate,
            gender,
            sex: sex ?? null,
            photos,
          },
        }
      })
    })

    return res.json({ ok: true, status: 'UNDER_REVIEW_BASE' })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

router.post('/profile/status', async (req: express.Request, res: express.Response) => {
  const parsed = GetStatusDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(verification.user.id)
  
  // Проверяем и обновляем аватар пользователя при необходимости
      const user = await prisma.user.findUnique({ 
      where: { telegramId: userId },
      select: { photoUrl: true, customPhotoUrl: true }
    })
    
    if (user && !user.customPhotoUrl && user.photoUrl && verification.user.photo_url) {
      // Если нет кастомного аватара и Telegram аватар изменился, обновляем
      if (user.photoUrl !== verification.user.photo_url) {
        await prisma.user.update({
          where: { telegramId: userId },
          data: { 
            photoUrl: verification.user.photo_url,
            lastPhotoCheck: new Date()
          }
        })
      }
    }
  
  const profile = await prisma.profile.findUnique({ where: { userId } })
  if (!profile) return res.json({ ok: true, status: 'NO_PROFILE' })

  const base = profile.initialModerationStatus
  const desc = profile.descriptionModerationStatus
  let status: string = 'READY'
  if (base === 'PENDING') status = 'UNDER_REVIEW_BASE'
  else if (base === 'REJECTED') status = 'BASE_DECLINED'
  else if (base === 'APPROVED') {
    // после первой модерации даём шаг описания
    const pendingDesc = await prisma.moderationItem.count({ where: { userId, type: 'PROFILE_DESCRIPTION', status: 'PENDING' } })
    if (!profile.description) {
      status = pendingDesc > 0 ? 'UNDER_REVIEW_DESC' : 'NEED_DESCRIPTION'
    } else {
      if (desc === 'PENDING' || pendingDesc > 0) status = 'UNDER_REVIEW_DESC'
      else if (desc === 'REJECTED') status = 'DESC_DECLINED'
      else status = 'READY'
    }
  }
  return res.json({ ok: true, status })
})

// ===== Admin moderation v1 =====

const AdminModerateDto = z.object({
  userId: z.coerce.bigint(),
  approve: z.boolean(),
  reason: z.string().max(1000).optional(),
})

router.post('/admin/profile/base/moderate', async (req: express.Request, res: express.Response) => {
  // TODO: добавить админ-аутентификацию и RBAC
  const parsed = AdminModerateDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })
  const { userId, approve, reason } = parsed.data

  const item = await prisma.moderationItem.findFirst({
    where: { userId, type: 'INITIAL', status: 'PENDING' },
    orderBy: { createdAt: 'asc' }
  })
  if (!item) return res.status(404).json({ message: 'Nothing to moderate' })

  const newStatus = approve ? 'APPROVED' : 'REJECTED'
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.moderationItem.update({ where: { id: item.id }, data: { status: newStatus, resolvedAt: new Date(), reason: reason ?? null } })
    await tx.profile.update({ where: { userId }, data: { initialModerationStatus: newStatus, initialModerationNote: reason ?? null } })
    await tx.photo.updateMany({ where: { userId }, data: { status: newStatus } })
  })

  return res.json({ ok: true })
})

// ===== Avatar management =====

// Загрузка кастомного аватара
router.post('/profile/avatar/update', async (req: express.Request, res: express.Response) => {
  const parsed = UpdateAvatarDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const { initData, photoUrl } = parsed.data

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    // Проверяем, что URL содержит spectrmod.ru (кастомный аватар)
    if (!isCustomAvatar(photoUrl)) {
      return res.status(400).json({ message: 'Only custom avatars from spectrmod.ru are allowed' })
    }

    await prisma.user.update({
      where: { telegramId },
      data: { 
        customPhotoUrl: photoUrl,
        // Сбрасываем время проверки, так как теперь используем кастомный аватар
        lastPhotoCheck: new Date()
      }
    })

    return res.json({ ok: true, photoUrl })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// Удаление кастомного аватара (возврат к Telegram аватару)
router.post('/profile/avatar/remove', async (req: express.Request, res: express.Response) => {
  const parsed = RemoveCustomAvatarDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const { initData } = parsed.data

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    await prisma.user.update({
      where: { telegramId },
      data: { 
        customPhotoUrl: null,
        // Сбрасываем время проверки, чтобы при следующем запросе проверить актуальность Telegram аватара
        lastPhotoCheck: null
      }
    })

    return res.json({ ok: true })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// Получение текущего аватара пользователя
router.get('/profile/avatar', async (req: express.Request, res: express.Response) => {
  const initData = req.query.initData as string
  if (!initData) return res.status(400).json({ message: 'initData is required' })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { 
        photoUrl: true, 
        customPhotoUrl: true,
        lastPhotoCheck: true 
      }
    })

    if (!user) return res.status(404).json({ message: 'User not found' })

    // Определяем какой аватар использовать
    let currentAvatar = user.customPhotoUrl || user.photoUrl
    let isCustom = !!user.customPhotoUrl
    let needsUpdate = false

    // Если используем Telegram аватар, проверяем актуальность
    if (!isCustom && user.photoUrl) {
      needsUpdate = !(await checkTelegramAvatarFreshness(telegramId, user.photoUrl))
    }

    return res.json({ 
      ok: true, 
      photoUrl: currentAvatar,
      isCustom,
      needsUpdate,
      telegramPhotoUrl: user.photoUrl
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// Получение информации о текущем пользователе (включая роль)
router.get('/profile/me', async (req: express.Request, res: express.Response) => {
  const initData = req.query.initData as string
  if (!initData) return res.status(400).json({ message: 'initData is required' })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const telegramId = BigInt(verification.user.id)

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { 
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        photoUrl: true, 
        customPhotoUrl: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            city: true,
            initialModerationStatus: true,
            descriptionModerationStatus: true
          }
        }
      }
    })

    if (!user) return res.status(404).json({ message: 'User not found' })

    return res.json({ 
      ok: true, 
      user: {
        ...user,
        telegramId: user.telegramId.toString(),
        isModerator: user.role === 'MODERATOR' || user.role === 'ADMIN',
        isAdmin: user.role === 'ADMIN'
      }
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

export const profileRouter = router