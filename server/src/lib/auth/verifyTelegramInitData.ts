import crypto from 'crypto'
import { z } from 'zod'

export const TelegramUserSchema = z.object({
  id: z.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
  photo_url: z.string().url().optional()
})

export type TelegramUser = z.infer<typeof TelegramUserSchema>

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  ttlSeconds: number | null
): { ok: boolean; user?: TelegramUser; auth_date?: number } {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return { ok: false }

    const kvPairs: string[] = []
    params.forEach((value, key) => {
      if (key === 'hash') return
      kvPairs.push(`${key}=${value}`)
    })
    kvPairs.sort()
    const dataCheckString = kvPairs.join('\n')

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    const hashBuffer = Buffer.from(hash, 'hex')
    const computedBuffer = Buffer.from(computed, 'hex')
    if (hashBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(hashBuffer, computedBuffer)) {
      return { ok: false }
    }

    const authDate = Number(params.get('auth_date') || 0)
    if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false }
    if (ttlSeconds && ttlSeconds > 0) {
      const nowSec = Math.floor(Date.now() / 1000)
      if (nowSec - authDate > ttlSeconds) return { ok: false }
    }

    const userRaw = params.get('user')
    const userParsed = userRaw ? JSON.parse(userRaw) : undefined
    const user = userParsed ? TelegramUserSchema.parse(userParsed) : undefined

    return { ok: true, user, auth_date: authDate }
  } catch {
    return { ok: false }
  }
}


