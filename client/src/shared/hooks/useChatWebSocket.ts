import { useEffect, useCallback } from 'react'
import { wsClient } from '@/shared/lib/ws'
import type { ChatEvent, ChatEventType, ChatUserOnlineEvent, ChatCreatedEvent, ChatDeletedEvent, ChatUpdatedEvent, ChatMessageEvent } from '@/shared/lib/chatWs'
import type { ChatListItem } from '@/shared/api/chat'

interface UseChatWebSocketProps {
  onUserOnlineStatusChange?: (event: ChatUserOnlineEvent) => void
  onChatCreated?: (event: ChatCreatedEvent) => void
  onChatDeleted?: (event: ChatDeletedEvent) => void
  onChatUpdated?: (event: ChatUpdatedEvent) => void
  onNewMessage?: (event: ChatMessageEvent) => void
}

export function useChatWebSocket({
  onUserOnlineStatusChange,
  onChatCreated,
  onChatDeleted,
  onChatUpdated,
  onNewMessage
}: UseChatWebSocketProps = {}) {
  
  const handleWebSocketMessage = useCallback((envelope: any) => {
    if (envelope.ch !== 'chats') return
    
    const eventType = envelope.t as ChatEventType
    const eventData = envelope.data as ChatEvent
    
    switch (eventType) {
      case 'userOnline':
      case 'userOffline':
        onUserOnlineStatusChange?.(eventData as ChatUserOnlineEvent)
        break
        
      case 'chatCreated':
        onChatCreated?.(eventData as ChatCreatedEvent)
        break
        
      case 'chatDeleted':
        onChatDeleted?.(eventData as ChatDeletedEvent)
        break
        
      case 'chatUpdated':
        onChatUpdated?.(eventData as ChatUpdatedEvent)
        break
        
      case 'newMessage':
        onNewMessage?.(eventData as ChatMessageEvent)
        break
        
      default:
        console.warn('Unknown chat event type:', eventType)
    }
  }, [onUserOnlineStatusChange, onChatCreated, onChatDeleted, onChatUpdated, onNewMessage])
  
  useEffect(() => {
    const unsubscribe = wsClient.on(handleWebSocketMessage)
    return unsubscribe
  }, [handleWebSocketMessage])
  
  // Функции для отправки событий (если понадобятся)
  const sendChatEvent = useCallback((eventType: ChatEventType, data: ChatEvent) => {
    wsClient.send({
      ch: 'chats',
      t: eventType,
      data
    })
  }, [])
  
  return {
    sendChatEvent
  }
}
