import type { IncomingMessage } from 'http'
import type { WebSocket as WsType } from 'ws'
import { WebSocketServer } from 'ws'
import url from 'url'
import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'
import { ENV } from '@/config/env'
import { fetchNextProfileForUser, handleLike } from '@/services/explore'

type Client = {
  ws: WsType
  userId: bigint
}

type Message = {
  id: string
  chatId: string
  senderId: string
  text?: string
  photoUrl?: string
  createdAt: number
}

export function attachWsServer(server: import('http').Server): void {
  const wss = new WebSocketServer({ noServer: true })
  const clients = new Map<WsType, Client>()

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const { pathname, query } = url.parse(req.url || '', true)
    if (pathname !== '/ws/messages') return
    const initData = (query?.initData as string) || ''
    const token = ENV.TELEGRAM_BOT_TOKEN
    const v = token ? verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS) : { ok: false }
    if (!v.ok || !v.user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, ws => {
      const userId = BigInt(v.user!.id)
      clients.set(ws, { ws, userId })
      ws.on('close', () => { clients.delete(ws) })
      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(String(data)) as { ch: string; t: string; data?: any; cid?: string }
          const client = clients.get(ws)
          if (!client) return
          if (msg.ch === 'explore') {
            if (msg.t === 'like' || msg.t === 'dislike') {
              const targetUserId = BigInt(String(msg.data?.targetUserId || '0'))
              const { matched, chatId } = await handleLike(client.userId, targetUserId, msg.t === 'like')
              ws.send(JSON.stringify({ ch: 'explore', t: 'ack', cid: msg.cid }))
              if (matched && chatId) {
                ws.send(JSON.stringify({ ch: 'explore', t: 'match', data: { chatId } }))
                // notify peer if online
                for (const c of clients.values()) {
                  if (c.userId === targetUserId) {
                    c.ws.send(JSON.stringify({ ch: 'explore', t: 'match', data: { chatId } }))
                  }
                }
              }
            } else if (msg.t === 'next') {
              const p = await fetchNextProfileForUser(client.userId)
              if (!p) {
                ws.send(JSON.stringify({ ch: 'explore', t: 'profile', data: null }))
              } else {
                ws.send(JSON.stringify({ ch: 'explore', t: 'profile', data: p }))
              }
            }
          }
        } catch {}
      })
      // initial hello
      ws.send(JSON.stringify({ type: 'hello', userId: String(userId) }))
    })
  })
}


