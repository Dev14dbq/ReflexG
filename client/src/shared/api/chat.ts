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
  isOnline?: boolean
  lastSeen?: string
  peerUserId?: string
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
  stickerId: string | null
  messageType: 'TEXT' | 'IMAGE' | 'STICKER'
  createdAt: string
  replyId: string | null
  isPinned: boolean
  isEdit: boolean
}

export interface ChatHistoryResponse {
  ok: true
  items: ChatMessageItem[]
  nextCursor?: string
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

// Функция для получения онлайн статуса пользователей в чатах
export interface UserOnlineStatus {
  userId: string
  chatId: string
  isOnline: boolean
  lastSeen?: string
}

export interface UsersOnlineStatusResponse {
  ok: true
  users: UserOnlineStatus[]
}

export async function fetchUsersOnlineStatus(initData: string, chatIds: string[]): Promise<UsersOnlineStatusResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('messages/users-online-status', base)
  url.searchParams.set('initData', initData)
  url.searchParams.set('chatIds', chatIds.join(','))
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as UsersOnlineStatusResponse
}

export interface MarkAllMessagesReadResponse {
  ok: true
  unreadCount: number
}

export async function markAllMessagesRead(initData: string, chatId: string): Promise<MarkAllMessagesReadResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('messages/mark-all-read', base)
  url.searchParams.set('initData', initData)
  url.searchParams.set('chatId', chatId)
  const resp = await fetch(url.toString(), { method: 'POST' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as MarkAllMessagesReadResponse
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

export interface SendImageMessageResponse {
  ok: true
  item: ChatMessageItem
}

export async function sendImageMessage(initData: string, chatId: string, imageId: string, caption?: string): Promise<SendImageMessageResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('messages/send-image', base)
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, chatId, imageId, caption })
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as SendImageMessageResponse
}

// Sticker API
export interface StickerPack {
  id: string
  name: string
  description: string | null
  thumbnail: string | null
  isOfficial: boolean
  stickerCount: number
}

export interface Sticker {
  id: string
  name: string | null
  imageUrl: string
  emoji: string | null
}

export interface StickerPacksResponse {
  ok: true
  packs: StickerPack[]
}

export interface StickersResponse {
  ok: true
  stickers: Sticker[]
}

export async function fetchUserStickerPacks(initData: string): Promise<StickerPacksResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('stickers/packs', base)
  url.searchParams.set('initData', initData)
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as StickerPacksResponse
}

export async function fetchStickersInPack(initData: string, packId: string): Promise<StickersResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('stickers/pack', base)
  url.searchParams.set('initData', initData)
  url.searchParams.set('packId', packId)
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as StickersResponse
}

export interface SendStickerMessageResponse {
  ok: true
  item: ChatMessageItem
}

export async function sendStickerMessage(initData: string, chatId: string, stickerId: string): Promise<SendStickerMessageResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('messages/send-sticker', base)
  
  const payload = { initData, chatId, stickerId }
  console.log('Sending sticker message:', { url: url.toString(), payload })
  
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  
  console.log('Response status:', resp.status)
  
  if (!resp.ok) {
    const errorText = await resp.text()
    console.error('Error response:', errorText)
    throw new Error(`HTTP ${resp.status}: ${errorText}`)
  }
  
  const data = await resp.json()
  console.log('Response data:', data)
  
  if (!data || !data.ok) throw new Error('Bad response')
  return data as SendStickerMessageResponse
}

// Get all user stickers (flattened)
export interface UserSticker {
  id: string
  name: string | null
  imageUrl: string
  emoji: string | null
  packId: string
  packName: string
  isOfficial: boolean
}

export interface AllStickersResponse {
  ok: true
  stickers: UserSticker[]
}

export async function fetchAllUserStickers(initData: string): Promise<AllStickersResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('stickers/all', base)
  url.searchParams.set('initData', initData)
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as AllStickersResponse
}

// Import sticker pack
export interface ImportStickerPackResponse {
  ok: true
  packId: string
}

export async function importStickerPack(initData: string, telegramUrl: string): Promise<ImportStickerPackResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('stickers/import', base)
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, telegramUrl })
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as ImportStickerPackResponse
}
