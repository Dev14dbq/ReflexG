import { requireEnvUrl } from '@/shared/config/env'

export interface UnreadLikesResponse {
  ok: true
  count: number
}

export interface LikeHistoryItem {
  id: string
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
  likedAt: string
  isMatched: boolean
  matchedAt: string | null
  isMyLike: boolean // true если это мой лайк (я лайкнул), false если лайкнули меня
}

export interface LikesHistoryResponse {
  ok: true
  likes: LikeHistoryItem[]
  totalCount: number
  myLikesCount: number
  receivedLikesCount: number
  matchedCount: number
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface ClearOldLikesResponse {
  ok: true
  clearedCount: number
  message: string
}

export async function fetchUnreadLikesCount(initData: string): Promise<UnreadLikesResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('likes/unread-count', base)
  url.searchParams.set('initData', initData)
  
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as UnreadLikesResponse
}

export async function fetchLikesHistory(
  initData: string, 
  filter: 'my-likes' | 'received-likes' | 'matched' | 'unmatched' = 'received-likes',
  page: number = 1,
  limit: number = 20
): Promise<LikesHistoryResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('likes/history', base)
  url.searchParams.set('initData', initData)
  url.searchParams.set('filter', filter)
  url.searchParams.set('page', page.toString())
  url.searchParams.set('limit', limit.toString())
  
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as LikesHistoryResponse
}

export async function clearOldLikes(initData: string): Promise<ClearOldLikesResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('likes/clear-old', base)
  
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  })
  
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as ClearOldLikesResponse
}
