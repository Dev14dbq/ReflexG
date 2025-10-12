import express from 'express'
import { z } from 'zod'
import { requireModerator } from '@/lib/middleware/roleCheck'
import { prisma } from '@/lib/prisma'
import { safeParseDate, isValidDate } from '@/lib/dateUtils'
import { Bot } from 'grammy'
import { ENV } from '@/config/env'
import { deleteCdnFileByFilename } from '@/routes/cdn'

const router = express.Router()

// Функция для отправки уведомлений пользователям через бота
async function sendModerationNotification(userId: bigint, status: string, reason?: string, isBanned = false) {
  try {
    const bot = new Bot(ENV.TELEGRAM_BOT_TOKEN || '')
    
    let message = ''
    switch (status) {
      case 'APPROVED':
        message = '✅ Ваша анкета одобрена! Теперь вы можете пользоваться сервисом.'
        break
      case 'REJECTED':
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

// Схемы валидации
const UpdateModerationStatusSchema = z.object({
  itemId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED', 'DISCREPANT']),
  reason: z.string().optional(),
  banUser: z.boolean().optional()
})

const GetModerationItemsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'DISCREPANT']).optional(),
  type: z.enum(['INITIAL', 'PROFILE_DESCRIPTION', 'PROFILE_EDIT', 'PHOTOS']).optional(),
  page: z.string().transform(val => parseInt(val)).optional(),
  limit: z.string().transform(val => parseInt(val)).optional()
})

// Получить список элементов для модерации
router.get('/items', requireModerator, async (req: express.Request, res: express.Response) => {
  try {
    const parse = GetModerationItemsSchema.safeParse(req.query)
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Invalid query parameters', 
        issues: parse.error.issues 
      })
    }

    const { status, type, page = 1, limit = 50 } = parse.data
    const offset = (page - 1) * limit

    // Автоматически удаляем записи старше 3 месяцев
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    
    await prisma.moderationItem.deleteMany({
      where: {
        resolvedAt: {
          lt: threeMonthsAgo
        }
      }
    })

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type

    const items = await prisma.moderationItem.findMany({
      where,
      skip: offset,
      take: limit,
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Обогащаем данные профиля для каждого элемента модерации
    const enrichedItems = await Promise.all(items.map(async (item) => {
      let enrichedPayload: any = {}
      
      // Проверяем что payload это объект
      if (item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)) {
        enrichedPayload = Object.assign({}, item.payload)
      }
      
      // Получаем текущий профиль пользователя
      const currentProfile = await prisma.profile.findUnique({
        where: { userId: item.userId },
        select: {
          city: true,
          displayName: true,
          birthDate: true,
          gender: true,
          sex: true,
          description: true,
          heightCm: true,
          weightKg: true,
          wandSizeCm: true,
          createdAt: true,
          updatedAt: true
        }
      })

      // Получаем все фотографии пользователя
      const photos = await prisma.photo.findMany({
        where: { userId: item.userId },
        select: { id: true, url: true, position: true, status: true },
        orderBy: { position: 'asc' }
      })

      // Обогащаем payload в зависимости от типа модерации
      if (item.type === 'INITIAL') {
        // Для первичной модерации показываем все данные профиля ВМЕСТЕ с фотографиями
        enrichedPayload = {
          ...enrichedPayload,
          profile: currentProfile,
          photos: photos.map(p => ({ ...p, id: p.id.toString() })),
          isNewProfile: true,
          // Показываем статус модерации фотографий
          photosModerationStatus: photos.every(p => p.status === 'APPROVED') ? 'APPROVED' : 
                                 photos.some(p => p.status === 'REJECTED') ? 'REJECTED' : 'PENDING'
        }
      } else if (item.type === 'PROFILE_DESCRIPTION' || item.type === 'PROFILE_EDIT') {
        // Для изменений профиля показываем что изменилось
        const hasProp = (key: string) => Object.prototype.hasOwnProperty.call(enrichedPayload, key)
        const changeFor = <T,>(key: string, oldVal: T | null | undefined, newVal: T | null | undefined) => {
          if (!hasProp(key)) return { changed: false }
          if (newVal !== oldVal) {
            return { old: oldVal ?? null, new: newVal ?? null, changed: true }
          }
          return { changed: false }
        }

        enrichedPayload = {
          ...enrichedPayload,
          profile: currentProfile,
          photos: photos.map(p => ({ ...p, id: p.id.toString() })),
          changes: {
            displayName: changeFor<string>('displayName', currentProfile?.displayName ?? null, (enrichedPayload as any).displayName ?? null),
            city: changeFor<string>('city', currentProfile?.city ?? null, (enrichedPayload as any).city ?? null),
            description: changeFor<string>('description', currentProfile?.description ?? null, (enrichedPayload as any).description ?? null),
            heightCm: changeFor<number>('heightCm', currentProfile?.heightCm ?? null, (enrichedPayload as any).heightCm ?? null),
            weightKg: changeFor<number>('weightKg', currentProfile?.weightKg ?? null, (enrichedPayload as any).weightKg ?? null),
            wandSizeCm: changeFor<number>('wandSizeCm', currentProfile?.wandSizeCm ?? null, (enrichedPayload as any).wandSizeCm ?? null),
            gender: changeFor<string>('gender', currentProfile?.gender ?? null, (enrichedPayload as any).gender ?? null)
          }
        }
      } else if (item.type === 'PHOTOS') {
        // Для фотографий показываем что изменилось
        enrichedPayload = {
          ...enrichedPayload,
          profile: currentProfile,
          photos: photos.map(p => ({ ...p, id: p.id.toString() })),
          photoChanges: {
            added: enrichedPayload.addedPhotos || [],
            removed: enrichedPayload.removedPhotos || [],
            reordered: enrichedPayload.reorderedPhotos || false
          }
        }
      }

      return {
        ...item,
        userId: item.userId.toString(),
        user: {
          ...item.user,
          telegramId: item.user.telegramId.toString()
        },
        payload: enrichedPayload
      }
    }))

    const total = await prisma.moderationItem.count({ where })

    res.json({
      ok: true,
      items: enrichedItems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error getting moderation items:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Обновить статус модерации
router.post('/item/status', requireModerator, async (req: express.Request, res: express.Response) => {
  try {
    const parse = UpdateModerationStatusSchema.safeParse(req.body)
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Invalid payload', 
        issues: parse.error.issues 
      })
    }

    const { itemId, status, reason, banUser } = parse.data
    
    // Получаем элемент модерации
    const item = await prisma.moderationItem.findUnique({
      where: { id: itemId },
      include: { user: true }
    })

    if (!item) {
      return res.status(404).json({ message: 'Moderation item not found' })
    }

    // Обновляем статус
    await prisma.moderationItem.update({
      where: { id: itemId },
      data: {
        status,
        reason,
        resolvedAt: new Date()
      }
    })


    // Если это профиль и статус APPROVED, обновляем статус профиля И фотографий
    if (item.type === 'INITIAL' && status === 'APPROVED') {
      await prisma.profile.update({
        where: { userId: item.userId },
        data: { initialModerationStatus: 'APPROVED' }
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
      
      console.log(`[MODERATION] Approved profile and all photos for user ${item.userId}`)
    }

    if (item.type === 'PROFILE_DESCRIPTION' && status === 'APPROVED') {
      await prisma.profile.update({
        where: { userId: item.userId },
        data: { descriptionModerationStatus: 'APPROVED' }
      })
    }

    // Если отмечаем как DISCREPANT, устанавливаем соответствующий статус в профиле
    if (status === 'DISCREPANT') {
      if (item.type === 'INITIAL') {
        await prisma.profile.update({
          where: { userId: item.userId },
          data: { 
            initialModerationStatus: 'DISCREPANT',
            initialModerationNote: reason || null
          }
        })
        console.log(`[MODERATION] Marked profile as DISCREPANT for user ${item.userId}`)
      } else if (item.type === 'PROFILE_DESCRIPTION') {
        await prisma.profile.update({
          where: { userId: item.userId },
          data: { 
            descriptionModerationStatus: 'DISCREPANT',
            descriptionModerationNote: reason || null
          }
        })
        console.log(`[MODERATION] Marked description as DISCREPANT for user ${item.userId}`)
      }
    }
    
    // Если отклоняем и нужно забанить пользователя
    if (status === 'REJECTED' && banUser) {
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
    if (status === 'REJECTED' && !banUser) {
      if (item.type === 'INITIAL') {
        // Удаляем профиль и все фотографии (в БД), а файлы удаляем после транзакции
        const photosToDelete = await prisma.$transaction(async (tx) => {
          const photos = await tx.photo.findMany({
            where: { userId: item.userId },
            select: { url: true }
          })
          await tx.photo.deleteMany({ where: { userId: item.userId } })
          await tx.profile.deleteMany({ where: { userId: item.userId } })
          return photos
        })

        // Пытаемся удалить файлы из CDN (вне транзакции)
        for (const p of photosToDelete) {
          try {
            const url = p.url || ''
            const filename = url.split('/').pop() || ''
            deleteCdnFileByFilename(filename)
          } catch (e) {
            console.warn('Failed to delete CDN file for rejected profile:', e)
          }
        }

        console.log(`[MODERATION] Rejected without ban: deleted profile and photos for user ${item.userId}`)
      }
      // Очищаем связанные данные в зависимости от типа
      if (item.type === 'PHOTOS') {
        const payload = item.payload as any
        if (payload.photoId) {
          // Сначала получаем URL для удаления файла, затем удаляем запись
          const photo = await prisma.photo.findUnique({
            where: { id: payload.photoId },
            select: { url: true }
          })
          await prisma.photo.delete({ where: { id: payload.photoId } })
          // Удаляем файл из CDN (best-effort)
          try {
            const url = photo?.url || ''
            const filename = url.split('/').pop() || ''
            deleteCdnFileByFilename(filename)
          } catch (e) {
            console.warn('Failed to delete CDN file for rejected photo:', e)
          }
        }
      }
    }

    // После одобрения применяем данные из payload к профилю/фото
    if (status === 'APPROVED') {
      try {
        // Общая функция для применения данных профиля
        const applyProfileData = async (payload: any) => {
          const updateData: any = {}
          
          if (payload?.city !== undefined) updateData.city = payload.city
          if (payload?.displayName !== undefined) updateData.displayName = payload.displayName
          if (payload?.birthDate !== undefined) {
            const parsedDate = safeParseDate(payload.birthDate)
            if (isValidDate(parsedDate)) {
              updateData.birthDate = parsedDate
            } else {
              console.warn(`Invalid birthDate format for user ${item.userId}: ${payload.birthDate}`)
            }
          }
          if (payload?.gender !== undefined) updateData.gender = payload.gender
          if (payload?.sex !== undefined) updateData.sex = payload.sex
          
          const description = payload?.description ?? payload?.bio
          if (description !== undefined) updateData.description = description
          
          if (payload?.heightCm !== undefined) updateData.heightCm = payload.heightCm
          if (payload?.weightKg !== undefined) updateData.weightKg = payload.weightKg
          if (payload?.wandSizeCm !== undefined) updateData.wandSizeCm = payload.wandSizeCm

          if (Object.keys(updateData).length > 0) {
            console.log(`Updating profile for user ${item.userId} with data:`, updateData)
            await prisma.profile.update({ 
              where: { userId: item.userId }, 
              data: updateData 
            })
            console.log(`Profile updated successfully for user ${item.userId}`)
          } else {
            console.log(`No data to update for user ${item.userId}`)
          }
        }

        // Применяем данные в зависимости от типа модерации
        if (item.type === 'INITIAL' || item.type === 'PROFILE_DESCRIPTION' || item.type === 'PROFILE_EDIT') {
          console.log(`Applying profile data for user ${item.userId}, type: ${item.type}`, item.payload)
          await applyProfileData(item.payload)
          console.log(`Profile data applied successfully for user ${item.userId}`)
        }

        // Для фотографий обновляем статус фото
        if (item.type === 'PHOTOS') {
          const payload = item.payload as any
          if (payload.photoId) {
            await prisma.photo.update({
              where: { id: payload.photoId },
              data: { status: 'APPROVED', note: null }
            })
          }
        }
      } catch (e) {
        console.error('Error applying approved payload via REST moderation:', e)
      }
    }

    // Отправляем уведомление пользователю
    await sendModerationNotification(item.userId, status, reason, banUser)

    // Преобразуем все BigInt поля в строки для сериализации
    const serializedItem = {
      ...item,
      id: item.id.toString(),
      userId: item.userId.toString(),
      status,
      reason,
      resolvedAt: new Date(),
      user: {
        ...item.user,
        telegramId: item.user.telegramId.toString()
      }
    }

    res.json({
      ok: true,
      message: `Item ${status.toLowerCase()}`,
      item: serializedItem
    })
  } catch (error) {
    console.error('Error updating moderation status:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Проверить фотографии (для отладки)
router.get('/debug/photos', requireModerator, async (req: express.Request, res: express.Response) => {
  try {
    const photos = await prisma.photo.findMany({
      where: { status: 'APPROVED' },
      select: {
        id: true,
        userId: true,
        url: true,
        status: true,
        position: true
      },
      take: 20
    })
    
    res.json({
      ok: true,
      photos: photos.map(p => ({
        ...p,
        userId: p.userId.toString()
      }))
    })
  } catch (error) {
    console.error('Error getting photos debug info:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Проверить все профили (для отладки)
router.get('/debug/profiles', requireModerator, async (req: express.Request, res: express.Response) => {
  try {
    const profiles = await prisma.profile.findMany({
      where: {
        initialModerationStatus: 'APPROVED',
        OR: [
          { description: null },
          { description: '' },
          { descriptionModerationStatus: 'APPROVED' }
        ]
      },
      select: {
        userId: true,
        displayName: true,
        city: true,
        description: true,
        heightCm: true,
        weightKg: true,
        wandSizeCm: true,
        gender: true,
        initialModerationStatus: true,
        descriptionModerationStatus: true
      },
      take: 10
    })
    
    res.json({
      ok: true,
      profiles: profiles.map(p => ({
        ...p,
        userId: p.userId.toString()
      }))
    })
  } catch (error) {
    console.error('Error getting profiles debug info:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Проверить данные профиля (для отладки)
router.get('/debug/profile/:userId', requireModerator, async (req: express.Request, res: express.Response) => {
  try {
    const userId = BigInt(req.params.userId)
    
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        userId: true,
        displayName: true,
        city: true,
        description: true,
        heightCm: true,
        weightKg: true,
        wandSizeCm: true,
        gender: true,
        initialModerationStatus: true,
        descriptionModerationStatus: true
      }
    })
    
    const moderationItems = await prisma.moderationItem.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        status: true,
        payload: true,
        resolvedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
    
    res.json({
      ok: true,
      profile,
      moderationItems
    })
  } catch (error) {
    console.error('Error getting profile debug info:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Получить статистику модерации
router.get('/stats', requireModerator, async (req: express.Request, res: express.Response) => {
  try {
    const [pending, approved, rejected, discrepant, total] = await Promise.all([
      prisma.moderationItem.count({ where: { status: 'PENDING' } }),
      prisma.moderationItem.count({ where: { status: 'APPROVED' } }),
      prisma.moderationItem.count({ where: { status: 'REJECTED' } }),
      prisma.moderationItem.count({ where: { status: 'DISCREPANT' } }),
      prisma.moderationItem.count()
    ])

    const typeStats = await prisma.moderationItem.groupBy({
      by: ['type', 'status'],
      _count: true
    })

    res.json({
      ok: true,
      stats: {
        pending,
        approved,
        rejected,
        discrepant,
        total
      },
      byType: typeStats.reduce((acc, item) => {
        if (!acc[item.type]) acc[item.type] = {}
        acc[item.type][item.status] = item._count
        return acc
      }, {} as Record<string, Record<string, number>>)
    })
  } catch (error) {
    console.error('Error getting moderation stats:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export const moderationRouter = router

