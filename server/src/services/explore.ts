import { prisma } from '@/lib/prisma'

export type PublicProfile = {
  userId: bigint
  displayName: string | null
  age: number | null
  city: string | null
  photos: string[]
  bio: string | null
}

function calcAge(birthDate: Date | null): number | null {
  if (!birthDate) return null
  const now = new Date()
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear()
  const m = now.getUTCMonth() - birthDate.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--
  return age
}

export async function fetchNextProfileForUser(userId: bigint): Promise<PublicProfile | null> {
  // get current user's gender
  const me = await prisma.profile.findUnique({ where: { userId }, select: { gender: true } })
  const myGender = me?.gender || null

  // find candidate user
  let genderFilter: any = {}
  if (myGender) {
    const targets = await compatibleTargets(myGender)
    // If mapping is empty, do not apply filter to avoid empty result set
    if (Array.isArray(targets) && targets.length > 0) {
      genderFilter = { profile: { is: { gender: { in: targets } } } }
    }
  }

  const candidate = await prisma.user.findFirst({
    where: {
      telegramId: { not: userId },
      // not previously liked/disliked by me
      likesReceived: { none: { userId, } },
      // has approved base profile
      profile: { is: { initialModerationStatus: 'APPROVED' } },
      // gender compatibility (if mapping exists)
      ...genderFilter,
    },
    orderBy: { createdAt: 'desc' },
    select: { telegramId: true, profile: { select: { displayName: true, birthDate: true, city: true, description: true } } },
  })
  if (!candidate) return null

  const photos = await prisma.photo.findMany({
    where: { userId: candidate.telegramId, status: 'APPROVED' },
    orderBy: { position: 'asc' },
    take: 3,
    select: { url: true }
  })

  return {
    userId: candidate.telegramId,
    displayName: candidate.profile?.displayName ?? null,
    age: calcAge(candidate.profile?.birthDate ?? null),
    city: candidate.profile?.city ?? null,
    photos: photos.map(p => p.url),
    bio: candidate.profile?.description ?? null,
  }
}

async function compatibleTargets(from: any): Promise<any[]> {
  const list = await prisma.genderCompatibility.findMany({ where: { from }, select: { to: true } })
  return list.map(x => x.to)
}

export async function handleLike(userId: bigint, targetUserId: bigint, isLike: boolean): Promise<{ matched: boolean; chatId?: string }> {
  const like = await prisma.like.upsert({
    where: { userId_targetUserId: { userId, targetUserId } },
    update: { isLike, createdAt: new Date() },
    create: { userId, targetUserId, isLike },
  })

  if (!isLike) return { matched: false }

  const reciprocal = await prisma.like.findUnique({ where: { userId_targetUserId: { userId: targetUserId, targetUserId: userId } } })
  if (!reciprocal || !reciprocal.isLike) return { matched: false }

  // mark match
  await prisma.like.update({ where: { userId_targetUserId: { userId, targetUserId } }, data: { matchedAt: new Date() } })
  await prisma.like.update({ where: { userId_targetUserId: { userId: targetUserId, targetUserId: userId } }, data: { matchedAt: new Date() } })

  // ensure chat exists
  let chatId: string | null = null
  const existing = await prisma.chatMember.findFirst({ where: { userId, chat: { members: { some: { userId: targetUserId } } } } })
  if (existing) chatId = existing.chatId
  if (!chatId) {
    const chat = await prisma.chat.create({ data: { isDialog: true } })
    await prisma.chatMember.createMany({ data: [ { chatId: chat.id, userId }, { chatId: chat.id, userId: targetUserId } ] })
    chatId = chat.id
  }
  return { matched: true, chatId: chatId ?? undefined }
}


