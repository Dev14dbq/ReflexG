export type ProfileWsEnvelope<T = unknown> = {
  ch: 'profile'
  t: string
  data?: T
  cid?: string
}

type Listener = (msg: ProfileWsEnvelope) => void

class ProfileWsClient {
  private ws: WebSocket | null = null
  private listeners: Set<Listener> = new Set()
  private connecting = false
  private backoffMs = 500
  private queue: ProfileWsEnvelope[] = []
  private openListeners: Set<() => void> = new Set()
  private closeListeners: Set<() => void> = new Set()

  connect(initData: string): void {
    if (this.ws || this.connecting) return
    console.log('ProfileWs: Starting connection...')
    this.connecting = true
    const url = new URL('/ws/profile', window.location.origin)
    url.protocol = url.protocol.replace('http', 'ws')
    url.searchParams.set('initData', initData)
    console.log('ProfileWs: Connecting to:', url.toString())
    const ws = new WebSocket(url.toString())
    this.ws = ws
    ws.onopen = () => {
      console.log('ProfileWs: WebSocket opened successfully')
      this.connecting = false
      this.backoffMs = 500
      // flush queue
      const queued = this.queue.splice(0)
      console.log('ProfileWs: Flushing queue with', queued.length, 'messages')
      queued.forEach(m => { try { ws.send(JSON.stringify(m)) } catch {} })
      // notify opens
      this.openListeners.forEach(cb => { try { cb() } catch {} })
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ProfileWsEnvelope
        console.log('ProfileWs: Received message:', msg)
        this.listeners.forEach(l => l(msg))
      } catch {}
    }
    ws.onclose = (event) => {
      console.log('ProfileWs: WebSocket closed, code:', event.code, 'reason:', event.reason)
      this.ws = null
      this.connecting = false
      this.closeListeners.forEach(cb => { try { cb() } catch {} })
      const retry = this.backoffMs
      this.backoffMs = Math.min(this.backoffMs * 2, 8000)
      console.log('ProfileWs: Will retry in', retry, 'ms')
      window.setTimeout(() => this.connect(initData), retry)
    }
    ws.onerror = (error) => { 
      console.log('ProfileWs: WebSocket error:', error)
      /* swallow, onclose will handle reconnect */ 
    }
  }

  send(msg: ProfileWsEnvelope): void {
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

  onClose(cb: () => void): () => void {
    this.closeListeners.add(cb)
    return () => this.closeListeners.delete(cb)
  }

  isOpen(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN
  }
}

export const profileWs = new ProfileWsClient()


