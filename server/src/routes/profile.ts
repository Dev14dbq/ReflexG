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
  const profile = await prisma.profile.findUnique({ where: { userId } })
  if (!profile) return res.json({ ok: true, status: 'NO_PROFILE' })

  const base = profile.initialModerationStatus
  const desc = profile.descriptionModerationStatus
  let status: string = 'READY'
  if (base === 'PENDING') status = 'UNDER_REVIEW_BASE'
  else if (base === 'REJECTED') status = 'BASE_DECLINED'
  else if (base === 'APPROVED') {
    // после первой модерации даём шаг описания
    if (desc === 'PENDING') status = 'UNDER_REVIEW_DESC'
    else if (desc === 'REJECTED') status = 'DESC_DECLINED'
    else status = 'NEED_DESCRIPTION'
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

export const profileRouter = router


