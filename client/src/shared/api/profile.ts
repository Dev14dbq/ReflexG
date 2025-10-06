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
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`
    try {
      const data = await resp.json()
      if (data && typeof data.message === 'string') message = data.message
      if (data && Array.isArray(data.issues) && data.issues.length > 0) {
        const issueMsg = data.issues[0]?.message
        if (typeof issueMsg === 'string' && issueMsg) message = `${message}: ${issueMsg}`
      }
    } catch {}
    return { ok: false, message }
  }
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

// ===== Details (stage 2) =====

export const LookingForEnum = z.enum(['LONG_DISTANCE','LOCAL','SEX','COMMUNICATION','EXCHANGE'])
export type LookingForEnum = z.infer<typeof LookingForEnum>

// ===== User Info with Role =====

export const UserRoleEnum = z.enum(['USER', 'MODERATOR', 'ADMIN'])
export type UserRoleEnum = z.infer<typeof UserRoleEnum>

export const UserInfoResponse = z.object({
  ok: z.literal(true),
  user: z.object({
    telegramId: z.string(),
    username: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    role: UserRoleEnum,
    photoUrl: z.string().nullable(),
    customPhotoUrl: z.string().nullable(),
    createdAt: z.string(),
    isModerator: z.boolean(),
    isAdmin: z.boolean(),
    profile: z.object({
      displayName: z.string().nullable(),
      city: z.string().nullable(),
      initialModerationStatus: z.string(),
      descriptionModerationStatus: z.string()
    }).nullable()
  })
}).or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type UserInfoResponse = z.infer<typeof UserInfoResponse>

export async function getUserInfo(initData: string): Promise<UserInfoResponse> {
  const base = requireEnvUrl('API_URL')

  // Собираем возможные варианты эндпойнтов и методов
  const urls: string[] = []
  if (base.includes('/api')) {
    urls.push(joinUrl(base, 'profile/me'))
    urls.push(joinUrl(base.replace(/\/api\/?$/i, '/'), 'profile/me'))
    urls.push(joinUrl(base.replace(/\/api\/?$/i, '/'), 'api/profile/me'))
  } else {
    urls.push(joinUrl(base, 'profile/me'))
    urls.push(joinUrl(base, 'api/profile/me'))
  }

  const tryGet = async (url: string) => {
    try {
      const resp = await fetch(`${url}?initData=${encodeURIComponent(initData)}`)
      if (!resp.ok) return { ok: false as const, status: resp.status }
      const contentType = resp.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) return { ok: false as const, status: 'NON_JSON' }
      const data = await resp.json().catch(() => ({}))
      const parsed = UserInfoResponse.safeParse(data)
      if (parsed.success) return { ok: true as const, data: parsed.data }
      return { ok: false as const, status: 'INVALID_SCHEMA' }
    } catch {
      return { ok: false as const, status: 'NETWORK' }
    }
  }

  // 1) GET с разными путями
  for (const url of urls) {
    const result = await tryGet(url)
    if (result.ok) return result.data
  }

  // 2) POST вариант (некоторые бэки принимают initData в body)
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
      })
      if (!resp.ok) continue
      const contentType = resp.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) continue
      const data = await resp.json().catch(() => ({}))
      const parsed = UserInfoResponse.safeParse(data)
      if (parsed.success) return parsed.data
    } catch {}
  }

  // 3) Финальный fallback: собираем пользователя из Telegram initData, чтобы не ломать UI
  try {
    const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user
    if (tgUser && typeof tgUser.id !== 'undefined') {
      const fallbackUser = {
        telegramId: String(tgUser.id),
        username: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
        lastName: tgUser.last_name ?? null,
        role: 'USER' as const,
        photoUrl: tgUser.photo_url ?? null,
        customPhotoUrl: null,
        createdAt: new Date().toISOString(),
        isModerator: false,
        isAdmin: false,
        profile: null
      }
      const parsed = UserInfoResponse.safeParse({ ok: true, user: fallbackUser })
      if (parsed.success) return parsed.data
    }
  } catch {}

  // Если ничего не сработало, отдаём унифицированную ошибку
  return { ok: false, message: 'Failed to fetch user info from all endpoints' }
}

export const SubmitDetailsRequest = z.object({
  initData: z.string().min(1),
  description: z.string().min(24).max(1200),
  consentAccepted: z.literal(true),
  lookingFor: z.array(LookingForEnum).max(5).optional().default([]),
  heightCm: z.number().int().min(130).max(220).optional(),
  weightKg: z.number().int().min(30).max(300).optional(),
  wandSizeCm: z.number().int().min(3).max(30).optional(),
})
export type SubmitDetailsRequest = z.infer<typeof SubmitDetailsRequest>

export const SubmitDetailsResponse = z.object({ ok: z.literal(true), status: z.literal('UNDER_REVIEW_DESC') })
  .or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type SubmitDetailsResponse = z.infer<typeof SubmitDetailsResponse>

export async function submitProfileDetails(body: SubmitDetailsRequest): Promise<SubmitDetailsResponse> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, 'profile/submit-details')
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`
    try {
      const data = await resp.json()
      if (data && typeof data.message === 'string') message = data.message
      if (data && Array.isArray(data.issues) && data.issues.length > 0) {
        const issueMsg = data.issues[0]?.message
        if (typeof issueMsg === 'string' && issueMsg) message = `${message}: ${issueMsg}`
      }
    } catch {}
    return { ok: false, message }
  }
  const data = await resp.json().catch(() => ({}))
  return SubmitDetailsResponse.parse(data)
}

// ===== Avatar (HTTP instead of WS) =====

export const UpdateAvatarRequest = z.object({
  initData: z.string().min(1),
  photoUrl: z.string().url()
})
export type UpdateAvatarRequest = z.infer<typeof UpdateAvatarRequest>

export const RemoveCustomAvatarRequest = z.object({
  initData: z.string().min(1)
})
export type RemoveCustomAvatarRequest = z.infer<typeof RemoveCustomAvatarRequest>

export const GetAvatarResponseOk = z.object({
  ok: z.literal(true),
  photoUrl: z.string().url().nullable(),
  isCustom: z.boolean(),
  needsUpdate: z.boolean(),
  telegramPhotoUrl: z.string().url().nullable().optional(),
})
export const GetAvatarResponse = GetAvatarResponseOk
  .or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type GetAvatarResponse = z.infer<typeof GetAvatarResponse>

export async function getAvatar(initData: string): Promise<GetAvatarResponse> {
  const base = requireEnvUrl('API_URL')
  const urls: string[] = []
  
  // Пробуем разные варианты путей
  if (base.includes('/api')) {
    urls.push(joinUrl(base, 'profile/avatar'))
    urls.push(joinUrl(base.replace('/api', ''), 'profile/avatar'))
  } else {
    urls.push(joinUrl(base, 'profile/avatar'))
    urls.push(joinUrl(base, 'api/profile/avatar'))
  }

  for (const url of urls) {
    try {
      const resp = await fetch(`${url}?initData=${encodeURIComponent(initData)}`)
      if (resp.ok) {
        const data = await resp.json().catch(() => ({}))
        return GetAvatarResponse.parse(data)
      }
    } catch {}
  }

  return { ok: false, message: 'Failed to fetch avatar from all endpoints' }
}

export const UpdateAvatarResponse = z.object({ ok: z.literal(true), photoUrl: z.string().url() })
  .or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type UpdateAvatarResponse = z.infer<typeof UpdateAvatarResponse>

export async function updateAvatar(payload: UpdateAvatarRequest): Promise<{ ok: boolean; photoUrl?: string; message?: string }> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, 'profile/avatar')
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`
    try {
      const data = await resp.json()
      if (data && typeof data.message === 'string') message = data.message
    } catch {}
    return { ok: false, message }
  }
  const data = await resp.json().catch(() => ({}))
  return { ok: data.ok, photoUrl: data.photoUrl, message: data.message }
}

export async function removeCustomAvatar(payload: RemoveCustomAvatarRequest): Promise<{ ok: boolean; message?: string }> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, 'profile/avatar/remove')
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`
    try {
      const data = await resp.json()
      if (data && typeof data.message === 'string') message = data.message
    } catch {}
    return { ok: false, message }
  }
  const data = await resp.json().catch(() => ({}))
  return { ok: data.ok, message: data.message }
}

// ===== My Profile (GET/PATCH) =====

export const MyProfileResponse = z.object({
  ok: z.literal(true),
  profile: z.object({
    displayName: z.string().nullable(),
    city: z.string().nullable(),
    bio: z.string().nullable(),
    gender: GenderEnum.nullable(),
    heightCm: z.number().nullable(),
    weightKg: z.number().nullable(),
    wandSizeCm: z.number().nullable(),
    photos: z.array(z.string().url()),
    moderation: z.object({
      base: z.string().nullable(),
      description: z.string().nullable()
    })
  })
}).or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type MyProfileResponse = z.infer<typeof MyProfileResponse>

export async function getMyProfile(initData: string): Promise<MyProfileResponse> {
  const base = requireEnvUrl('API_URL')
  const urls: string[] = []
  if (base.includes('/api')) {
    urls.push(joinUrl(base, 'profile/my'))
    urls.push(joinUrl(base.replace(/\/api\/?$/i, '/'), 'profile/my'))
    urls.push(joinUrl(base.replace(/\/api\/?$/i, '/'), 'api/profile/my'))
  } else {
    urls.push(joinUrl(base, 'profile/my'))
    urls.push(joinUrl(base, 'api/profile/my'))
  }
  for (const url of urls) {
    try {
      const resp = await fetch(`${url}?initData=${encodeURIComponent(initData)}`)
      if (!resp.ok) continue
      const data = await resp.json().catch(() => ({}))
      const parsed = MyProfileResponse.safeParse(data)
      if (parsed.success) return parsed.data
    } catch {}
  }
  return { ok: false, message: 'Failed to fetch /profile/my' }
}

export const PatchMyProfileRequest = z.object({
  initData: z.string().min(1),
  displayName: z.string().min(2).max(32).optional(),
  city: z.string().min(1).max(128).optional(),
  bio: z.string().min(1).max(1200).optional(),
  gender: GenderEnum.optional(),
  heightCm: z.number().int().min(130).max(220).nullable().optional(),
  weightKg: z.number().int().min(30).max(150).nullable().optional(),
  wandSizeCm: z.number().int().min(3).max(30).nullable().optional(),
  photos: z.array(z.string().url()).min(1).optional()
})
export type PatchMyProfileRequest = z.infer<typeof PatchMyProfileRequest>

export const PatchMyProfileResponse = z.object({ ok: z.literal(true) }).and(z.object({ editQueued: z.boolean().optional(), photosQueued: z.boolean().optional() })).or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type PatchMyProfileResponse = z.infer<typeof PatchMyProfileResponse>

export async function patchMyProfile(body: PatchMyProfileRequest): Promise<PatchMyProfileResponse> {
  const base = requireEnvUrl('API_URL')
  const urls: string[] = []
  if (base.includes('/api')) {
    urls.push(joinUrl(base, 'profile/my'))
    urls.push(joinUrl(base.replace(/\/api\/?$/i, '/'), 'profile/my'))
    urls.push(joinUrl(base.replace(/\/api\/?$/i, '/'), 'api/profile/my'))
  } else {
    urls.push(joinUrl(base, 'profile/my'))
    urls.push(joinUrl(base, 'api/profile/my'))
  }
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!resp.ok) continue
      const data = await resp.json().catch(() => ({}))
      const parsed = PatchMyProfileResponse.safeParse({ ok: true, ...data })
      if (parsed.success) return parsed.data
    } catch {}
  }
  return { ok: false, message: 'Failed to patch /profile/my' }
}

// ===== Report Profile =====

export const ReportReasonEnum = z.enum(['SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'FAKE_PROFILE', 'UNDERAGE', 'VIOLENCE', 'COPYRIGHT_VIOLATION', 'OTHER'])
export type ReportReasonEnum = z.infer<typeof ReportReasonEnum>

export const ReportProfileRequest = z.object({
  initData: z.string().min(1),
  reportedUserId: z.string().min(1),
  reason: ReportReasonEnum,
  description: z.string().max(500).optional(),
})
export type ReportProfileRequest = z.infer<typeof ReportProfileRequest>

export const ReportProfileResponse = z.object({ ok: z.literal(true), message: z.string() })
  .or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type ReportProfileResponse = z.infer<typeof ReportProfileResponse>

export async function reportProfile(body: ReportProfileRequest): Promise<ReportProfileResponse> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, 'profile/report')
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`
    try {
      const data = await resp.json()
      if (data && typeof data.message === 'string') message = data.message
      if (data && Array.isArray(data.issues) && data.issues.length > 0) {
        const issueMsg = data.issues[0]?.message
        if (typeof issueMsg === 'string' && issueMsg) message = `${message}: ${issueMsg}`
      }
    } catch {}
    return { ok: false, message }
  }
  const data = await resp.json().catch(() => ({}))
  return ReportProfileResponse.parse(data)
}


