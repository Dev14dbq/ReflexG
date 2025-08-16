import { requireEnvUrl } from '@/shared/config/env'

export interface ChatListItem {
  id: string
  title: string
  avatarUrl: string | null
  lastMessage: string | null
}

export interface ChatListResponse {
  ok: true
  items: ChatListItem[]
  nextCursor?: string
}

export async function fetchChats(initData: string, cursor?: string, limit = 20): Promise<ChatListResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('messages/chats', base)
  url.searchParams.set('initData', initData)
  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as ChatListResponse
}


