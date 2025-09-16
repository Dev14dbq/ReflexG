import { Request, Response, NextFunction } from 'express'
import { prisma } from '@/lib/prisma'

export async function checkUserBan(req: Request, res: Response, next: NextFunction) {
  try {
    const telegramId = req.headers['x-telegram-id'] as string
    if (!telegramId) {
      return next()
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { isBanned: true, banReason: true, bannedAt: true }
    })

    if (user?.isBanned) {
      return res.status(403).json({
        error: 'USER_BANNED',
        message: 'Ваш аккаунт заблокирован',
        reason: user.banReason || 'Нарушение правил',
        bannedAt: user.bannedAt
      })
    }

    next()
  } catch (error) {
    console.error('Error checking user ban:', error)
    next()
  }
}
