import { wsClient, type WsEnvelope } from './ws'

export type LikesWsEnvelope<T = unknown> = WsEnvelope<T> & {
  ch: 'likes'
}

export type LikeData = {
  id: string
  userId: string
  displayName: string
  age: number | null
  city: string | null
  photos: string[]
  bio: string | null
  heightCm: number | null
  weightKg: number | null
  wandSizeCm: number | null
  gender: string | null
  likedAt: string
  matchedAt: string | null
  isMatched: boolean
}

export type LikesStats = {
  receivedLikes: number
  sentLikes: number
  matches: number
}

export type Pagination = {
  page: number
  limit: number
  total: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

export type LikesResponse = {
  likes: LikeData[]
  pagination: Pagination
}

class LikesWsClient {
  private listeners: Set<(msg: LikesWsEnvelope) => void> = new Set()
  private cidCounter = 0
  private ws: WebSocket | null = null
  private isConnected = false
  private pendingMessages: Array<Omit<LikesWsEnvelope, 'ch'>> = []

  connect(initData: string): void {
    // Используем существующий wsClient, но подключаемся к каналу лайков
    const url = new URL('/ws/likes', window.location.origin)
    url.protocol = url.protocol.replace('http', 'ws')
    url.searchParams.set('initData', initData)
    
    // Создаем новое WebSocket соединение для лайков
    this.ws = new WebSocket(url.toString())
    
    this.ws.onopen = () => {
      this.isConnected = true
      
      // Отправляем все ожидающие сообщения
      while (this.pendingMessages.length > 0) {
        const msg = this.pendingMessages.shift()
        if (msg) {
          this.sendImmediate(msg)
        }
      }
    }
    
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as LikesWsEnvelope
        this.listeners.forEach(listener => {
          try {
            listener(msg)
          } catch (error) {
            console.error('Error in likes listener:', error)
          }
        })
      } catch (error) {
        console.error('Error parsing likes message:', error)
      }
    }
    
    this.ws.onclose = () => {
      this.ws = null
      this.isConnected = false
      // Переподключение через 3 секунды
      setTimeout(() => this.connect(initData), 3000)
    }
    
    this.ws.onerror = (error) => {
      console.error('Likes WebSocket error:', error)
    }
  }

  private sendImmediate(msg: Omit<LikesWsEnvelope, 'ch'>): void {
    const envelope: LikesWsEnvelope = {
      ...msg,
      ch: 'likes'
    }
    
    this.ws!.send(JSON.stringify(envelope))
  }

  send(msg: Omit<LikesWsEnvelope, 'ch'>): void {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendImmediate(msg)
    } else {
      this.pendingMessages.push(msg)
    }
  }

  on(listener: (msg: LikesWsEnvelope) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // Методы для работы с лайками
  getReceivedLikes(page: number = 1, limit: number = 20): void {
    const cid = String(++this.cidCounter)
    this.send({
      t: 'get_received',
      cid,
      data: { page, limit }
    })
  }

  getSentLikes(page: number = 1, limit: number = 20): void {
    const cid = String(++this.cidCounter)
    this.send({
      t: 'get_sent',
      cid,
      data: { page, limit }
    })
  }

  getStats(): void {
    const cid = String(++this.cidCounter)
    this.send({
      t: 'get_stats',
      cid
    })
  }

  likeAction(targetUserId: string, action: 'like' | 'dislike' | 'unlike'): void {
    const cid = String(++this.cidCounter)
    this.send({
      t: 'action',
      cid,
      data: { targetUserId, action }
    })
  }
}

export const likesWsClient = new LikesWsClient()
