import { requireEnvUrl } from '@/shared/config/env'

export interface ChatListItem {
  id: string
  title: string | null
  avatarUrl: string | null
  message: {
    last: string | null
    time: string | null
  }
  unreadCount: number
  isRead: boolean
}

export interface ChatListResponse {
  ok: true
  items: ChatListItem[]
  nextCursor?: string
}

export async function fetchChats(initData: string, cursor?: string, limit = 20): Promise<ChatListResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('chat/me', base)
  url.searchParams.set('initData', initData)
  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as ChatListResponse
}

export interface ChatInfo {
  id: string
  title: string
  avatarUrl: string | null
  isOnline: boolean
  lastSeen?: string
}

export interface ChatInfoResponse {
  ok: true
  chat: ChatInfo
}

export async function fetchChatInfo(initData: string, chatId: string): Promise<ChatInfoResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('messages/chat-info', base)
  url.searchParams.set('initData', initData)
  url.searchParams.set('chatId', chatId)
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as ChatInfoResponse
}

export interface ChatMessageItem {
  id: string
  senderId: string
  text: string
  photoUrl: string | null
  createdAt: string
  replyId: string | null
  isPinned: boolean
  isEdit: boolean
}

export interface ChatHistoryResponse {
  ok: true
  items: ChatMessageItem[]
}

export async function fetchChatMessages(initData: string, chatId: string, cursor?: string, limit = 30): Promise<ChatHistoryResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('messages/history', base)

  url.searchParams.set('initData', initData)
  url.searchParams.set('chatId', chatId)

  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))

  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as ChatHistoryResponse
}

export interface ArchiveResponse {
  ok: true
  messageCount: number
  chatTitles: string[]
}

export async function fetchArchiveData(initData: string): Promise<ArchiveResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('chat/archive', base)
  url.searchParams.set('initData', initData)
  
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as ArchiveResponse
}

export async function markMessagesAsRead(initData: string, chatId: string): Promise<{ ok: true }> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('messages/mark-as-read', base)
  
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, chatId })
  })
  
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as { ok: true }
}
