import { z } from 'zod'
import { ENV } from '@/shared/config/env'
import { telegramUserSchema, type TelegramUser } from '@/shared/lib/telegram'

const TelegramValidateResponse = z
  .object({
    ok: z.literal(true),
    user: telegramUserSchema.nullable(),
    auth_date: z.number().optional()
  })
  .or(z.object({ ok: z.literal(false), message: z.string().optional() }))

export type TelegramValidateResponse = z.infer<typeof TelegramValidateResponse>

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${b}/${p}`
}

export async function validateTelegramInitData(initData: string): Promise<TelegramValidateResponse> {
  const base = ENV.API_URL
  const primaryUrl = joinUrl(base, 'telegram/validate')
  const makeReq = (url: string) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  })

  let resp = await makeReq(primaryUrl)
  if (!resp.ok && resp.status === 404 && /\/api\/?$/i.test(base)) {
    const fallbackBase = base.replace(/\/api\/?$/i, '/')
    const fallbackUrl = joinUrl(fallbackBase, 'telegram/validate')
    resp = await makeReq(fallbackUrl)
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    return { ok: false, message: text || `HTTP ${resp.status}` }
  }
  const data = await resp.json().catch(() => ({}))
  return TelegramValidateResponse.parse(data)
}


