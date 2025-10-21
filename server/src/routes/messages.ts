import express from 'express'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'
import { ENV } from '@/config/env'
import { importStickerPackFromTelegram } from '@/lib/telegramStickerImport'

const router = express.Router()

const ChatsQuery = z.object({
  initData: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

router.get('/chat/me', async (req: express.Request, res: express.Response) => {
  const parsed = ChatsQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid query' })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })
    
  const v = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  // TODO: fetch chats from DB; mock for now
  const page = Number(parsed.data.cursor || 0) || 0
  const limit = parsed.data.limit
  const userId = BigInt(v.user.id)
  type Row = {
    chatId: string
    title: string | null
    avatarUrl: string | null
    message: {
      last: string | null
      time: string | null
    }
    unreadCount: number
    isRead: boolean
  }
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT 
      cm."chatId" as "chatId",
      COALESCE(u."firstName", 'ID ' || u."telegramId") as "title",
      u."photoUrl" as "avatarUrl",
      json_build_object(
        'last', lm."text",
        'time', lm."createdAt"
      ) as "message",
      COALESCE(unread_count.count, 0) as "unreadCount",
      CASE 
        WHEN cm."lastReadMessageId" IS NOT NULL AND lm."id" IS NOT NULL AND cm."lastReadMessageId" = lm."id" THEN true
        WHEN cm."lastReadMessageId" IS NULL AND lm."id" IS NULL THEN true
        ELSE false
      END as "isRead"
    
    FROM "ChatMember" cm
    JOIN "Chat" c ON c."id" = cm."chatId"
    JOIN "ChatMember" cm2 ON cm2."chatId" = cm."chatId" AND cm2."userId" <> ${userId}
    JOIN "User" u ON u."telegramId" = cm2."userId"
    LEFT JOIN LATERAL (
      SELECT m."id", m."text", m."createdAt"
      FROM "Message" m
      WHERE m."chatId" = c."id" AND m."deletedAt" IS NULL
      ORDER BY m."createdAt" DESC
      LIMIT 1
    ) lm ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as count
      FROM "Message" m
      WHERE m."chatId" = c."id" 
        AND m."deletedAt" IS NULL
        AND m."senderId" <> ${userId}
        AND (cm."lastReadMessageId" IS NULL OR m."createdAt" > (
          SELECT m2."createdAt" 
          FROM "Message" m2 
          WHERE m2."id" = cm."lastReadMessageId"
        ))
    ) unread_count ON TRUE
    WHERE cm."userId" = ${userId} AND c."isArchived" = false
    ORDER BY c."lastMessageAt" DESC NULLS LAST, c."updatedAt" DESC
    OFFSET ${page * limit}
    LIMIT ${limit}
  `;
  
  const items = rows.map(r => ({
    id: r.chatId,
    title: r.title ?? '',
    avatarUrl: r.avatarUrl,
    message: {
      last: r.message?.last ? String(r.message?.last).slice(0, 30) : null,
      time: r.message?.time
    },
    unreadCount: r.unreadCount,
    isRead: r.isRead
  }));

  const totalRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint as count FROM "ChatMember" WHERE "userId" = ${userId}
  `
  const total = Number(totalRows[0]?.count || 0)
  const nextCursor = (page + 1) * limit < total ? String(page + 1) : undefined

  return res.json({ ok: true, items, nextCursor })
})

const ChatHistoryQuery = z.object({
  initData: z.string().min(1),
  chatId: z.string().min(1),
  cursor: z.string().optional(), // ISO date string of the oldest message currently loaded
  limit: z.coerce.number().int().min(1).max(50).default(30),
})

router.get('/messages/history', async (req: express.Request, res: express.Response) => {
  const parsed = ChatHistoryQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid query' })
  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })
  const v = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(v.user.id)
  const chatId = parsed.data.chatId
  // verify membership
  const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } })
  if (!member) return res.status(403).json({ message: 'Forbidden' })

  const limit = parsed.data.limit
  const cursorIso = parsed.data.cursor
  const cursorDate = cursorIso ? new Date(cursorIso) : null

  // Always fetch limit + 1 to detect if there are more items
  const take = limit + 1

  const rows = await prisma.message.findMany({
    where: {
      chatId,
      deletedAt: null,
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, senderId: true, text: true, photoUrl: true, createdAt: true, replyId: true, isPinned: true, isEdit: true },
  })

  const hasMore = rows.length > limit
  const limited = hasMore ? rows.slice(0, limit) : rows

  const items = limited.reverse().map(r => ({
    id: r.id,
    senderId: String(r.senderId),
    text: r.text ?? '',
    photoUrl: r.photoUrl ?? null,
    createdAt: r.createdAt.toISOString(),
    replyId: r.replyId ?? null,
    isPinned: r.isPinned ?? false,
    isEdit: r.isEdit ?? false,
  }))

  // Next cursor is the ISO timestamp of the oldest item we just returned
  const nextCursor = hasMore && items.length > 0 ? items[0]!.createdAt : undefined

  return res.json({ ok: true, items, nextCursor })
})

const ChatInfoQuery = z.object({
  initData: z.string().min(1),
  chatId: z.string().min(1),
})

router.get('/messages/chat-info', async (req: express.Request, res: express.Response) => {
  const parsed = ChatInfoQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid query' })
  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })
  const v = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(v.user.id)
  const chatId = parsed.data.chatId
  // verify membership
  const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } })
  if (!member) return res.status(403).json({ message: 'Forbidden' })

  // Get chat info and other member info
  const chatInfo = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        where: { userId: { not: userId } },
        include: { user: true }
      }
    }
  })

  if (!chatInfo) return res.status(404).json({ message: 'Chat not found' })

  const otherMember = chatInfo.members[0]?.user
  if (!otherMember) return res.status(404).json({ message: 'Other member not found' })

  const chat = {
    id: chatInfo.id,
    title: otherMember.firstName || `ID ${otherMember.telegramId}`,
    avatarUrl: otherMember.photoUrl,
    isOnline: false, // This would need to be tracked separately
  }

  return res.json({ ok: true, chat })
})

// Get users online status for chat list (fallback implementation: all offline)
const UsersOnlineStatusQuery = z.object({
  initData: z.string().min(1),
  chatIds: z.string().min(1), // comma-separated chat ids
})

router.get('/messages/users-online-status', async (req: express.Request, res: express.Response) => {
  const parsed = UsersOnlineStatusQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid query' })
  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })
  const v = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(v.user.id)
  const chatIds = parsed.data.chatIds.split(',').map(s => s.trim()).filter(Boolean)
  if (chatIds.length === 0) return res.json({ ok: true, users: [] })

  // Verify membership and find peer users for each chat
  const memberships = await prisma.chatMember.findMany({
    where: { chatId: { in: chatIds }, },
    select: { chatId: true, userId: true }
  })

  const users = chatIds.map(chatId => {
    const m = memberships.filter(x => x.chatId === chatId)
    const peer = m.find(x => x.userId !== userId)
    const peerUserId = peer?.userId ? String(peer.userId) : String(userId)
    return { userId: peerUserId, chatId, isOnline: false as boolean }
  })

  return res.json({ ok: true, users })
})

const ArchiveQuery = z.object({
  initData: z.string().min(1),
})

router.get('/chat/archive', async (req: express.Request, res: express.Response) => {
  const parsed = ArchiveQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid query' })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })
    
  const v = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(v.user.id)

  // Получаем данные архива
  const archiveData = await prisma.$queryRaw<{
    messageCount: number
    chatTitles: string[]
  }[]>`
    SELECT 
      COUNT(m."id")::int as "messageCount",
      array_agg(DISTINCT COALESCE(u."firstName", 'ID ' || u."telegramId")) as "chatTitles"
    FROM "ChatMember" cm
    JOIN "Chat" c ON c."id" = cm."chatId"
    JOIN "ChatMember" cm2 ON cm2."chatId" = cm."chatId" AND cm2."userId" <> ${userId}
    JOIN "User" u ON u."telegramId" = cm2."userId"
    LEFT JOIN "Message" m ON m."chatId" = c."id" AND m."deletedAt" IS NULL
    WHERE cm."userId" = ${userId} AND c."isArchived" = true
  `

  const result = archiveData[0] || { messageCount: 0, chatTitles: [] }

  return res.json({ 
    ok: true, 
    messageCount: result.messageCount,
    chatTitles: result.chatTitles || []
  })
})

const MarkAsReadQuery = z.object({
  initData: z.string().min(1),
  chatId: z.string().min(1),
})

router.post('/messages/mark-as-read', async (req: express.Request, res: express.Response) => {
  const parsed = MarkAsReadQuery.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })
    
  const v = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(v.user.id)
  const chatId = parsed.data.chatId

  // Получаем последнее сообщение в чате
  const lastMessage = await prisma.message.findFirst({
    where: { 
      chatId, 
      deletedAt: null,
      senderId: { not: userId } // Только сообщения от других пользователей
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  })

  if (lastMessage) {
    // Обновляем lastReadMessageId для пользователя
    await prisma.chatMember.update({
      where: { 
        chatId_userId: { chatId, userId }
      },
      data: { 
        lastReadMessageId: lastMessage.id 
      }
    })
  }

  // Посчитаем оставшиеся непрочитанные сообщения
  const unreadCount = await prisma.message.count({
    where: { 
      chatId, 
      deletedAt: null,
      senderId: { not: userId },
      createdAt: { 
        gt: (await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } }, select: { lastReadMessageId: true } }))?.lastReadMessageId
          ? (await prisma.message.findUnique({ where: { id: (await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } }, select: { lastReadMessageId: true } }))!.lastReadMessageId! }, select: { createdAt: true } }))!.createdAt
          : new Date(0)
      }
    }
  })

  return res.json({ ok: true, unreadCount })
})

// Create an image message (optionally with a caption)
const SendImageMessageDto = z.object({
  initData: z.string().min(1),
  chatId: z.string().min(1),
  imageId: z.string().min(8), // Cloudflare Images id
  caption: z.string().max(4000).optional()
})

router.post('/messages/send-image', async (req: express.Request, res: express.Response) => {
  const parsed = SendImageMessageDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })

  const v = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(v.user.id)
  const { chatId, imageId, caption } = parsed.data

  // Verify membership
  const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } })
  if (!member) return res.status(403).json({ message: 'Forbidden' })

  // Create message with photoUrl as Cloudflare image id
  const created = await prisma.message.create({
    data: {
      chatId,
      senderId: userId,
      text: caption || null,
      photoUrl: imageId,
      isPinned: false,
      isEdit: false
    },
    select: { id: true, senderId: true, text: true, photoUrl: true, createdAt: true, replyId: true, isPinned: true, isEdit: true }
  })

  // Update chat last activity
  await prisma.chat.update({ where: { id: chatId }, data: { lastMessageAt: created.createdAt } })

  // Broadcast to WebSocket clients
  try {
    const { broadcastMessage } = await import('@/ws/index')
    const payload = {
      id: created.id,
      chatId,
      senderId: String(created.senderId),
      text: created.text ?? '',
      photoUrl: created.photoUrl ?? null,
      stickerId: null,
      messageType: 'IMAGE',
      replyId: created.replyId ?? null,
      isPinned: created.isPinned ?? false,
      isEdit: created.isEdit ?? false,
      createdAt: created.createdAt.toISOString(),
    }
    broadcastMessage(chatId, payload)
  } catch (error) {
    console.error('[SEND-IMAGE] Failed to broadcast WebSocket message:', error)
  }

  // Response mirrors history item shape
  return res.json({ ok: true, item: {
    id: created.id,
    senderId: String(created.senderId),
    text: created.text ?? '',
    photoUrl: created.photoUrl ?? null,
    stickerId: null,
    messageType: 'IMAGE',
    createdAt: created.createdAt.toISOString(),
    replyId: created.replyId ?? null,
    isPinned: created.isPinned ?? false,
    isEdit: created.isEdit ?? false,
  } })
})

// Get user's sticker packs
router.get('/stickers/packs', async (req: express.Request, res: express.Response) => {
  const initData = req.query.initData as string
  if (!initData) return res.status(400).json({ message: 'initData query parameter is required' })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })

  const v = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(v.user.id)

  try {
    const packs = await prisma.stickerPack.findMany({
      where: {
        isActive: true,
        users: {
          some: { userId }
        }
      },
      include: {
        _count: {
          select: { stickers: true }
        }
      },
      orderBy: [
        { isOfficial: 'desc' },
        { name: 'asc' }
      ]
    })

    const result = packs.map((pack: any) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      thumbnail: pack.thumbnail,
      isOfficial: pack.isOfficial,
      stickerCount: pack._count.stickers
    }))

    return res.json({ ok: true, packs: result })
  } catch (e) {
    console.error('Error fetching sticker packs:', e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// Get stickers in a pack
router.get('/stickers/pack', async (req: express.Request, res: express.Response) => {
  const initData = req.query.initData as string
  const packId = req.query.packId as string
  if (!initData || !packId) return res.status(400).json({ message: 'Missing parameters' })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })

  const v = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(v.user.id)

  try {
    // Verify user has access to this pack
    const userPack = await prisma.userStickerPack.findUnique({
      where: { userId_packId: { userId, packId } }
    })
    if (!userPack) return res.status(403).json({ message: 'Pack not owned by user' })

    const stickers = await prisma.sticker.findMany({
      where: { packId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        emoji: true
      }
    })

    return res.json({ ok: true, stickers })
  } catch (e) {
    console.error('Error fetching stickers:', e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// Send sticker message
const SendStickerMessageDto = z.object({
  initData: z.string().min(1),
  chatId: z.string().min(1),
  stickerId: z.string().min(1)
})

router.post('/messages/send-sticker', async (req: express.Request, res: express.Response) => {
  console.log('[SEND-STICKER] Received request:', req.body)
  
  const parsed = SendStickerMessageDto.safeParse(req.body)
  if (!parsed.success) {
    console.log('[SEND-STICKER] Validation failed:', parsed.error.issues)
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })
  }

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })

  const v = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) {
    console.log('[SEND-STICKER] Auth failed:', v)
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const userId = BigInt(v.user.id)
  const { chatId, stickerId } = parsed.data
  
  console.log('[SEND-STICKER] Processing:', { userId: userId.toString(), chatId, stickerId })

  try {
    // Verify membership
    const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } })
    if (!member) {
      console.log('[SEND-STICKER] User not a member of chat:', { userId: userId.toString(), chatId })
      return res.status(403).json({ message: 'Forbidden' })
    }

    // Verify sticker exists and user has access
    const sticker = await prisma.sticker.findFirst({
      where: {
        id: stickerId,
        pack: {
          users: {
            some: { userId }
          }
        }
      }
    })
    console.log('[SEND-STICKER] Sticker found:', !!sticker)
    if (!sticker) {
      console.log('[SEND-STICKER] Sticker not found or no access:', { stickerId, userId: userId.toString() })
      return res.status(404).json({ message: 'Sticker not found or access denied' })
    }

    // Create message
    const created = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        stickerId,
        messageType: 'STICKER',
        isPinned: false,
        isEdit: false
      },
      select: { id: true, senderId: true, text: true, photoUrl: true, stickerId: true, messageType: true, createdAt: true, replyId: true, isPinned: true, isEdit: true }
    })

    // Update chat last activity
    await prisma.chat.update({ where: { id: chatId }, data: { lastMessageAt: created.createdAt } })

    // Broadcast to WebSocket clients
    try {
      const { broadcastMessage } = await import('@/ws/index')
      const payload = {
        id: created.id,
        chatId,
        senderId: String(created.senderId),
        text: created.text ?? '',
        // Для стикеров отдаем прямой imageUrl, чтобы фронт рендерил из photoUrl
        photoUrl: sticker.imageUrl,
        stickerId: (created as any).stickerId ?? null,
        messageType: (created as any).messageType,
        replyId: created.replyId ?? null,
        isPinned: created.isPinned ?? false,
        isEdit: created.isEdit ?? false,
        createdAt: created.createdAt.toISOString(),
      }
      broadcastMessage(chatId, payload)
    } catch (error) {
      console.error('[SEND-STICKER] Failed to broadcast WebSocket message:', error)
    }

    return res.json({ ok: true, item: {
      id: created.id,
      senderId: String(created.senderId),
      text: created.text ?? '',
      // Для стикеров отдаем прямой imageUrl, чтобы фронт рендерил из photoUrl
      photoUrl: sticker.imageUrl,
      stickerId: (created as any).stickerId ?? null,
      messageType: (created as any).messageType,
      createdAt: created.createdAt.toISOString(),
      replyId: created.replyId ?? null,
      isPinned: created.isPinned ?? false,
      isEdit: created.isEdit ?? false,
    } })
  } catch (e) {
    console.error('Error sending sticker:', e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// Get all user stickers (flattened from all packs)
router.get('/stickers/all', async (req: express.Request, res: express.Response) => {
  const initData = req.query.initData as string
  if (!initData) return res.status(400).json({ message: 'initData query parameter is required' })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })

  const v = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(v.user.id)
  
  console.log('[STICKERS-ALL] Fetching stickers for user:', userId.toString())

  try {
    const stickers = await prisma.sticker.findMany({
      where: {
        pack: {
          isActive: true,
          users: {
            some: { userId }
          }
        }
      },
      include: {
        pack: {
          select: {
            id: true,
            name: true,
            isOfficial: true
          }
        }
      },
      orderBy: [
        { pack: { isOfficial: 'desc' } },
        { pack: { name: 'asc' } },
        { position: 'asc' }
      ]
    })

    console.log('[STICKERS-ALL] Found stickers:', stickers.length)

    const result = stickers.map(sticker => ({
      id: sticker.id,
      name: sticker.name,
      imageUrl: sticker.imageUrl,
      emoji: sticker.emoji,
      packId: sticker.pack.id,
      packName: sticker.pack.name,
      isOfficial: sticker.pack.isOfficial
    }))

    return res.json({ ok: true, stickers: result })
  } catch (e) {
    console.error('Error fetching all stickers:', e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// Import sticker pack from Telegram
const ImportStickerPackDto = z.object({
  initData: z.string().min(1),
  telegramUrl: z.string().url()
})

router.post('/stickers/import', async (req: express.Request, res: express.Response) => {
  const parsed = ImportStickerPackDto.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured' })

  const v = verifyTelegramInitData(parsed.data.initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!v.ok || !v.user) return res.status(401).json({ message: 'Unauthorized' })

  const userId = BigInt(v.user.id)
  const { telegramUrl } = parsed.data

  try {
    const result = await importStickerPackFromTelegram(telegramUrl, userId)
    
    if (result.success) {
      return res.json({ ok: true, packId: result.packId })
    } else {
      return res.status(400).json({ ok: false, message: result.error })
    }
  } catch (e) {
    console.error('Error importing sticker pack:', e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

export const messagesRouter = router


