import express from 'express'
import { z } from 'zod'
import { requireAdmin } from '@/lib/middleware/roleCheck'
import { UserRole, updateUserRole, getUserRole } from '@/services/auth'
import { prisma } from '@/lib/prisma'

const router = express.Router()

// Схемы валидации
const UpdateRoleSchema = z.object({
  targetTelegramId: z.string().transform(val => BigInt(val)),
  newRole: z.nativeEnum(UserRole)
})

const GetUserInfoSchema = z.object({
  telegramId: z.string().transform(val => BigInt(val))
})

// Получить информацию о пользователе (включая роль)
router.get('/user/:telegramId', requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const parse = GetUserInfoSchema.safeParse({ telegramId: req.params.telegramId })
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Invalid telegramId', 
        issues: parse.error.issues 
      })
    }

    const { telegramId } = parse.data
    
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        telegramId: true,
        // username excluded for privacy
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            city: true,
            initialModerationStatus: true
          }
        }
      }
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({
      ok: true,
      user: {
        ...user,
        telegramId: user.telegramId.toString()
      }
    })
  } catch (error) {
    console.error('Error getting user info:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Обновить роль пользователя
router.post('/user/role', requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const parse = UpdateRoleSchema.safeParse(req.body)
    if (!parse.success) {
      return res.status(400).json({ 
        message: 'Invalid payload', 
        issues: parse.error.issues 
      })
    }

    const { targetTelegramId, newRole } = parse.data
    
    // Проверяем, что пользователь существует
    const targetUser = await prisma.user.findUnique({
      where: { telegramId: targetTelegramId },
      select: { telegramId: true, role: true }
    })

    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' })
    }

    // Обновляем роль
    await updateUserRole(targetTelegramId, newRole)

    res.json({
      ok: true,
      message: `User role updated to ${newRole}`,
      user: {
        telegramId: targetTelegramId.toString(),
        role: newRole
      }
    })
  } catch (error) {
    console.error('Error updating user role:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Получить список всех пользователей с ролями (для админов)
router.get('/users', requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const offset = (page - 1) * limit

    const users = await prisma.user.findMany({
      skip: offset,
      take: limit,
      select: {
        telegramId: true,
        // username excluded for privacy
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            city: true,
            initialModerationStatus: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const total = await prisma.user.count()

    res.json({
      ok: true,
      users: users.map(user => ({
        ...user,
        telegramId: user.telegramId.toString()
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error getting users list:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export const adminRouter = router
