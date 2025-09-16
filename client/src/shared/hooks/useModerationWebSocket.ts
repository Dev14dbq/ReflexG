import { useEffect, useRef, useCallback } from 'react'

import type { ModerationStatus } from '@/shared/api/admin'

interface ModerationAction {
  itemId: string
  action: 'APPROVE' | 'REJECT' | 'DISCREPANT'
  reason?: string
  banUser?: boolean
}

interface ModerationWebSocketMessage {
  ch: string
  t: string
  cid: string | undefined
  data: any
}

export function useModerationWebSocket(
  onActionSuccess?: (data: { itemId: string; status: ModerationStatus; reason?: string; banned: boolean }) => void,
  onError?: (message: string) => void
) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      // Определяем URL вебсокета в зависимости от окружения
      const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsHost = isDev ? 'localhost:3001' : window.location.host
      const wsUrl = `${wsProtocol}//${wsHost}/ws/moderation?initData=${encodeURIComponent(initData)}`
      
      console.log('Connecting to WebSocket:', wsUrl)
      
      // Проверяем, поддерживается ли WebSocket
      if (typeof WebSocket === 'undefined') {
        console.warn('WebSocket not supported, falling back to HTTP API')
        return
      }
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('Moderation WebSocket connected')
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const message: ModerationWebSocketMessage = JSON.parse(event.data)
          
          if (message.ch === 'moderation') {
            switch (message.t) {
              case 'action_success':
                onActionSuccess?.(message.data)
                break
              case 'error':
                onError?.(message.data?.message || 'Unknown error')
                break
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = () => {
        console.log('Moderation WebSocket disconnected')
        // Переподключение через 5 секунд
        reconnectTimeoutRef.current = setTimeout(connect, 5000)
      }

      ws.onerror = (error) => {
        console.error('Moderation WebSocket error:', error)
        // При ошибке вебсокета, отключаемся и используем HTTP API
        ws.close()
      }
    } catch (error) {
      console.error('Failed to connect to moderation WebSocket:', error)
    }
  }, [onActionSuccess, onError])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const sendAction = useCallback((action: ModerationAction, cid?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message: ModerationWebSocketMessage = {
        ch: 'moderation',
        t: 'action',
        cid,
        data: action
      }
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    return false
  }, [])

  useEffect(() => {
    connect()
    return disconnect
  }, [connect, disconnect])

  return {
    sendAction,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  }
}
