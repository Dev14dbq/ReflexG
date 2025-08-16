import { z } from 'zod'

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void
        expand?: () => void
        initData?: string
        initDataUnsafe?: {
          user?: {
            id: number
            first_name?: string
            last_name?: string
            username?: string
            language_code?: string
            is_premium?: boolean
            photo_url?: string
          }
        }
        platform?: string
        version?: string
        colorScheme?: 'light' | 'dark'
      }
    }
  }
}

export const telegramUserSchema = z.object({
  id: z.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
  photo_url: z.string().url().optional(),
})

export type TelegramUser = z.infer<typeof telegramUserSchema>

export function getTelegramUserSafe(): TelegramUser | null {
  const webApp = window?.Telegram?.WebApp
  const candidate = webApp?.initDataUnsafe?.user
  const parsed = telegramUserSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export function isTelegramInWebApp(): boolean {
  const webApp = window?.Telegram?.WebApp
  if (!webApp) return false
  const platform = webApp.platform
  // In browser with external script, platform can be 'unknown'. Treat as not in Telegram
  return Boolean(platform && platform !== 'unknown')
}

export function getTelegramPlatform(): string | undefined {
  return window?.Telegram?.WebApp?.platform
}



