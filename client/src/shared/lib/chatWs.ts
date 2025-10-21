import type { ChatListItem } from '@/shared/api/chat'

// Типы событий для чатов через WebSocket
export interface ChatUserOnlineEvent {
  userId: string
  chatId: string
  isOnline: boolean
  lastSeen?: string
}

export interface ChatCreatedEvent {
  chat: ChatListItem
}

export interface ChatDeletedEvent {
  chatId: string
}

export interface ChatUpdatedEvent {
  chat: ChatListItem
}

export interface ChatMessageEvent {
  chatId: string
  message: {
    id: string
    senderId: string
    text: string
    createdAt: string
  }
  unreadCount: number
}

// Объединенный тип для всех событий чатов
export type ChatEvent = 
  | ChatUserOnlineEvent
  | ChatCreatedEvent
  | ChatDeletedEvent
  | ChatUpdatedEvent
  | ChatMessageEvent

// Типы событий для идентификации
export type ChatEventType = 
  | 'userOnline'
  | 'userOffline'
  | 'chatCreated'
  | 'chatDeleted'
  | 'chatUpdated'
  | 'newMessage'
  | 'presenceSnapshot'
