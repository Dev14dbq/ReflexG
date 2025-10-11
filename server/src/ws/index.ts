import { WebSocketServer, type WebSocket as WsType } from 'ws'
import type { IncomingMessage } from 'http'
import { Bot } from 'grammy'
import { z } from 'zod'
import url from 'url'

import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'
import { fetchNextProfileForUser, handleLike } from '@/services/explore'
import { safeParseDate, isValidDate } from '@/lib/dateUtils'
import { getUserRole } from '@/services/auth'
import { prisma } from '@/lib/prisma'
import { ENV } from '@/config/env'

function calcAge(birthDate: Date | null): number | null {
  if (!birthDate) return null
  const now = new Date()
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear()
  const m = now.getUTCMonth() - birthDate.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--
  return age
}

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
  
  // Функция для отправки уведомлений пользователям через бота
  async function sendModerationNotification(userId: bigint, action: string, reason?: string, isBanned = false) {
    try {
      const bot = new Bot(ENV.TELEGRAM_BOT_TOKEN || '')
      
      let message = ''
      switch (action) {
        case 'APPROVE':
          message = '✅ Ваша анкета одобрена! Теперь вы можете пользоваться сервисом.'
          break
        case 'REJECT':
          if (isBanned) {
            message = `🚫 Ваша анкета отклонена. Вы заблокированы.\n\nПричина: ${reason || 'Нарушение правил'}`
          } else {
            message = `❌ Ваша анкета отклонена.\n\nПричина: ${reason || 'Не указана'}\n\nПожалуйста, заполните анкету заново.`
          }
          break
        case 'DISCREPANT':
          message = `⚠️ В вашей анкете обнаружены некорректные данные.\n\nПроблема: ${reason || 'Не указана'}\n\nПожалуйста, исправьте указанные данные и отправьте анкету на повторную проверку.`
          break
      }
      
      await bot.api.sendMessage(Number(userId), message)
    } catch (error) {
      console.error('Failed to send moderation notification:', error)
    }
  }

  const SubscribeSchema = z.object({ chatId: z.string().min(1) })
  const SendMessageSchema = z.object({ 
    chatId: z.string().min(1), 
    text: z.string().min(1).max(2000),
    replyId: z.string().optional()
  })
  const EditMessageSchema = z.object({ 
    messageId: z.string().min(1), 
    text: z.string().min(1).max(2000) 
  })
  const DeleteMessageSchema = z.object({ messageId: z.string().min(1) })
  const PinMessageSchema = z.object({ messageId: z.string().min(1) })
  const ReplyMessageSchema = z.object({ 
    messageId: z.string().min(1), 
    text: z.string().min(1).max(2000) 
  })
  
  // Схемы для модерации
  const ModerationActionSchema = z.object({
    itemId: z.string(),
    action: z.enum(['APPROVE', 'REJECT', 'DISCREPANT']),
    reason: z.string().optional(),
    banUser: z.boolean().optional()
  })

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
    
    // Поддерживаем несколько WebSocket путей
    if (pathname !== '/ws/messages' && pathname !== '/ws/profile' && pathname !== '/ws/moderation' && pathname !== '/ws/likes') {
      return
    }
    
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
      
      // Для /ws/messages добавляем в online пользователей
      if (pathname === '/ws/messages') {
        incrementOnline(String(userId))
        void broadcastPresenceForUser(String(userId), true)
      }

      ws.on('close', () => {
        clients.delete(ws)
        // Для /ws/messages убираем из online пользователей
        if (pathname === '/ws/messages') {
          decrementOnline(String(userId))
          void broadcastPresenceForUser(String(userId), false)
        }
      })
      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(String(data)) as { ch: string; t: string; data?: any; cid?: string }
          const client = clients.get(ws)
          if (!client) {
            return
          }
          if (msg.ch === 'explore') {
            if (msg.t === 'like' || msg.t === 'dislike') {
              const targetUserIdStr = String(msg.data?.targetUserId || '')
              if (!targetUserIdStr || targetUserIdStr === '0') {
                console.error('[EXPLORE WS] Invalid targetUserId:', targetUserIdStr)
                ws.send(JSON.stringify({ ch: 'explore', t: 'error', cid: msg.cid, data: { message: 'Invalid target user ID' } }))
                return
              }
              
              try {
                const targetUserId = BigInt(targetUserIdStr)
                console.log(`[EXPLORE WS] Processing ${msg.t} from ${client.userId} to ${targetUserId}`)
                
                const { matched, chatId } = await handleLike(client.userId, targetUserId, msg.t === 'like')
                ws.send(JSON.stringify({ ch: 'explore', t: 'ack', cid: msg.cid }))
                
                if (matched && chatId) {
                  console.log(`[EXPLORE WS] Match found! ChatId: ${chatId}`)
                  ws.send(JSON.stringify({ ch: 'explore', t: 'match', data: { chatId } }))
                  // notify peer if online
                  for (const c of clients.values()) {
                    if (c.userId === targetUserId) {
                      c.ws.send(JSON.stringify({ ch: 'explore', t: 'match', data: { chatId } }))
                    }
                  }
                }
              } catch (error) {
                console.error('[EXPLORE WS] Error processing like:', error)
                ws.send(JSON.stringify({ ch: 'explore', t: 'error', cid: msg.cid, data: { message: 'Failed to process like action' } }))
              }
            } else if (msg.t === 'next') {
              try {
                const p = await fetchNextProfileForUser(client.userId)
                if (!p) {
                  console.log(`[EXPLORE WS] No more profiles for user ${client.userId}`)
                  ws.send(JSON.stringify({ ch: 'explore', t: 'profile', data: null }))
                } else {
                  console.log(`[EXPLORE WS] Sending profile to user ${client.userId}:`, {
                    userId: p.userId.toString(),
                    displayName: p.displayName,
                    photosCount: p.photos.length,
                    fullProfile: p
                  })
                  const safe = { ...p, userId: String(p.userId) }
                  console.log(`[EXPLORE WS] Safe profile data:`, safe)
                  ws.send(JSON.stringify({ ch: 'explore', t: 'profile', data: safe }))
                }
              } catch (error) {
                console.error('[EXPLORE WS] Error fetching next profile:', error)
                ws.send(JSON.stringify({ ch: 'explore', t: 'error', data: { message: 'Failed to fetch profile' } }))
              }
            }
          }
          if (msg.ch === 'profile') {
            if (msg.t === 'upload_avatar') {
              try {
                const photoUrl = String(msg.data?.photoUrl || '')
                if (!photoUrl || !photoUrl.includes('spectrmod.ru')) {
                  ws.send(JSON.stringify({ ch: 'profile', t: 'error', cid: msg.cid, data: { message: 'Only custom avatars from spectrmod.ru are allowed' } }))
                  return
                }

                // Обновляем аватар пользователя
                await prisma.user.update({
                  where: { telegramId: client.userId },
                  data: { 
                    customPhotoUrl: photoUrl,
                    lastPhotoCheck: new Date()
                  }
                })

                ws.send(JSON.stringify({ ch: 'profile', t: 'avatar_updated', cid: msg.cid, data: { photoUrl } }))
              } catch (e) {
                ws.send(JSON.stringify({ ch: 'profile', t: 'error', cid: msg.cid, data: { message: 'Failed to update avatar' } }))
              }
            } else if (msg.t === 'remove_avatar') {
              try {
                // Удаляем кастомный аватар, возвращаемся к Telegram аватару
                await prisma.user.update({
                  where: { telegramId: client.userId },
                  data: { 
                    customPhotoUrl: null,
                    lastPhotoCheck: null
                  }
                })

                ws.send(JSON.stringify({ ch: 'profile', t: 'avatar_removed', cid: msg.cid }))
              } catch (e) {
                ws.send(JSON.stringify({ ch: 'profile', t: 'error', cid: msg.cid, data: { message: 'Failed to remove avatar' } }))
              }
            } else if (msg.t === 'get_avatar') {
              try {
                const user = await prisma.user.findUnique({
                  where: { telegramId: client.userId },
                  select: { 
                    photoUrl: true, 
                    customPhotoUrl: true,
                    lastPhotoCheck: true 
                  }
                })

                if (!user) {
                  ws.send(JSON.stringify({ ch: 'profile', t: 'error', cid: msg.cid, data: { message: 'User not found' } }))
                  return
                }

                // Определяем какой аватар использовать
                let currentAvatar = user.customPhotoUrl || user.photoUrl
                let isCustom = !!user.customPhotoUrl
                let needsUpdate = false

                // Если используем Telegram аватар, проверяем актуальность
                if (!isCustom && user.photoUrl) {
                  // Проверяем раз в час
                  const ONE_HOUR = 3600000
                  const now = new Date()
                  const lastCheck = user.lastPhotoCheck

                  if (!lastCheck || (now.getTime() - lastCheck.getTime()) > ONE_HOUR) {
                    needsUpdate = true
                  }
                }

                ws.send(JSON.stringify({ 
                  ch: 'profile', 
                  t: 'avatar_info', 
                  cid: msg.cid, 
                  data: { 
                    photoUrl: currentAvatar,
                    isCustom,
                    needsUpdate,
                    telegramPhotoUrl: user.photoUrl
                  } 
                }))
              } catch (e) {
                ws.send(JSON.stringify({ ch: 'profile', t: 'error', cid: msg.cid, data: { message: 'Failed to get avatar info' } }))
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
              console.log('[WS] Send message request:', msg.data)
              const validation = SendMessageSchema.safeParse({
                chatId: String(msg.data?.chatId || ''),
                text: String(msg.data?.text || '').trim(),
                replyId: msg.data?.replyId ? String(msg.data.replyId) : undefined,
              })
              if (!validation.success) {
                console.log('[WS] Send validation failed:', validation.error)
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Invalid payload' } }))
                return
              }
              const { chatId, text, replyId } = validation.data
              // verify membership
              const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: client.userId } } })
              if (!member) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Forbidden' } }))
                return
              }
              // verify reply message exists and is in the same chat if replyId provided
              if (replyId) {
                const replyMessage = await prisma.message.findFirst({
                  where: { id: replyId, chatId, deletedAt: null }
                })
                if (!replyMessage) {
                  ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Reply message not found' } }))
                  return
                }
              }
              // persist
              const message = await prisma.message.create({ 
                data: { 
                  chatId, 
                  senderId: client.userId, 
                  text,
                  replyId: replyId || null
                } 
              })
              await prisma.chat.update({ where: { id: chatId }, data: { lastMessageAt: new Date() } })
              const payload = {
                id: message.id,
                chatId,
                senderId: String(message.senderId),
                text: message.text,
                replyId: message.replyId,
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
            } else if (msg.t === 'edit') {
              console.log('[WS] Edit message request:', msg.data)
              const validation = EditMessageSchema.safeParse({
                messageId: String(msg.data?.messageId || ''),
                text: String(msg.data?.text || '').trim(),
              })
              if (!validation.success) {
                console.log('[WS] Edit validation failed:', validation.error)
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Invalid payload' } }))
                return
              }
              const { messageId, text } = validation.data
              
              // Find message and verify ownership
              const message = await prisma.message.findFirst({
                where: { 
                  id: messageId, 
                  senderId: client.userId,
                  deletedAt: null
                },
                include: { chat: true }
              })
              if (!message) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Message not found or access denied' } }))
                return
              }
              
              // Verify membership
              const member = await prisma.chatMember.findUnique({ 
                where: { chatId_userId: { chatId: message.chatId, userId: client.userId } } 
              })
              if (!member) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Forbidden' } }))
                return
              }
              
              // Update message
              const updatedMessage = await prisma.message.update({
                where: { id: messageId },
                data: { 
                  text,
                  isEdit: true
                }
              })
              
              const payload = {
                id: updatedMessage.id,
                chatId: updatedMessage.chatId,
                senderId: String(updatedMessage.senderId),
                text: updatedMessage.text,
                replyId: updatedMessage.replyId,
                isEdit: updatedMessage.isEdit,
                createdAt: updatedMessage.createdAt.toISOString(),
              }
              
              // ack to sender
              ws.send(JSON.stringify({ ch: 'messages', t: 'ack', cid: msg.cid, data: { id: updatedMessage.id } }))
              
              // broadcast to all chat members online
              const members = await prisma.chatMember.findMany({ where: { chatId: message.chatId }, select: { userId: true } })
              const memberIds = new Set(members.map(m => String(m.userId)))
              for (const c of clients.values()) {
                if (memberIds.has(String(c.userId))) {
                  c.ws.send(JSON.stringify({ ch: 'messages', t: 'message_edited', data: payload }))
                }
              }
            } else if (msg.t === 'delete') {
              console.log('[WS] Delete message request:', msg.data)
              const validation = DeleteMessageSchema.safeParse({
                messageId: String(msg.data?.messageId || ''),
              })
              if (!validation.success) {
                console.log('[WS] Delete validation failed:', validation.error)
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Invalid payload' } }))
                return
              }
              const { messageId } = validation.data
              
              // Find message and verify ownership
              const message = await prisma.message.findFirst({
                where: { 
                  id: messageId, 
                  senderId: client.userId,
                  deletedAt: null
                },
                include: { chat: true }
              })
              if (!message) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Message not found or access denied' } }))
                return
              }
              
              // Verify membership
              const member = await prisma.chatMember.findUnique({ 
                where: { chatId_userId: { chatId: message.chatId, userId: client.userId } } 
              })
              if (!member) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Forbidden' } }))
                return
              }
              
              // Soft delete message
              await prisma.message.update({
                where: { id: messageId },
                data: { deletedAt: new Date() }
              })
              
              // ack to sender
              ws.send(JSON.stringify({ ch: 'messages', t: 'ack', cid: msg.cid, data: { id: messageId } }))
              
              // broadcast to all chat members online
              const members = await prisma.chatMember.findMany({ where: { chatId: message.chatId }, select: { userId: true } })
              const memberIds = new Set(members.map(m => String(m.userId)))
              for (const c of clients.values()) {
                if (memberIds.has(String(c.userId))) {
                  c.ws.send(JSON.stringify({ ch: 'messages', t: 'message_deleted', data: { id: messageId, chatId: message.chatId } }))
                }
              }
            } else if (msg.t === 'pin') {
              const validation = PinMessageSchema.safeParse({
                messageId: String(msg.data?.messageId || ''),
              })
              if (!validation.success) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Invalid payload' } }))
                return
              }
              const { messageId } = validation.data
              
              // Find message
              const message = await prisma.message.findFirst({
                where: { 
                  id: messageId, 
                  deletedAt: null
                },
                include: { chat: true }
              })
              if (!message) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Message not found' } }))
                return
              }
              
              // Verify membership
              const member = await prisma.chatMember.findUnique({ 
                where: { chatId_userId: { chatId: message.chatId, userId: client.userId } } 
              })
              if (!member) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Forbidden' } }))
                return
              }
              
              // Toggle pin status
              const newPinStatus = !message.isPinned
              const updatedMessage = await prisma.message.update({
                where: { id: messageId },
                data: { isPinned: newPinStatus }
              })
              
              const payload = {
                id: updatedMessage.id,
                chatId: updatedMessage.chatId,
                senderId: String(updatedMessage.senderId),
                text: updatedMessage.text,
                replyId: updatedMessage.replyId,
                isPinned: updatedMessage.isPinned,
                createdAt: updatedMessage.createdAt.toISOString(),
              }
              
              // ack to sender
              ws.send(JSON.stringify({ ch: 'messages', t: 'ack', cid: msg.cid, data: { id: updatedMessage.id } }))
              
              // broadcast to all chat members online
              const members = await prisma.chatMember.findMany({ where: { chatId: message.chatId }, select: { userId: true } })
              const memberIds = new Set(members.map(m => String(m.userId)))
              for (const c of clients.values()) {
                if (memberIds.has(String(c.userId))) {
                  c.ws.send(JSON.stringify({ ch: 'messages', t: 'message_pinned', data: payload }))
                }
              }
            } else if (msg.t === 'reply') {
              console.log('[WS] Reply message request:', msg.data)
              const validation = ReplyMessageSchema.safeParse({
                messageId: String(msg.data?.messageId || ''),
                text: String(msg.data?.text || '').trim(),
              })
              if (!validation.success) {
                console.log('[WS] Reply validation failed:', validation.error)
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Invalid payload' } }))
                return
              }
              const { messageId, text } = validation.data
              
              // Find the message being replied to
              const originalMessage = await prisma.message.findFirst({
                where: { 
                  id: messageId, 
                  deletedAt: null
                },
                include: { chat: true }
              })
              if (!originalMessage) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Original message not found' } }))
                return
              }
              
              // Verify membership
              const member = await prisma.chatMember.findUnique({ 
                where: { chatId_userId: { chatId: originalMessage.chatId, userId: client.userId } } 
              })
              if (!member) {
                ws.send(JSON.stringify({ ch: 'messages', t: 'error', cid: msg.cid, data: { message: 'Forbidden' } }))
                return
              }
              
              // Create reply message
              const replyMessage = await prisma.message.create({ 
                data: { 
                  chatId: originalMessage.chatId, 
                  senderId: client.userId, 
                  text,
                  replyId: messageId
                }
              })
              
              // Update chat last message time
              await prisma.chat.update({ where: { id: originalMessage.chatId }, data: { lastMessageAt: new Date() } })
              
              const payload = {
                id: replyMessage.id,
                chatId: replyMessage.chatId,
                senderId: String(replyMessage.senderId),
                text: replyMessage.text,
                replyId: replyMessage.replyId,
                createdAt: replyMessage.createdAt.toISOString(),
              }
              
              // ack to sender
              ws.send(JSON.stringify({ ch: 'messages', t: 'ack', cid: msg.cid, data: { id: replyMessage.id } }))
              
              // broadcast to all chat members online
              const members = await prisma.chatMember.findMany({ where: { chatId: originalMessage.chatId }, select: { userId: true } })
              const memberIds = new Set(members.map(m => String(m.userId)))
              for (const c of clients.values()) {
                if (memberIds.has(String(c.userId))) {
                  c.ws.send(JSON.stringify({ ch: 'messages', t: 'message', data: payload }))
                }
              }
            }
          }
          if (msg.ch === 'likes') {
            console.log(`[LIKES WS] Received message: ${msg.t} from user ${client.userId}`)
            if (msg.t === 'get_received') {
              try {
                const startTime = Date.now()
                console.log(`[LIKES WS] Getting received likes for user ${client.userId}`)
                const page = Number(msg.data?.page || 1)
                const limit = Number(msg.data?.limit || 20)
                const offset = (page - 1) * limit
                console.log(`[LIKES WS] Pagination params:`, {
                  userId: client.userId.toString(),
                  page,
                  limit,
                  offset,
                  cid: msg.cid
                })

                // Получаем лайки, которые получил текущий пользователь
                // Исключаем пользователей, с которыми уже есть чат
                const likes = await prisma.like.findMany({
                  where: { 
                    targetUserId: client.userId,
                    isLike: true,
                    // Исключаем лайки от пользователей, с которыми уже есть чат
                    user: {
                      NOT: {
                        chatMemberships: {
                          some: {
                            chat: {
                              members: {
                                some: {
                                  userId: client.userId
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  include: {
                    user: {
                      select: {
                        telegramId: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        photoUrl: true,
                        customPhotoUrl: true,
                        profile: {
                          select: {
                            displayName: true,
                            birthDate: true,
                            city: true,
                            description: true,
                            heightCm: true,
                            weightKg: true,
                            wandSizeCm: true,
                            gender: true,
                            initialModerationStatus: true,
                            descriptionModerationStatus: true,
                          }
                        }
                      }
                    }
                  },
                  orderBy: { createdAt: 'desc' },
                  skip: offset,
                  take: limit,
                })

                console.log(`[LIKES WS] Found ${likes.length} received likes for user ${client.userId}`)
                if (likes.length > 0) {
                  console.log(`[LIKES WS] First like details:`, {
                    likeId: `${likes[0].userId}_${likes[0].targetUserId}`,
                    fromUserId: likes[0].userId.toString(),
                    toUserId: likes[0].targetUserId.toString(),
                    userDisplayName: likes[0].user.profile?.displayName || likes[0].user.firstName,
                    hasProfile: !!likes[0].user.profile,
                    createdAt: likes[0].createdAt.toISOString(),
                    isMatched: !!likes[0].matchedAt
                  })
                }

                // Получаем фотографии для каждого пользователя
                const likesWithPhotos = await Promise.all(
                  likes.map(async (like) => {
                    const photos = await prisma.photo.findMany({
                      where: { 
                        userId: like.user.telegramId,
                        status: 'APPROVED'
                      },
                      orderBy: { position: 'asc' },
                      take: 3,
                      select: { url: true }
                    })

                    return {
                      id: `${like.userId}_${like.targetUserId}`,
                      userId: like.user.telegramId.toString(),
                      displayName: like.user.profile?.displayName || like.user.firstName || 'Без имени',
                      age: calcAge(like.user.profile?.birthDate || null),
                      city: like.user.profile?.city || null,
                      photos: photos.map(p => p.url),
                      bio: like.user.profile?.description || null,
                      heightCm: like.user.profile?.heightCm || null,
                      weightKg: like.user.profile?.weightKg || null,
                      wandSizeCm: like.user.profile?.wandSizeCm || null,
                      gender: like.user.profile?.gender || null,
                      likedAt: like.createdAt.toISOString(),
                      matchedAt: like.matchedAt?.toISOString() || null,
                      isMatched: !!like.matchedAt,
                    }
                  })
                )

                // Получаем общее количество лайков (исключая пользователей с чатами)
                const totalLikes = await prisma.like.count({
                  where: { 
                    targetUserId: client.userId,
                    isLike: true,
                    // Исключаем лайки от пользователей, с которыми уже есть чат
                    user: {
                      NOT: {
                        chatMemberships: {
                          some: {
                            chat: {
                              members: {
                                some: {
                                  userId: client.userId
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                })

                console.log(`[LIKES WS] Total received likes: ${totalLikes}, sending ${likesWithPhotos.length} likes to client`, {
                  userId: client.userId.toString(),
                  totalLikes,
                  returnedLikes: likesWithPhotos.length,
                  page,
                  limit,
                  cid: msg.cid
                })

                const response = { 
                  ch: 'likes', 
                  t: 'received_likes', 
                  cid: msg.cid, 
                  data: {
                    likes: likesWithPhotos,
                    pagination: {
                      page,
                      limit,
                      total: totalLikes,
                      pages: Math.ceil(totalLikes / limit),
                      hasNext: offset + limit < totalLikes,
                      hasPrev: page > 1,
                    }
                  }
                }
                
                console.log(`[LIKES WS] Sending received_likes response to user ${client.userId}`, {
                  likesCount: likesWithPhotos.length,
                  cid: msg.cid
                })
                
                ws.send(JSON.stringify(response))
              } catch (e) {
                console.error('[LIKES WS] Error fetching received likes:', e)
                console.error('[LIKES WS] Error details:', {
                  userId: client.userId.toString(),
                  cid: msg.cid,
                  error: e instanceof Error ? e.message : String(e),
                  stack: e instanceof Error ? e.stack : undefined,
                  timestamp: new Date().toISOString()
                })
                ws.send(JSON.stringify({ ch: 'likes', t: 'error', cid: msg.cid, data: { message: 'Failed to fetch received likes' } }))
              }
            } else if (msg.t === 'get_sent') {
              try {
                const startTime = Date.now()
                console.log(`[LIKES WS] Getting sent likes for user ${client.userId}`)
                const page = Number(msg.data?.page || 1)
                const limit = Number(msg.data?.limit || 20)
                const offset = (page - 1) * limit
                console.log(`[LIKES WS] Sent likes pagination params:`, {
                  userId: client.userId.toString(),
                  page,
                  limit,
                  offset,
                  cid: msg.cid
                })

                // Получаем лайки, которые отправил текущий пользователь
                const likes = await prisma.like.findMany({
                  where: { 
                    userId: client.userId,
                    isLike: true
                  },
                  include: {
                    target: {
                      select: {
                        telegramId: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        photoUrl: true,
                        customPhotoUrl: true,
                        profile: {
                          select: {
                            displayName: true,
                            birthDate: true,
                            city: true,
                            description: true,
                            heightCm: true,
                            weightKg: true,
                            wandSizeCm: true,
                            gender: true,
                            initialModerationStatus: true,
                            descriptionModerationStatus: true,
                          }
                        }
                      }
                    }
                  },
                  orderBy: { createdAt: 'desc' },
                  skip: offset,
                  take: limit,
                })

                console.log(`[LIKES WS] Found ${likes.length} sent likes for user ${client.userId}`)
                if (likes.length > 0) {
                  console.log(`[LIKES WS] First sent like details:`, {
                    likeId: `${likes[0].userId}_${likes[0].targetUserId}`,
                    fromUserId: likes[0].userId.toString(),
                    toUserId: likes[0].targetUserId.toString(),
                    targetDisplayName: likes[0].target.profile?.displayName || likes[0].target.firstName,
                    hasTargetProfile: !!likes[0].target.profile,
                    createdAt: likes[0].createdAt.toISOString(),
                    isMatched: !!likes[0].matchedAt
                  })
                }

                // Получаем фотографии для каждого пользователя
                const likesWithPhotos = await Promise.all(
                  likes.map(async (like) => {
                    const photos = await prisma.photo.findMany({
                      where: { 
                        userId: like.target.telegramId,
                        status: 'APPROVED'
                      },
                      orderBy: { position: 'asc' },
                      take: 3,
                      select: { url: true }
                    })

                    return {
                      id: `${like.userId}_${like.targetUserId}`,
                      userId: like.target.telegramId.toString(),
                      displayName: like.target.profile?.displayName || like.target.firstName || 'Без имени',
                      age: calcAge(like.target.profile?.birthDate || null),
                      city: like.target.profile?.city || null,
                      photos: photos.map(p => p.url),
                      bio: like.target.profile?.description || null,
                      heightCm: like.target.profile?.heightCm || null,
                      weightKg: like.target.profile?.weightKg || null,
                      wandSizeCm: like.target.profile?.wandSizeCm || null,
                      gender: like.target.profile?.gender || null,
                      likedAt: like.createdAt.toISOString(),
                      matchedAt: like.matchedAt?.toISOString() || null,
                      isMatched: !!like.matchedAt,
                    }
                  })
                )

                // Получаем общее количество отправленных лайков
                const totalLikes = await prisma.like.count({
                  where: { 
                    userId: client.userId,
                    isLike: true
                  }
                })

                console.log(`[LIKES WS] Total sent likes: ${totalLikes}, sending ${likesWithPhotos.length} likes to client`, {
                  userId: client.userId.toString(),
                  totalLikes,
                  returnedLikes: likesWithPhotos.length,
                  page,
                  limit,
                  cid: msg.cid
                })

                const response = { 
                  ch: 'likes', 
                  t: 'sent_likes', 
                  cid: msg.cid, 
                  data: {
                    likes: likesWithPhotos,
                    pagination: {
                      page,
                      limit,
                      total: totalLikes,
                      pages: Math.ceil(totalLikes / limit),
                      hasNext: offset + limit < totalLikes,
                      hasPrev: page > 1,
                    }
                  }
                }
                
                console.log(`[LIKES WS] Sending sent_likes response to user ${client.userId}`, {
                  likesCount: likesWithPhotos.length,
                  cid: msg.cid
                })

                ws.send(JSON.stringify(response))
              } catch (e) {
                console.error('[LIKES WS] Error fetching sent likes:', e)
                console.error('[LIKES WS] Error details:', {
                  userId: client.userId.toString(),
                  cid: msg.cid,
                  error: e instanceof Error ? e.message : String(e),
                  stack: e instanceof Error ? e.stack : undefined,
                  timestamp: new Date().toISOString()
                })
                ws.send(JSON.stringify({ ch: 'likes', t: 'error', cid: msg.cid, data: { message: 'Failed to fetch sent likes' } }))
              }
            } else if (msg.t === 'action') {
              try {
                const startTime = Date.now()
                const targetUserId = BigInt(String(msg.data?.targetUserId || '0'))
                const action = String(msg.data?.action || '')

                console.log(`[LIKES WS] Processing like action:`, {
                  userId: client.userId.toString(),
                  targetUserId: targetUserId.toString(),
                  action,
                  cid: msg.cid,
                  timestamp: new Date().toISOString()
                })

                if (client.userId === targetUserId) {
                  console.log(`[LIKES WS] User ${client.userId} tried to like themselves`)
                  ws.send(JSON.stringify({ ch: 'likes', t: 'error', cid: msg.cid, data: { message: 'Cannot like yourself' } }))
                  return
                }

                let result: { matched: boolean; chatId?: string } = { matched: false }

                if (action === 'unlike') {
                  // Удаляем лайк/дизлайк
                  console.log(`[LIKES WS] Removing like from ${client.userId} to ${targetUserId}`)
                  const deleteResult = await prisma.like.deleteMany({
                    where: { userId: client.userId, targetUserId }
                  })
                  console.log(`[LIKES WS] Deleted ${deleteResult.count} like records`)
                } else {
                  // Создаем или обновляем лайк/дизлайк
                  const isLike = action === 'like'
                  
                  console.log(`[LIKES WS] Upserting like:`, {
                    fromUserId: client.userId.toString(),
                    toUserId: targetUserId.toString(),
                    isLike,
                    action
                  })
                  
                  const upsertResult = await prisma.like.upsert({
                    where: { userId_targetUserId: { userId: client.userId, targetUserId } },
                    update: { isLike, createdAt: new Date() },
                    create: { userId: client.userId, targetUserId, isLike },
                  })
                  
                  console.log(`[LIKES WS] Like upserted successfully:`, {
                    likeId: `${upsertResult.userId}_${upsertResult.targetUserId}`,
                    isLike: upsertResult.isLike,
                    createdAt: upsertResult.createdAt.toISOString()
                  })

                  // Проверяем на взаимный лайк (матч)
                  if (isLike) {
                    console.log(`[LIKES WS] Checking for reciprocal like from ${targetUserId} to ${client.userId}`)
                    const reciprocal = await prisma.like.findUnique({ 
                      where: { userId_targetUserId: { userId: targetUserId, targetUserId: client.userId } } 
                    })
                    
                    console.log(`[LIKES WS] Reciprocal like check result:`, {
                      found: !!reciprocal,
                      isLike: reciprocal?.isLike,
                      matchedAt: reciprocal?.matchedAt?.toISOString()
                    })
                    
                    if (reciprocal && reciprocal.isLike) {
                      console.log(`[LIKES WS] MATCH FOUND! Updating both likes with matchedAt timestamp`)
                      // Отмечаем матч
                      await prisma.like.update({ 
                        where: { userId_targetUserId: { userId: client.userId, targetUserId } }, 
                        data: { matchedAt: new Date() } 
                      })
                      await prisma.like.update({ 
                        where: { userId_targetUserId: { userId: targetUserId, targetUserId: client.userId } }, 
                        data: { matchedAt: new Date() } 
                      })

                      // Создаем чат если его нет
                      let chatId: string | null = null
                      console.log(`[LIKES WS] Checking for existing chat between ${client.userId} and ${targetUserId}`)
                      const existing = await prisma.chatMember.findFirst({ 
                        where: { userId: client.userId, chat: { members: { some: { userId: targetUserId } } } } 
                      })
                      if (existing) {
                        chatId = existing.chatId
                        console.log(`[LIKES WS] Found existing chat: ${chatId}`)
                      }
                      if (!chatId) {
                        console.log(`[LIKES WS] Creating new chat for match between ${client.userId} and ${targetUserId}`)
                        const chat = await prisma.chat.create({ data: { isDialog: true } })
                        await prisma.chatMember.createMany({ 
                          data: [ 
                            { chatId: chat.id, userId: client.userId }, 
                            { chatId: chat.id, userId: targetUserId } 
                          ] 
                        })
                        chatId = chat.id
                        console.log(`[LIKES WS] Created new chat: ${chatId}`)
                      }
                      
                      result = { matched: true, chatId: chatId ?? undefined }
                      console.log(`[LIKES WS] Match result:`, {
                        matched: result.matched,
                        chatId: result.chatId,
                        fromUserId: client.userId.toString(),
                        toUserId: targetUserId.toString()
                      })
                    }
                  }
                }

                const response = { 
                  ch: 'likes', 
                  t: 'action_success', 
                  cid: msg.cid, 
                  data: {
                    action,
                    matched: result.matched,
                    chatId: result.chatId,
                  }
                }
                
                console.log(`[LIKES WS] Sending action_success response:`, {
                  userId: client.userId.toString(),
                  targetUserId: targetUserId.toString(),
                  action,
                  matched: result.matched,
                  chatId: result.chatId,
                  cid: msg.cid
                })
                
                ws.send(JSON.stringify(response))
              } catch (e) {
                console.error('[LIKES WS] Error processing like action:', e)
                console.error('[LIKES WS] Error details:', {
                  userId: client.userId.toString(),
                  targetUserId: msg.data?.targetUserId,
                  action: msg.data?.action,
                  cid: msg.cid,
                  error: e instanceof Error ? e.message : String(e),
                  stack: e instanceof Error ? e.stack : undefined,
                  timestamp: new Date().toISOString()
                })
                ws.send(JSON.stringify({ ch: 'likes', t: 'error', cid: msg.cid, data: { message: 'Failed to process like action' } }))
              }
            } else if (msg.t === 'get_stats') {
              try {
                const startTime = Date.now()
                console.log(`[LIKES WS] Getting stats for user ${client.userId}`)
                const [receivedLikes, sentLikes, matches] = await Promise.all([
                  // Количество полученных лайков
                  prisma.like.count({
                    where: { targetUserId: client.userId, isLike: true }
                  }),
                  // Количество отправленных лайков
                  prisma.like.count({
                    where: { userId: client.userId, isLike: true }
                  }),
                  // Количество матчей
                  prisma.like.count({
                    where: { userId: client.userId, matchedAt: { not: null } }
                  })
                ])

                console.log(`[LIKES WS] Stats retrieved:`, {
                  userId: client.userId.toString(),
                  receivedLikes,
                  sentLikes,
                  matches,
                  cid: msg.cid
                })

                const response = { 
                  ch: 'likes', 
                  t: 'stats', 
                  cid: msg.cid, 
                  data: {
                    receivedLikes,
                    sentLikes,
                    matches,
                  }
                }
                
                console.log(`[LIKES WS] Sending stats response to user ${client.userId}`)
                ws.send(JSON.stringify(response))
              } catch (e) {
                console.error('[LIKES WS] Error fetching likes stats:', e)
                console.error('[LIKES WS] Error details:', {
                  userId: client.userId.toString(),
                  cid: msg.cid,
                  error: e instanceof Error ? e.message : String(e),
                  stack: e instanceof Error ? e.stack : undefined,
                  timestamp: new Date().toISOString()
                })
                ws.send(JSON.stringify({ ch: 'likes', t: 'error', cid: msg.cid, data: { message: 'Failed to fetch stats' } }))
              }
            }
          }
          if (msg.ch === 'moderation') {
            // Проверяем роль пользователя
            try {
              const userRole = await getUserRole(client.userId)
              if (userRole !== 'MODERATOR' && userRole !== 'ADMIN') {
                ws.send(JSON.stringify({ ch: 'moderation', t: 'error', cid: msg.cid, data: { message: 'Access denied. Moderator role required.' } }))
                return
              }
              
              if (msg.t === 'action') {
                const parsed = ModerationActionSchema.safeParse(msg.data)
                if (!parsed.success) {
                  ws.send(JSON.stringify({ ch: 'moderation', t: 'error', cid: msg.cid, data: { message: 'Invalid moderation payload' } }))
                  return
                }
                
                const { itemId, action, reason, banUser } = parsed.data
                
                // Получаем элемент модерации
                const item = await prisma.moderationItem.findUnique({
                  where: { id: itemId },
                  include: { user: true }
                })
                
                if (!item) {
                  ws.send(JSON.stringify({ ch: 'moderation', t: 'error', cid: msg.cid, data: { message: 'Moderation item not found' } }))
                  return
                }
                
                let status: 'APPROVED' | 'REJECTED' | 'DISCREPANT'
                let shouldBan = false
                
                switch (action) {
                  case 'APPROVE':
                    status = 'APPROVED'
                    break
                  case 'REJECT':
                    status = 'REJECTED'
                    shouldBan = banUser || false
                    break
                  case 'DISCREPANT':
                    status = 'DISCREPANT'
                    break
                }
                
                // Обновляем статус модерации
                await prisma.moderationItem.update({
                  where: { id: itemId },
                  data: {
                    status,
                    reason,
                    resolvedAt: new Date()
                  }
                })
                
                // Если отклоняем и нужно забанить
                if (status === 'REJECTED' && shouldBan) {
                  await prisma.user.update({
                    where: { telegramId: item.userId },
                    data: {
                      isBanned: true,
                      banReason: reason || 'Нарушение правил',
                      bannedAt: new Date()
                    }
                  })
                }
                
                // Если отклоняем без бана, очищаем данные профиля
                if (status === 'REJECTED' && !shouldBan) {
                  if (item.type === 'INITIAL') {
                    await prisma.profile.update({
                      where: { userId: item.userId },
                      data: {
                        initialModerationStatus: 'PENDING',
                        initialModerationNote: null
                      }
                    })
                    
                    // Отклоняем все фотографии пользователя
                    await prisma.photo.updateMany({
                      where: { 
                        userId: item.userId,
                        status: 'PENDING'
                      },
                      data: { 
                        status: 'REJECTED',
                        note: reason || 'Отклонено'
                      }
                    })
                    
                    console.log(`[WS MODERATION] Rejected profile and all photos for user ${item.userId}`)
                  }
                  // Очищаем связанные данные в зависимости от типа
                  if (item.type === 'PHOTOS') {
                    const payload = item.payload as any
                    if (payload.photoId) {
                      await prisma.photo.delete({
                        where: { id: payload.photoId }
                      })
                    }
                  }
                }
                
                // После одобрения (APPROVE) применяем данные к профилю
                if (status === 'APPROVED') {
                  console.log(`Applying approved data for user ${item.userId}, type: ${item.type}`)
                  try {
                    if (item.type === 'PROFILE_DESCRIPTION') {
                      const payload = item.payload as any
                      const updateData: any = {
                        descriptionModerationStatus: 'APPROVED',
                        descriptionModerationNote: null
                      }
                      
                      // Применяем ВСЕ данные из payload, включая описание, рост, вес и т.д.
                      if (payload.description) updateData.description = payload.description
                      if (payload.heightCm) updateData.heightCm = payload.heightCm
                      if (payload.weightKg) updateData.weightKg = payload.weightKg
                      if (payload.city) updateData.city = payload.city
                      if (payload.displayName) updateData.displayName = payload.displayName
                      if (payload.birthDate) {
                        const parsedDate = safeParseDate(payload.birthDate)
                        if (isValidDate(parsedDate)) {
                          updateData.birthDate = parsedDate
                        } else {
                          console.warn(`Invalid birthDate format for user ${item.userId}: ${payload.birthDate}`)
                        }
                      }
                      if (payload.gender) updateData.gender = payload.gender
                      if (payload.sex) updateData.sex = payload.sex
                      if (payload.wandSizeCm) updateData.wandSizeCm = payload.wandSizeCm
                      
                      // Обновляем профиль
                      await prisma.profile.update({
                        where: { userId: item.userId },
                        data: updateData
                      })
                      console.log(`Profile description and related data updated for user ${item.userId}`)
                    }
                    
                    if (item.type === 'PHOTOS') {
                      const payload = item.payload as any
                      if (payload.photoId) {
                        await prisma.photo.update({
                          where: { id: payload.photoId },
                          data: {
                            status: 'APPROVED',
                            note: null
                          }
                        })
                        console.log(`Photo approved for user ${item.userId}, photoId: ${payload.photoId}`)
                      }
                    }
                    
                    if (item.type === 'INITIAL') {
                      const payload = item.payload as any
                      const updateData: any = {
                        initialModerationStatus: 'APPROVED',
                        initialModerationNote: null
                      }
                      
                      // Применяем все одобренные данные из payload
                      if (payload.city) updateData.city = payload.city
                      if (payload.displayName) updateData.displayName = payload.displayName
                      if (payload.birthDate) {
                        const parsedDate = safeParseDate(payload.birthDate)
                        if (isValidDate(parsedDate)) {
                          updateData.birthDate = parsedDate
                        } else {
                          console.warn(`Invalid birthDate format for user ${item.userId}: ${payload.birthDate}`)
                        }
                      }
                      if (payload.gender) updateData.gender = payload.gender
                      if (payload.sex) updateData.sex = payload.sex
                      if (payload.description) updateData.description = payload.description
                      if (payload.heightCm) updateData.heightCm = payload.heightCm
                      if (payload.weightKg) updateData.weightKg = payload.weightKg
                      if (payload.wandSizeCm) updateData.wandSizeCm = payload.wandSizeCm
                      
                      await prisma.profile.update({
                        where: { userId: item.userId },
                        data: updateData
                      })
                      
                      // Одобряем все фотографии пользователя
                      await prisma.photo.updateMany({
                        where: { 
                          userId: item.userId,
                          status: 'PENDING'
                        },
                        data: { 
                          status: 'APPROVED',
                          note: null
                        }
                      })
                      
                      console.log(`Initial profile data and all photos applied for user ${item.userId}`)
                    }
                    
                    if (item.type === 'PROFILE_EDIT') {
                      const payload = item.payload as any
                      const updateData: any = {}
                      
                      // Применяем изменения из payload
                      if (payload.city !== undefined) updateData.city = payload.city
                      if (payload.displayName !== undefined) updateData.displayName = payload.displayName
                      if (payload.birthDate !== undefined) {
                        const parsedDate = safeParseDate(payload.birthDate)
                        if (isValidDate(parsedDate)) {
                          updateData.birthDate = parsedDate
                        } else {
                          console.warn(`Invalid birthDate format for user ${item.userId}: ${payload.birthDate}`)
                        }
                      }
                      if (payload.gender !== undefined) updateData.gender = payload.gender
                      if (payload.sex !== undefined) updateData.sex = payload.sex
                      if (payload.description !== undefined) updateData.description = payload.description
                      if (payload.heightCm !== undefined) updateData.heightCm = payload.heightCm
                      if (payload.weightKg !== undefined) updateData.weightKg = payload.weightKg
                      if (payload.wandSizeCm !== undefined) updateData.wandSizeCm = payload.wandSizeCm
                      
                      if (Object.keys(updateData).length > 0) {
                        await prisma.profile.update({
                          where: { userId: item.userId },
                          data: updateData
                        })
                        console.log(`Profile updated for user ${item.userId}, type: ${item.type}`)
                      }
                    }
                    
                    console.log(`Successfully applied approved data for user ${item.userId}, type: ${item.type}`)
                  } catch (error) {
                    console.error('Error applying approved data to profile:', error)
                    // Отправляем ошибку модератору, но не прерываем процесс
                    ws.send(JSON.stringify({ 
                      ch: 'moderation', 
                      t: 'error', 
                      cid: msg.cid, 
                      data: { message: 'Data approved but failed to apply to profile' } 
                    }))
                  }
                }
                
                // Отправляем уведомление пользователю
                await sendModerationNotification(item.userId, action, reason, shouldBan)
                
                // Отправляем подтверждение модератору
                ws.send(JSON.stringify({ 
                  ch: 'moderation', 
                  t: 'action_success', 
                  cid: msg.cid, 
                  data: { 
                    itemId,
                    status,
                    reason,
                    banned: shouldBan
                  } 
                }))
              }
            } catch (error) {
              console.error('Moderation error:', error)
              ws.send(JSON.stringify({ ch: 'moderation', t: 'error', cid: msg.cid, data: { message: 'Internal moderation error' } }))
            }
          }
        } catch (e) {
          const client = clients.get(ws)
          console.error('[WS] Error processing message:', {
            error: e instanceof Error ? e.message : String(e),
            userId: client?.userId.toString() || 'unknown',
            pathname,
            timestamp: new Date().toISOString()
          })
          try {
            ws.send(JSON.stringify({ ch: 'explore', t: 'error', data: { message: 'Internal error' } }))
          } catch {}
        }
      })

      // initial hello
      ws.send(JSON.stringify({
        type: 'hello',
        userId: String(userId)
      }))
    })
  })
}


