export type WsEnvelope<T = any> = {
  ch: 'messages' | 'likes' | 'explore' | 'profile' | 'moderation' | 'chats'
  t: string
  data?: T
  cid?: string
}

type Listener = (msg: WsEnvelope) => void

class WsClient {
  private ws: WebSocket | null = null
  private listeners: Set<Listener> = new Set()
  private connecting = false
  private backoffMs = 500
  private queue: WsEnvelope[] = []
  private openListeners: Set<() => void> = new Set()
  private isConnected = false

  connect(initData: string): void {
    if (this.ws || this.connecting) {
      console.log('WebSocket already connecting or connected, skipping...')
      return
    }
    this.connecting = true
    const url = new URL('/ws/messages', window.location.origin)
    url.protocol = url.protocol.replace('http', 'ws')
    url.searchParams.set('initData', initData)
    console.log('Connecting to WebSocket:', url.toString())
    const ws = new WebSocket(url.toString())
    this.ws = ws
    ws.onopen = () => {
      console.log('WebSocket connected successfully')
      this.connecting = false
      this.isConnected = true
      this.backoffMs = 500
      // flush queue
      const q = this.queue.splice(0)
      console.log('Flushing queued messages:', q.length)
      q.forEach(m => { try { ws.send(JSON.stringify(m)) } catch {} })
      // notify opens
      this.openListeners.forEach(cb => { try { cb() } catch {} })
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as WsEnvelope
        console.log('WebSocket message received:', msg)
        this.listeners.forEach(l => l(msg))
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error, ev.data)
      }
    }
    ws.onclose = () => {
      console.log('WebSocket connection closed, will retry in', this.backoffMs, 'ms')
      this.ws = null
      this.connecting = false
      this.isConnected = false
      const retry = this.backoffMs
      this.backoffMs = Math.min(this.backoffMs * 2, 8000)
      window.setTimeout(() => this.connect(initData), retry)
    }
    ws.onerror = () => { /* swallow, onclose will handle reconnect */ }
  }

  send(msg: WsEnvelope): void {
    const json = JSON.stringify(msg)
    console.log('Sending WebSocket message:', msg)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(json)
        console.log('Message sent successfully')
      } catch (error) {
        console.error('Failed to send WebSocket message:', error)
        this.queue.push(msg)
      }
    } else {
      console.warn('WebSocket not connected, queuing message:', msg)
      this.queue.push(msg)
    }
  }

  delete(msg: WsEnvelope): void {
    const json = JSON.stringify(msg)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(json)
    } else {
      this.queue.push(msg)
    }
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onOpen(cb: () => void): () => void {
    this.openListeners.add(cb)
    return () => this.openListeners.delete(cb)
  }

  getConnectionState(): boolean {
    return this.isConnected
  }
}

export const wsClient = new WsClient()


