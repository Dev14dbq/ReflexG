import express from 'express'
import { z } from 'zod'
import { ENV } from '@/config/env'
import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'

const router = express.Router()

const ValidateTelegramDto = z.object({
  initData: z.string().min(1)
})

router.post('/telegram/validate', (req: express.Request, res: express.Response) => {
  const parse = ValidateTelegramDto.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ message: 'Invalid payload', issues: parse.error.issues })

  const botToken = ENV.TELEGRAM_BOT_TOKEN
  if (!botToken) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })
  const ttlSeconds = Number.isFinite(ENV.TELEGRAM_AUTH_TTL_SECONDS) && ENV.TELEGRAM_AUTH_TTL_SECONDS > 0
    ? ENV.TELEGRAM_AUTH_TTL_SECONDS
    : 86400

  const result = verifyTelegramInitData(parse.data.initData, botToken, ttlSeconds)
  if (!result.ok) return res.status(401).json({ ok: false, message: 'Invalid initData' })

  return res.json({ ok: true, user: result.user ?? null, auth_date: result.auth_date })
})

export const authRouter = router


