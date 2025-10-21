function normalizeUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s.length ? s : undefined
}

const api = normalizeUrl(import.meta.env.VITE_API) ?? normalizeUrl(import.meta.env.VITE_API_URL)
const cdn = normalizeUrl(import.meta.env.VITE_CDN)
const cfImagesHash = normalizeUrl(import.meta.env.VITE_CF_IMAGES_HASH)
const cfImagesVariant = normalizeUrl(import.meta.env.VITE_CF_IMAGES_VARIANT)

export const ENV = {
  API_URL: api,
  CDN_URL: cdn,
  CF_IMAGES_HASH: cfImagesHash,
  CF_IMAGES_VARIANT: cfImagesVariant,
} as const

export function requireEnvUrl(name: keyof typeof ENV): string {
  const v = ENV[name]
  if (!v) throw new Error(`${String(name)} is not set`)
  return v
}

export type ENV = typeof ENV


