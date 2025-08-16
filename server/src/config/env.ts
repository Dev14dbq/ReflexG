export const ENV = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || '',
  TELEGRAM_AUTH_TTL_SECONDS: Number(process.env.TELEGRAM_AUTH_TTL_SECONDS || 86400),
  PORT: Number(process.env.PORT || 3001)
} as const

export type ENV = typeof ENV


