export type WsEnvelope<T = unknown> = {
  ch: 'messages' | 'likes' | 'explore'
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

  connect(initData: string): void {
    if (this.ws || this.connecting) return
    this.connecting = true
    const url = new URL('/ws/messages', window.location.origin)
    url.protocol = url.protocol.replace('http', 'ws')
    url.searchParams.set('initData', initData)
    const ws = new WebSocket(url.toString())
    this.ws = ws
    ws.onopen = () => {
      this.connecting = false
      this.backoffMs = 500
      // flush queue
      const q = this.queue.splice(0)
      q.forEach(m => { try { ws.send(JSON.stringify(m)) } catch {} })
      // notify opens
      this.openListeners.forEach(cb => { try { cb() } catch {} })
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as WsEnvelope
        this.listeners.forEach(l => l(msg))
      } catch {}
    }
    ws.onclose = () => {
      this.ws = null
      this.connecting = false
      const retry = this.backoffMs
      this.backoffMs = Math.min(this.backoffMs * 2, 8000)
      window.setTimeout(() => this.connect(initData), retry)
    }
    ws.onerror = () => { /* swallow, onclose will handle reconnect */ }
  }

  send(msg: WsEnvelope): void {
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
}

export const wsClient = new WsClient()


