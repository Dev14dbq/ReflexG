import { requireEnvUrl, ENV } from '@/shared/config/env'

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${b}/${p}`
}

export interface UploadImageResponseOk { ok: true; id?: string; filename?: string; url: string; urls?: Record<string, string> }
export interface UploadImageResponseErr { ok: false; message?: string }
export type UploadImageResponse = UploadImageResponseOk | UploadImageResponseErr

// Cloudflare Images Direct Upload flow with fallback to local CDN
export async function uploadImage(file: File | Blob, options?: { variant?: 'avatar' | 'profile' | 'media' }): Promise<UploadImageResponse> {
  const base = requireEnvUrl('API_URL')

  // Try backend CDN upload first (server handles provider integration)
  try {
    const url = joinUrl(base, 'cdn/images/upload')
    const fd = new FormData()
    fd.append('file', file)
    if (options?.variant) fd.append('variant', options.variant)
    const resp = await fetch(url, { method: 'POST', body: fd })
    if (resp.ok) {
      const j = await resp.json().catch(() => ({} as any))
      if (j?.ok && j?.id) {
        // Compose delivery URL client-side from id and variant
        const hash = ENV.CF_IMAGES_HASH
        const variant = options?.variant || 'media'
        const delivery = hash ? `https://cdn.spectrmod.com/${hash}/${j.id}/${variant}` : String(j.id)
        return { ok: true, id: j.id, url: delivery }
      }
    }
  } catch {}

  // No local CDN fallback anymore
  return { ok: false, message: 'Upload failed' }
}

// Cloudflare list and delete helpers
export async function listImages(params?: { continuationToken?: string; perPage?: number }): Promise<any> {
  const base = requireEnvUrl('API_URL')
  const qs = new URLSearchParams()
  if (params?.continuationToken) qs.set('continuation_token', params.continuationToken)
  if (params?.perPage) qs.set('per_page', String(params.perPage))
  const url = joinUrl(base, `cdn/images${qs.toString() ? `?${qs.toString()}` : ''}`)
  const resp = await fetch(url)
  const json = await resp.json().catch(() => ({}))
  return json
}

export async function deleteImage(id: string): Promise<{ ok: boolean; message?: string }> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, `cdn/images/${encodeURIComponent(id)}`)
  const resp = await fetch(url, { method: 'DELETE' })
  if (!resp.ok) return { ok: false, message: `HTTP ${resp.status}` }
  const json = await resp.json().catch(() => ({})) as { ok?: boolean; message?: string }
  return { ok: Boolean(json?.ok) }
}


