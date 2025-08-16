import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

type WsMessage = { type: string; [k: string]: unknown }

export default function ChatPage(): JSX.Element {
  const { chatId } = useParams()
  const [wsError, setWsError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const initData = window?.Telegram?.WebApp?.initData || ''
    const wsUrl = new URL('/ws/messages', window.location.origin)
    wsUrl.protocol = wsUrl.protocol.replace('http', 'ws')
    wsUrl.searchParams.set('initData', initData)
    const ws = new WebSocket(wsUrl.toString())
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setWsError('WS error')
    ws.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data as string) as WsMessage
        setLog(prev => [...prev, JSON.stringify(msg)])
      } catch {}
    }
    return () => { ws.close() }
  }, [chatId])

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="text-sm text-muted">chat: {chatId}</div>
      <div className="text-sm">ws: {connected ? 'connected' : 'disconnected'} {wsError ? `(${wsError})` : ''}</div>
      <div className="mt-2 text-xs break-words whitespace-pre-wrap">{log.join('\n')}</div>
      <div className="fixed bottom-16 left-0 right-0 px-4">
        <div className="max-w-md mx-auto flex gap-2">
          <input className="input flex-1" placeholder="Сообщение..." />
          <button className="btn btn-primary">Отправить</button>
        </div>
      </div>
    </div>
  )
}


