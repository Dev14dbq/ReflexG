import { z } from 'zod'

import type { ChatListItem } from '@/shared/api/chat'

const ChatListItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  message: z.object({
    last: z.string().nullable(),
    time: z.string().nullable(),
  }),
  unreadCount: z.number().default(0),
  isRead: z.boolean().default(true),
  isOnline: z.boolean().optional(),
  lastSeen: z.string().optional(),
})

const ChatListResponseSchema = z.object({
  ok: z.literal(true),
  items: z.array(ChatListItemSchema),
  nextCursor: z.string().optional(),
})

type ChatState = {
  items: ChatListItem[]
  cursor: string | undefined
  lastFetched: number
}

const STORAGE_KEY = 'chat.list'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function loadFromStorage(): ChatState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: [], cursor: undefined, lastFetched: 0 }
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) return { items: [], cursor: undefined, lastFetched: 0 }
    
    // Validate cached items
    const validItems = parsed.items.filter((item: unknown) => {
      try {
        ChatListItemSchema.parse(item)
        return true
      } catch {
        return false
      }
    })
    
    return {
      items: validItems,
      cursor: parsed.cursor || undefined,
      lastFetched: parsed.lastFetched || 0,
    }
  } catch {
    return { items: [], cursor: undefined, lastFetched: 0 }
  }
}

function saveToStorage(state: ChatState): void {
  try {
    const json = JSON.stringify(state)
    window.localStorage.setItem(STORAGE_KEY, json)
  } catch {}
}

type Listener = (state: ChatState) => void

class ChatStore {
  private state: ChatState
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.state = loadFromStorage()
  }

  getState(): ChatState { return this.state }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setItems(items: ChatListItem[], cursor: string | undefined): void {
    this.state = {
      items,
      cursor,
      lastFetched: Date.now(),
    }
    saveToStorage(this.state)
    this.listeners.forEach(l => { try { l(this.state) } catch {} })
  }

  appendItems(newItems: ChatListItem[], cursor: string | undefined): void {
    const existingIds = new Set(this.state.items.map(item => item.id))
    const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id))
    
    this.state = {
      items: [...this.state.items, ...uniqueNewItems],
      cursor,
      lastFetched: Date.now(),
    }
    saveToStorage(this.state)
    this.listeners.forEach(l => { try { l(this.state) } catch {} })
  }

  updateChatItem(chatId: string, updates: Partial<Omit<ChatListItem, 'id'>>): void {
    const itemIndex = this.state.items.findIndex(item => item.id === chatId)
    if (itemIndex === -1) return
    
    const updatedItems = [...this.state.items]
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updates } as ChatListItem
    
    this.state = {
      ...this.state,
      items: updatedItems,
      lastFetched: Date.now(),
    }
    saveToStorage(this.state)
    this.listeners.forEach(l => { try { l(this.state) } catch {} })
  }

  prependItem(item: ChatListItem): void {
    const existingIds = new Set(this.state.items.map(item => item.id))
    if (existingIds.has(item.id)) return
    
    this.state = {
      ...this.state,
      items: [item, ...this.state.items],
      lastFetched: Date.now(),
    }
    saveToStorage(this.state)
    this.listeners.forEach(l => { try { l(this.state) } catch {} })
  }

  removeItem(chatId: string): void {
    this.state = {
      ...this.state,
      items: this.state.items.filter(item => item.id !== chatId),
      lastFetched: Date.now(),
    }
    saveToStorage(this.state)
    this.listeners.forEach(l => { try { l(this.state) } catch {} })
  }

  updateItem(item: ChatListItem): void {
    const itemIndex = this.state.items.findIndex(existingItem => existingItem.id === item.id)
    if (itemIndex === -1) {
      // Если элемент не найден, добавляем его в начало
      this.prependItem(item)
      return
    }
    
    const updatedItems = [...this.state.items]
    updatedItems[itemIndex] = item
    
    this.state = {
      ...this.state,
      items: updatedItems,
      lastFetched: Date.now(),
    }
    saveToStorage(this.state)
    this.listeners.forEach(l => { try { l(this.state) } catch {} })
  }

  clear(): void {
    this.state = { items: [], cursor: undefined, lastFetched: 0 }
    saveToStorage(this.state)
    this.listeners.forEach(l => { try { l(this.state) } catch {} })
  }

  isStale(): boolean {
    return Date.now() - this.state.lastFetched > CACHE_TTL
  }
}

export const chatStore = new ChatStore()
