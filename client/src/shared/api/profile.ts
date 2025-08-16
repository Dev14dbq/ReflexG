import { z } from 'zod'
import { requireEnvUrl } from '@/shared/config/env'

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${b}/${p}`
}

export const GenderEnum = z.enum(['GAY','LESBIAN','BISEXUAL','PANSEXUAL','QUEER','ASEXUAL'])
export type GenderEnum = z.infer<typeof GenderEnum>

export const SexEnum = z.enum(['MALE','FEMALE'])
export type SexEnum = z.infer<typeof SexEnum>

export const SubmitBaseProfileRequest = z.object({
  initData: z.string().min(1),
  city: z.string().min(1).max(128),
  displayName: z.string().min(2).max(16).regex(/^[А-Яа-яЁё]+$/),
  birthDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  gender: GenderEnum,
  sex: SexEnum.nullable().optional(),
  photos: z.array(z.object({ url: z.string().url() })).length(3),
})
export type SubmitBaseProfileRequest = z.infer<typeof SubmitBaseProfileRequest>

export const SubmitBaseProfileResponse = z.object({ ok: z.literal(true), status: z.literal('UNDER_REVIEW_BASE') })
  .or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type SubmitBaseProfileResponse = z.infer<typeof SubmitBaseProfileResponse>

export const ProfileStatusResponse = z.object({ ok: z.literal(true), status: z.string() })
  .or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type ProfileStatusResponse = z.infer<typeof ProfileStatusResponse>

export async function submitBaseProfile(payload: SubmitBaseProfileRequest): Promise<SubmitBaseProfileResponse> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, 'profile/submit-base')
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) return { ok: false, message: `HTTP ${resp.status}` }
  const data = await resp.json().catch(() => ({}))
  return SubmitBaseProfileResponse.parse(data)
}

export async function getProfileStatus(initData: string): Promise<ProfileStatusResponse> {
  const base = requireEnvUrl('API_URL')
  const primary = joinUrl(base, 'profile/status')
  const makeReq = (url: string) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  })
  let resp = await makeReq(primary)
  if (!resp.ok && resp.status === 404 && /\/api\/?$/i.test(base)) {
    const fb = base.replace(/\/api\/?$/i, '/')
    resp = await makeReq(joinUrl(fb, 'profile/status'))
  }
  if (!resp.ok) return { ok: false, message: `HTTP ${resp.status}` }
  const data = await resp.json().catch(() => ({}))
  return ProfileStatusResponse.parse(data)
}


