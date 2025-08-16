import { ENV, requireEnvUrl } from '@/shared/config/env'

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${b}/${p}`
}

export interface UploadImageResponseOk {
  ok: true
  filename: string
  url: string
}

export interface UploadImageResponseErr {
  ok: false
  message?: string
}

export type UploadImageResponse = UploadImageResponseOk | UploadImageResponseErr

export async function uploadImage(file: File | Blob): Promise<UploadImageResponse> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, 'cdn/upload')
  const fd = new FormData()
  fd.append('file', file)
  const resp = await fetch(url, { method: 'POST', body: fd })
  if (!resp.ok) return { ok: false, message: `HTTP ${resp.status}` }
  const data = await resp.json().catch(() => ({})) as { ok?: boolean; filename?: string; message?: string }
  if (!data || !data.ok || !data.filename) return { ok: false, message: data?.message || 'Upload failed' }
  const cdn = requireEnvUrl('CDN_URL')
  const publicUrl = joinUrl(cdn, data.filename)
  return { ok: true, filename: data.filename, url: publicUrl }
}


