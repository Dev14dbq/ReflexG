import express from 'express'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyTelegramInitData } from '@/lib/auth/verifyTelegramInitData'
import { ENV } from '@/config/env'

const router = express.Router()

// ===== Schemas =====

const GetLikesDto = z.object({
  initData: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const LikeActionDto = z.object({
  initData: z.string().min(1),
  targetUserId: z.string().min(1),
  action: z.enum(['like', 'dislike', 'unlike']),
})

// ===== Helpers =====

function calcAge(birthDate: Date | null): number | null {
  if (!birthDate) return null
  const now = new Date()
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear()
  const m = now.getUTCMonth() - birthDate.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--
  return age
}

// ===== Routes =====

// Получение списка лайков (кто лайкнул меня)
router.get('/likes/received', async (req: express.Request, res: express.Response) => {
  const parsed = GetLikesDto.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })
  }

  const { initData, page, limit } = parsed.data

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const userId = BigInt(verification.user.id)
    const offset = (page - 1) * limit

    // Получаем лайки, которые получил текущий пользователь
    // Исключаем пользователей, с которыми уже есть чат
    const likes = await prisma.like.findMany({
      where: { 
        targetUserId: userId,
        isLike: true, // только лайки, не дизлайки
        // Исключаем лайки от пользователей, с которыми уже есть чат
        user: {
          NOT: {
            chatMemberships: {
              some: {
                chat: {
                  members: {
                    some: {
                      userId: userId
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

    console.log(`[LIKES HTTP] Found ${likes.length} received likes for user ${userId}`)

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
        targetUserId: userId,
        isLike: true,
        // Исключаем лайки от пользователей, с которыми уже есть чат
        user: {
          NOT: {
            chatMemberships: {
              some: {
                chat: {
                  members: {
                    some: {
                      userId: userId
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    console.log(`[LIKES HTTP] Total received likes: ${totalLikes}, sending ${likesWithPhotos.length} likes to client`)

    return res.json({
      ok: true,
      likes: likesWithPhotos,
      pagination: {
        page,
        limit,
        total: totalLikes,
        pages: Math.ceil(totalLikes / limit),
        hasNext: offset + limit < totalLikes,
        hasPrev: page > 1,
      }
    })
  } catch (e) {
    console.error('[LIKES HTTP] Error fetching received likes:', e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// Получение списка отправленных лайков (кого я лайкнул)
router.get('/likes/sent', async (req: express.Request, res: express.Response) => {
  const parsed = GetLikesDto.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })
  }

  const { initData, page, limit } = parsed.data

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) {
    console.log('[LIKES HTTP] Unauthorized request for sent likes', {
      verificationOk: verification.ok,
      hasUser: !!verification.user,
      timestamp: new Date().toISOString()
    })
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const startTime = Date.now()
    const userId = BigInt(verification.user.id)
    const offset = (page - 1) * limit
    console.log(`[LIKES HTTP] Getting sent likes for user ${userId}`, {
      userId: userId.toString(),
      page,
      limit,
      offset,
      timestamp: new Date().toISOString()
    })

    // Получаем лайки, которые отправил текущий пользователь
    const likes = await prisma.like.findMany({
      where: { 
        userId: userId,
        isLike: true // только лайки, не дизлайки
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

    console.log(`[LIKES HTTP] Found ${likes.length} sent likes for user ${userId}`)
    if (likes.length > 0) {
      console.log(`[LIKES HTTP] First sent like details:`, {
        likeId: `${likes[0].userId}_${likes[0].targetUserId}`,
        fromUserId: likes[0].userId.toString(),
        toUserId: likes[0].targetUserId.toString(),
        targetDisplayName: likes[0].target.profile?.displayName || likes[0].target.firstName,
        hasTargetProfile: !!likes[0].target.profile,
        createdAt: likes[0].createdAt.toISOString(),
        isMatched: !!likes[0].matchedAt,
        timestamp: new Date().toISOString()
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
        userId: userId,
        isLike: true
      }
    })

    console.log(`[LIKES HTTP] Total sent likes: ${totalLikes}, sending ${likesWithPhotos.length} likes to client`, {
      userId: userId.toString(),
      totalLikes,
      returnedLikes: likesWithPhotos.length,
      page,
      limit,
      timestamp: new Date().toISOString()
    })

    const response = {
      ok: true,
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
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`[LIKES HTTP] Sending sent likes response`, {
      userId: userId.toString(),
      responseSize: JSON.stringify(response).length,
      likesCount: likesWithPhotos.length,
      duration: `${duration}ms`,
      performance: {
        totalTime: duration,
        likesPerMs: likesWithPhotos.length / duration,
        responseSizeKB: Math.round(JSON.stringify(response).length / 1024 * 100) / 100
      },
      timestamp: new Date().toISOString()
    })

    return res.json(response)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Internal error' })
  }
})

// Действия с лайками (лайк/дизлайк/анлайк)
router.post('/likes/action', async (req: express.Request, res: express.Response) => {
  console.log('[LIKES HTTP] Received like action request', {
    body: req.body,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  })
  
  const parsed = LikeActionDto.safeParse(req.body)
  if (!parsed.success) {
    console.log('[LIKES HTTP] Invalid like action payload:', {
      issues: parsed.error.issues,
      receivedBody: req.body,
      timestamp: new Date().toISOString()
    })
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues })
  }

  const { initData, targetUserId, action } = parsed.data
  console.log(`[LIKES HTTP] Processing like action:`, {
    targetUserId,
    action,
    timestamp: new Date().toISOString()
  })

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) {
    console.log('[LIKES HTTP] Unauthorized like action request', {
      verificationOk: verification.ok,
      hasUser: !!verification.user,
      timestamp: new Date().toISOString()
    })
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const startTime = Date.now()
    const userId = BigInt(verification.user.id)
    const targetId = BigInt(targetUserId)

    console.log(`[LIKES HTTP] Processing like action for user ${userId}`, {
      userId: userId.toString(),
      targetUserId: targetId.toString(),
      action,
      timestamp: new Date().toISOString()
    })

    if (userId === targetId) {
      console.log(`[LIKES HTTP] User ${userId} tried to like themselves`)
      return res.status(400).json({ message: 'Cannot like yourself' })
    }

    let result: { matched: boolean; chatId?: string } = { matched: false }

    if (action === 'unlike') {
      // Удаляем лайк/дизлайк
      console.log(`[LIKES HTTP] Removing like from ${userId} to ${targetId}`)
      const deleteResult = await prisma.like.deleteMany({
        where: { userId, targetUserId: targetId }
      })
      console.log(`[LIKES HTTP] Deleted ${deleteResult.count} like records`)
    } else {
      // Создаем или обновляем лайк/дизлайк
      const isLike = action === 'like'
      
      console.log(`[LIKES HTTP] Upserting like:`, {
        fromUserId: userId.toString(),
        toUserId: targetId.toString(),
        isLike,
        action
      })
      
      const upsertResult = await prisma.like.upsert({
        where: { userId_targetUserId: { userId, targetUserId: targetId } },
        update: { isLike, createdAt: new Date() },
        create: { userId, targetUserId: targetId, isLike },
      })
      
      console.log(`[LIKES HTTP] Like upserted successfully:`, {
        likeId: `${upsertResult.userId}_${upsertResult.targetUserId}`,
        isLike: upsertResult.isLike,
        createdAt: upsertResult.createdAt.toISOString()
      })

      // Проверяем на взаимный лайк (матч)
      if (isLike) {
        console.log(`[LIKES HTTP] Checking for reciprocal like from ${targetId} to ${userId}`)
        const reciprocal = await prisma.like.findUnique({ 
          where: { userId_targetUserId: { userId: targetId, targetUserId: userId } } 
        })
        
        console.log(`[LIKES HTTP] Reciprocal like check result:`, {
          found: !!reciprocal,
          isLike: reciprocal?.isLike,
          matchedAt: reciprocal?.matchedAt?.toISOString()
        })
        
        if (reciprocal && reciprocal.isLike) {
          console.log(`[LIKES HTTP] MATCH FOUND! Updating both likes with matchedAt timestamp`)
          // Отмечаем матч
          await prisma.like.update({ 
            where: { userId_targetUserId: { userId, targetUserId: targetId } }, 
            data: { matchedAt: new Date() } 
          })
          await prisma.like.update({ 
            where: { userId_targetUserId: { userId: targetId, targetUserId: userId } }, 
            data: { matchedAt: new Date() } 
          })

          // Создаем чат если его нет
          let chatId: string | null = null
          console.log(`[LIKES HTTP] Checking for existing chat between ${userId} and ${targetId}`)
          const existing = await prisma.chatMember.findFirst({ 
            where: { userId, chat: { members: { some: { userId: targetId } } } } 
          })
          if (existing) {
            chatId = existing.chatId
            console.log(`[LIKES HTTP] Found existing chat: ${chatId}`)
          }
          if (!chatId) {
            console.log(`[LIKES HTTP] Creating new chat for match between ${userId} and ${targetId}`)
            const chat = await prisma.chat.create({ data: { isDialog: true } })
            await prisma.chatMember.createMany({ 
              data: [ 
                { chatId: chat.id, userId }, 
                { chatId: chat.id, userId: targetId } 
              ] 
            })
            chatId = chat.id
            console.log(`[LIKES HTTP] Created new chat: ${chatId}`)
          }
          
          result = { matched: true, chatId: chatId ?? undefined }
          console.log(`[LIKES HTTP] Match result:`, {
            matched: result.matched,
            chatId: result.chatId,
            fromUserId: userId.toString(),
            toUserId: targetId.toString()
          })
        }
      }
    }

    const response = {
      ok: true,
      action,
      matched: result.matched,
      chatId: result.chatId,
    }
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`[LIKES HTTP] Sending like action response:`, {
      userId: userId.toString(),
      targetUserId: targetId.toString(),
      action,
      matched: result.matched,
      chatId: result.chatId,
      duration: `${duration}ms`,
      performance: {
        totalTime: duration,
        actionType: action,
        wasMatch: result.matched,
        chatCreated: !!result.chatId
      },
      timestamp: new Date().toISOString()
    })

    return res.json(response)
  } catch (e) {
    console.error('[LIKES HTTP] Error processing like action:', e)
    console.error('[LIKES HTTP] Error details:', {
      targetUserId,
      action,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      timestamp: new Date().toISOString()
    })
    return res.status(500).json({ message: 'Internal error' })
  }
})

// Получение статистики лайков
router.get('/likes/stats', async (req: express.Request, res: express.Response) => {
  console.log('[LIKES HTTP] Received stats request', {
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  })
  
  const initData = req.query.initData as string
  if (!initData) {
    console.log('[LIKES HTTP] Missing initData for stats request')
    return res.status(400).json({ message: 'initData is required' })
  }

  const token = ENV.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ message: 'Server misconfigured: TELEGRAM_BOT_TOKEN is not set' })

  const verification = verifyTelegramInitData(initData, token, ENV.TELEGRAM_AUTH_TTL_SECONDS)
  if (!verification.ok || !verification.user) {
    console.log('[LIKES HTTP] Unauthorized stats request', {
      verificationOk: verification.ok,
      hasUser: !!verification.user,
      timestamp: new Date().toISOString()
    })
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const startTime = Date.now()
    const userId = BigInt(verification.user.id)
    console.log(`[LIKES HTTP] Getting stats for user ${userId}`, {
      userId: userId.toString(),
      timestamp: new Date().toISOString()
    })

    const [receivedLikes, sentLikes, matches] = await Promise.all([
      // Количество полученных лайков
      prisma.like.count({
        where: { targetUserId: userId, isLike: true }
      }),
      // Количество отправленных лайков
      prisma.like.count({
        where: { userId, isLike: true }
      }),
      // Количество матчей
      prisma.like.count({
        where: { userId, matchedAt: { not: null } }
      })
    ])

    console.log(`[LIKES HTTP] Stats retrieved:`, {
      userId: userId.toString(),
      receivedLikes,
      sentLikes,
      matches,
      timestamp: new Date().toISOString()
    })

    const response = {
      ok: true,
      stats: {
        receivedLikes,
        sentLikes,
        matches,
      }
    }
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`[LIKES HTTP] Sending stats response to user ${userId}`, {
      duration: `${duration}ms`,
      performance: {
        totalTime: duration,
        statsCount: 3,
        responseSize: JSON.stringify(response).length
      }
    })
    return res.json(response)
  } catch (e) {
    console.error('[LIKES HTTP] Error fetching likes stats:', e)
    console.error('[LIKES HTTP] Error details:', {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      timestamp: new Date().toISOString()
    })
    return res.status(500).json({ message: 'Internal error' })
  }
})

export const likesRouter = router
