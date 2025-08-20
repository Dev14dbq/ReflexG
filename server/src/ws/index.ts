import type { IncomingMessage } from 'http'
import type { WebSocket as WsType } from 'ws'
import { WebSocketServer } from 'ws'
import url from 'url'
import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'
import { ENV } from '@/config/env'
import { fetchNextProfileForUser, handleLike } from '@/services/explore'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

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
  // Track online user connections count
  const onlineUsers = new Map<string, number>()
  // Track chat subscriptions: chatId -> Set of sockets
  const chatSubscriptions = new Map<string, Set<WsType>>()

  const incrementOnline = (userId: string) => {
    const current = onlineUsers.get(userId) || 0
    onlineUsers.set(userId, current + 1)
  }

  const decrementOnline = (userId: string) => {
    const current = onlineUsers.get(userId) || 0
    if (current <= 1) onlineUsers.delete(userId)
    else onlineUsers.set(userId, current - 1)
  }

  const isUserOnline = (userId: string): boolean => onlineUsers.has(userId)

  const SubscribeSchema = z.object({ chatId: z.string().min(1) })
  const SendMessageSchema = z.object({ chatId: z.string().min(1), text: z.string().min(1).max(2000) })

  async function buildChatInfo(viewerUserId: bigint, chatId: string) {
    // verify membership
    const members = await prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } })
    const isMember = members.some(m => m.userId === viewerUserId)
    if (!isMember) return null
    const peer = members.find(m => m.userId !== viewerUserId)
    const peerUserId = peer?.userId || viewerUserId
    const peerUser = await prisma.user.findUnique({
      where: { telegramId: peerUserId },
      select: { username: true, firstName: true, photoUrl: true },
    })
    const title = peerUser?.username || peerUser?.firstName || `ID ${String(peerUserId)}`
    const avatarUrl = peerUser?.photoUrl || null
    const online = isUserOnline(String(peerUserId))
    return { id: chatId, title, avatarUrl, isOnline: online } as const
  }

  async function broadcastPresenceForUser(userId: string, isOnlineNow: boolean) {
    // Find all chats of this user
    const memberships = await prisma.chatMember.findMany({ where: { userId: BigInt(userId) }, select: { chatId: true } })
    for (const m of memberships) {
      const subs = chatSubscriptions.get(m.chatId)
      if (!subs || subs.size === 0) continue
      for (const ws of subs) {
        const client = clients.get(ws)
        if (!client) continue
        try {
          ws.send(JSON.stringify({ ch: 'messages', t: 'presence', data: { chatId: m.chatId, userId, isOnline: isOnlineNow } }))
        } catch {}
      }
    }
  }

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
      // mark online
      incrementOnline(String(userId))
      void broadcastPresenceForUser(String(userId), true)

      ws.on('close', () => {
        clients.delete(ws)
        decrementOnline(String(userId))
        void broadcastPresenceForUser(String(userId), false)
      })
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
                const safe = { ...p, userId: String(p.userId) }
                ws.send(JSON.stringify({ ch: 'explore', t: 'profile', data: safe }))
              }
            }
          }
          if (msg.ch === 'messages') {
            if (msg.t === 'subscribe') {
              const parsed = SubscribeSchema.safeParse(msg.data)
              if (!parsed.success) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Invalid subscribe payload' } }))
                return
              }
              const chatId = parsed.data.chatId
              // verify membership and build header
              const info = await buildChatInfo(client.userId, chatId)
              if (!info) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Forbidden' } }))
                return
              }
              // register subscription
              if (!chatSubscriptions.has(chatId)) chatSubscriptions.set(chatId, new Set())
              chatSubscriptions.get(chatId)!.add(ws)
              ws.send(JSON.stringify({ ch: 'messages', t: 'chat_info', cid: msg.cid, data: info }))
            } else if (msg.t === 'unsubscribe') {
              const parsed = SubscribeSchema.safeParse(msg.data)
              if (!parsed.success) return
              const chatId = parsed.data.chatId
              chatSubscriptions.get(chatId)?.delete(ws)
            } else if (msg.t === 'send') {
              const validation = SendMessageSchema.safeParse({
                chatId: String(msg.data?.chatId || ''),
                text: String(msg.data?.text || '').trim(),
              })
              if (!validation.success) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Invalid payload' } }))
                return
              }
              const { chatId, text } = validation.data
              // verify membership
              const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: client.userId } } })
              if (!member) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Forbidden' } }))
                return
              }
              // persist
              const message = await prisma.message.create({ data: { chatId, senderId: client.userId, text } })
              await prisma.chat.update({ where: { id: chatId }, data: { lastMessageAt: new Date() } })
              const payload = {
                id: message.id,
                chatId,
                senderId: String(message.senderId),
                text: message.text,
                createdAt: message.createdAt.toISOString(),
              }
              // ack to sender
              ws.send(JSON.stringify({ ch: 'messages', t: 'ack', cid: msg.cid, data: { id: message.id } }))
              // broadcast to all chat members online
              const members = await prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } })
              const memberIds = new Set(members.map(m => String(m.userId)))
              for (const c of clients.values()) {
                if (memberIds.has(String(c.userId))) {
                  c.ws.send(JSON.stringify({ ch: 'messages', t: 'message', data: payload }))
                }
              }
            }
          }
        } catch (e) {
          try {
            ws.send(JSON.stringify({ ch: 'explore', t: 'error', data: { message: 'Internal error' } }))
          } catch {}
        }
      })
      // initial hello
      ws.send(JSON.stringify({ type: 'hello', userId: String(userId) }))
    })
  })
}


