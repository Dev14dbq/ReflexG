import express from 'express'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'
import { ENV } from '@/config/env'

const router = express.Router()

const ChatsQuery = z.object({
  initData: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

router.get('/messages/chats', async (req: express.Request, res: express.Response) => {
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
    lastMessage: string | null
  }
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT cm."chatId" as "chatId",
           COALESCE(u."username", u."firstName", 'ID ' || u."telegramId") as "title",
           u."photoUrl" as "avatarUrl",
           lm."text" as "lastMessage"
    FROM "ChatMember" cm
    JOIN "Chat" c ON c."id" = cm."chatId"
    JOIN "ChatMember" cm2 ON cm2."chatId" = cm."chatId" AND cm2."userId" <> ${userId}
    JOIN "User" u ON u."telegramId" = cm2."userId"
    LEFT JOIN LATERAL (
      SELECT m."text"
      FROM "Message" m
      WHERE m."chatId" = c."id" AND m."deletedAt" IS NULL
      ORDER BY m."createdAt" DESC
      LIMIT 1
    ) lm ON TRUE
    WHERE cm."userId" = ${userId}
    ORDER BY c."lastMessageAt" DESC NULLS LAST, c."updatedAt" DESC
    OFFSET ${page * limit}
    LIMIT ${limit}
  `

  const items = rows.map(r => ({
    id: r.chatId,
    title: r.title ?? '',
    avatarUrl: r.avatarUrl,
    lastMessage: r.lastMessage ? String(r.lastMessage).slice(0, 30) : null,
  }))

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
  cursor: z.string().optional(),
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
  // For simplicity: get last N by createdAt desc, then reverse for ascending display
  const rows = await prisma.message.findMany({
    where: { chatId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, senderId: true, text: true, photoUrl: true, createdAt: true },
  })

  const items = rows.reverse().map(r => ({
    id: r.id,
    senderId: String(r.senderId),
    text: r.text ?? '',
    photoUrl: r.photoUrl ?? null,
    createdAt: r.createdAt.toISOString(),
  }))

  return res.json({ ok: true, items })
})

export const messagesRouter = router


