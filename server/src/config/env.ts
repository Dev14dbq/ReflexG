export const ENV = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || '',
  TELEGRAM_AUTH_TTL_SECONDS: Number(process.env.TELEGRAM_AUTH_TTL_SECONDS || 86400),
  PORT: Number(process.env.PORT || 3001),
  DADATA_TOKEN: process.env.DADATA_TOKEN || ' ',
  DADATA_SECRET: process.env.DADATA_SECRET || ' ',
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID || '',
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  // Optional: used to construct delivery URLs server-side
  CF_IMAGES_HASH: process.env.CF_IMAGES_HASH || '',
  CF_IMAGES_VARIANT: process.env.CF_IMAGES_VARIANT || '',
  // Orphaned Cloudflare Images GC
  CF_IMAGES_GC_ENABLED: (process.env.CF_IMAGES_GC_ENABLED || 'false').toLowerCase() === 'true',
  CF_IMAGES_GC_INTERVAL_MIN: Number(process.env.CF_IMAGES_GC_INTERVAL_MIN || 60),
  CF_IMAGES_GC_GRACE_DAYS: Number(process.env.CF_IMAGES_GC_GRACE_DAYS || 7),
  // R2 (S3-compatible) for DB backups
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_BACKUP_BUCKET: process.env.R2_BACKUP_BUCKET || 'backups',
  R2_BACKUP_PREFIX: process.env.R2_BACKUP_PREFIX || 'db',
  // DB backup scheduler
  DB_BACKUP_ENABLED: (process.env.DB_BACKUP_ENABLED || 'false').toLowerCase() === 'true',
  DB_BACKUP_INTERVAL_DAYS: Number(process.env.DB_BACKUP_INTERVAL_DAYS || 3),
  DB_BACKUP_PGDUMP_PATH: process.env.DB_BACKUP_PGDUMP_PATH || 'pg_dump',
  // Messages auto-delete scheduler
  AUTO_DELETE_ENABLED: (process.env.AUTO_DELETE_ENABLED || 'true').toLowerCase() === 'true',
  AUTO_DELETE_INTERVAL_MIN: Number(process.env.AUTO_DELETE_INTERVAL_MIN || 30)
} as const

export type ENV = typeof ENV
