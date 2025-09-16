import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { UserRole, hasPermission } from '@/services/auth'

// Расширяем Request для добавления telegramId
declare global {
  namespace Express {
    interface Request {
      telegramId?: bigint
    }
  }
}

const TelegramIdSchema = z.object({
  telegramId: z.string().transform(val => BigInt(val))
})

export function requireRole(requiredRole: UserRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Получаем telegramId из заголовка или body
      let telegramId: bigint | undefined
      
      if (req.headers['x-telegram-id']) {
        const result = TelegramIdSchema.safeParse({ telegramId: req.headers['x-telegram-id'] })
        if (result.success) {
          telegramId = result.data.telegramId
        }
      }
      
      if (!telegramId && req.body?.telegramId) {
        const result = TelegramIdSchema.safeParse({ telegramId: req.body.telegramId })
        if (result.success) {
          telegramId = result.data.telegramId
        }
      }
      
      if (!telegramId) {
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Telegram ID is required' 
        })
      }
      
      // Проверяем права доступа
      const hasAccess = await hasPermission(telegramId, requiredRole)
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: `Insufficient permissions. Required role: ${requiredRole}` 
        })
      }
      
      // Добавляем telegramId в request для использования в роутах
      req.telegramId = telegramId
      next()
    } catch (error) {
      console.error('Role check middleware error:', error)
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to verify user permissions' 
      })
    }
  }
}

export const requireModerator = requireRole(UserRole.MODERATOR)
export const requireAdmin = requireRole(UserRole.ADMIN)
export const requireUser = requireRole(UserRole.USER)
