import express from 'express'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'
import { ENV } from '@/config/env'

const router = express.Router()

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

router.post('/profile/submit-details', async (req: express.Request, res: express.Response) => {
  const parsed = SubmitDetailsDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })
  const v = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })
  const userId = BigInt(v.user.id)

  const profile = await prisma.profile.findUnique({ where: { userId } })
  if (!profile || profile.initialModerationStatus !== 'APPROVED') {
    return res.status(409).json({ message: 'Base profile is not approved yet' })
  }

  const { description, consentAccepted, lookingFor, heightCm, weightKg, wandSizeCm } = parsed.data

  await prisma.$transaction(async tx => {
    await tx.moderationItem.create({
      data: {
        userId,
        type: 'PROFILE_DESCRIPTION',
        status: 'PENDING',
        payload: { description, lookingFor, heightCm, weightKg, wandSizeCm, consentAccepted },
      }
    })
    // сохраняем согласие и моментальное отображение только описания? — нет, ждём модерацию
    await tx.profile.update({
      where: { userId },
      data: {
        descriptionModerationStatus: 'PENDING',
        consentAcceptedAt: new Date(),
      }
    })
    // lookingFor — применяем только после модерации, поэтому не пишем прямо сейчас в ProfileLookingFor
  })

  return res.json({ ok: true, status: 'UNDER_REVIEW_DESC' })
})

export const profileDetailsRouter = router


