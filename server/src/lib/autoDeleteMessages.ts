import { prisma } from '@/lib/prisma'
import { ENV } from '@/config/env'
import { AutoDeletePeriod } from '../../generated/prisma'

function periodToMs(period: AutoDeletePeriod | null | undefined): number | null {
  switch (period) {
    case AutoDeletePeriod.NEVER: return null
    case AutoDeletePeriod.DAY: return 24 * 60 * 60 * 1000
    case AutoDeletePeriod.WEEK: return 7 * 24 * 60 * 60 * 1000
    case AutoDeletePeriod.MONTH: return 30 * 24 * 60 * 60 * 1000
    case AutoDeletePeriod.HALF_YEAR: return 182 * 24 * 60 * 60 * 1000
    default: return 30 * 24 * 60 * 60 * 1000
  }
}

async function softDeleteOldMessagesForUser(userId: bigint, cutoff: Date): Promise<number> {
  // Skip pinned messages; only delete messages from this sender older than cutoff
  const res = await prisma.message.updateMany({
    where: {
      senderId: userId,
      deletedAt: null,
      isPinned: { not: true },
      createdAt: { lt: cutoff }
    },
    data: { deletedAt: new Date() }
  })
  return res.count
}

async function runOnce(): Promise<void> {
  try {
    // Process users in batches to avoid heavy load
    const batchSize = 500
    let cursor: bigint | null = null
    for (;;) {
      const users: Array<{ telegramId: bigint; userSettings: { autoDeleteMessages: AutoDeletePeriod | null } | null }> = await prisma.user.findMany({
        where: {},
        take: batchSize,
        ...(cursor ? { cursor: { telegramId: cursor }, skip: 1 } : {}),
        orderBy: { telegramId: 'asc' },
        select: { telegramId: true, userSettings: { select: { autoDeleteMessages: true } } }
      })
      if (users.length === 0) break
      for (const u of users) {
        const period = u.userSettings?.autoDeleteMessages ?? AutoDeletePeriod.MONTH
        const ms = periodToMs(period)
        if (ms === null) continue // NEVER
        const cutoff = new Date(Date.now() - ms)
        try {
          await softDeleteOldMessagesForUser(u.telegramId, cutoff)
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[AUTO_DELETE] Failed for user', String(u.telegramId), e)
        }
      }
      cursor = users[users.length - 1]?.telegramId ?? null
      if (!cursor) break
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[AUTO_DELETE] runOnce error', e)
  }
}

export function startAutoDeleteScheduler(): void {
  if (!ENV.AUTO_DELETE_ENABLED) return
  const intervalMs = Math.max(1, ENV.AUTO_DELETE_INTERVAL_MIN) * 60 * 1000
  // initial delay to avoid cold start spike
  setTimeout(() => { void runOnce() }, 20_000)
  setInterval(() => { void runOnce() }, intervalMs)
}


