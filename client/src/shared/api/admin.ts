import { z } from 'zod'

import { requireEnvUrl } from '@/shared/config/env'

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${b}/${p}`
}

// ===== User Management =====

export const UserRoleEnum = z.enum(['USER', 'MODERATOR', 'ADMIN'])
export type UserRoleEnum = z.infer<typeof UserRoleEnum>

export const UserListItem = z.object({
  telegramId: z.string(),
  username: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: UserRoleEnum,
  createdAt: z.string(),
  profile: z.object({
    displayName: z.string().nullable(),
    city: z.string().nullable(),
    initialModerationStatus: z.string()
  }).nullable()
})
export type UserListItem = z.infer<typeof UserListItem>

export const UsersListResponse = z.object({
  ok: z.literal(true),
  users: z.array(UserListItem),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number()
  })
}).or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type UsersListResponse = z.infer<typeof UsersListResponse>

export const UpdateRoleRequest = z.object({
  targetTelegramId: z.string(),
  newRole: UserRoleEnum
})
export type UpdateRoleRequest = z.infer<typeof UpdateRoleRequest>

export const UpdateRoleResponse = z.object({
  ok: z.literal(true),
  message: z.string(),
  user: z.object({
    telegramId: z.string(),
    role: UserRoleEnum
  })
}).or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type UpdateRoleResponse = z.infer<typeof UpdateRoleResponse>

export async function getUsersList(page: number = 1, limit: number = 50): Promise<UsersListResponse> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, `admin/users?page=${page}&limit=${limit}`)
  
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'x-telegram-id': window?.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || ''
    }
  })
  
  if (!resp.ok) return { ok: false, message: `HTTP ${resp.status}` }
  const data = await resp.json().catch(() => ({}))
  return UsersListResponse.parse(data)
}

export async function updateUserRole(payload: UpdateRoleRequest): Promise<UpdateRoleResponse> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, 'admin/user/role')
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-id': window?.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || ''
    },
    body: JSON.stringify(payload)
  })
  
  if (!resp.ok) return { ok: false, message: `HTTP ${resp.status}` }
  const data = await resp.json().catch(() => ({}))
  return UpdateRoleResponse.parse(data)
}

// ===== Moderation =====

export const ModerationItemType = z.enum(['INITIAL', 'PROFILE_DESCRIPTION', 'PROFILE_EDIT', 'PHOTOS'])
export type ModerationItemType = z.infer<typeof ModerationItemType>

export const ModerationStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'DISCREPANT'])
export type ModerationStatus = z.infer<typeof ModerationStatus>

export const ModerationItem = z.object({
  id: z.string(),
  userId: z.string(),
  type: ModerationItemType,
  status: ModerationStatus,
  payload: z.object({
    // Базовые поля
    displayName: z.string().nullable().optional(),
    age: z.number().nullable().optional(),
    city: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    heightCm: z.number().nullable().optional(),
    weightKg: z.number().nullable().optional(),
    wandSizeCm: z.number().nullable().optional(),
    gender: z.string().nullable().optional(),
    photos: z.array(z.union([
      z.string(), // URL строка
      z.object({ // Объект фото с сервера
        id: z.string(),
        url: z.string(),
        position: z.number(),
        status: z.string()
      })
    ])).optional(),
    
    // Обогащенные данные
    profile: z.object({
      city: z.string().nullable(),
      displayName: z.string().nullable(),
      birthDate: z.string().nullable(),
      gender: z.string().nullable(),
      sex: z.string().nullable(),
      description: z.string().nullable(),
      heightCm: z.number().nullable(),
      weightKg: z.number().nullable(),
      wandSizeCm: z.number().nullable(),
      createdAt: z.string(),
      updatedAt: z.string()
    }).nullable().optional(),
    
    // Флаг нового профиля
    isNewProfile: z.boolean().optional(),
    
    // Информация об изменениях
    changes: z.object({
      displayName: z.object({
        old: z.string().nullable().optional(),
        new: z.string().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      city: z.object({
        old: z.string().nullable().optional(),
        new: z.string().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      description: z.object({
        old: z.string().nullable().optional(),
        new: z.string().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      heightCm: z.object({
        old: z.number().nullable().optional(),
        new: z.number().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      weightKg: z.object({
        old: z.number().nullable().optional(),
        new: z.number().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      wandSizeCm: z.object({
        old: z.number().nullable().optional(),
        new: z.number().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      gender: z.object({
        old: z.string().nullable().optional(),
        new: z.string().nullable().optional(),
        changed: z.boolean()
      }).optional()
    }).optional(),
    
    // Изменения фотографий
    photoChanges: z.object({
      added: z.array(z.string()).optional(),
      removed: z.array(z.string()).optional(),
      reordered: z.boolean().optional()
    }).optional()
  }).passthrough(), // Разрешаем дополнительные поля
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  reason: z.string().nullable(),
  user: z.object({
    telegramId: z.string(),
    username: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable()
  })
})
export type ModerationItem = z.infer<typeof ModerationItem>

export const ModerationItemsResponse = z.object({
  ok: z.literal(true),
  items: z.array(ModerationItem),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number()
  })
}).or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type ModerationItemsResponse = z.infer<typeof ModerationItemsResponse>

export const UpdateModerationStatusRequest = z.object({
  itemId: z.string(),
  status: ModerationStatus,
  reason: z.string().optional(),
  banUser: z.boolean().optional()
})
export type UpdateModerationStatusRequest = z.infer<typeof UpdateModerationStatusRequest>

export const ModerationStatsResponse = z.object({
  ok: z.literal(true),
  stats: z.object({
    pending: z.number(),
    approved: z.number(),
    rejected: z.number(),
    discrepant: z.number(),
    total: z.number()
  }),
  byType: z.record(z.string(), z.record(z.string(), z.number()))
}).or(z.object({ ok: z.literal(false), message: z.string().optional() }))
export type ModerationStatsResponse = z.infer<typeof ModerationStatsResponse>

export async function getModerationItems(
  status?: ModerationStatus,
  type?: ModerationItemType,
  page: number = 1,
  limit: number = 50
): Promise<ModerationItemsResponse> {
  const base = requireEnvUrl('API_URL')
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  })
  if (status) params.append('status', status)
  if (type) params.append('type', type)
  
  const url = joinUrl(base, `moderation/items?${params.toString()}`)
  
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'x-telegram-id': window?.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || ''
    }
  })
  
  if (!resp.ok) return { ok: false, message: `HTTP ${resp.status}` }
  const data = await resp.json().catch(() => ({}))
  return ModerationItemsResponse.parse(data)
}

export async function updateModerationStatus(payload: UpdateModerationStatusRequest): Promise<{ ok: boolean; message?: string }> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, 'moderation/item/status')
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-id': window?.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || ''
    },
    body: JSON.stringify(payload)
  })
  
  if (!resp.ok) return { ok: false, message: `HTTP ${resp.status}` }
  const data = await resp.json().catch(() => ({}))
  return { ok: data.ok, message: data.message }
}

export async function getModerationStats(): Promise<ModerationStatsResponse> {
  const base = requireEnvUrl('API_URL')
  const url = joinUrl(base, 'moderation/stats')
  
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'x-telegram-id': window?.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || ''
    }
  })
  
  if (!resp.ok) return { ok: false, message: `HTTP ${resp.status}` }
  const data = await resp.json().catch(() => ({}))
  return ModerationStatsResponse.parse(data)
}
