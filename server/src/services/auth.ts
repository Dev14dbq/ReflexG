import { prisma } from '@/lib/prisma'

export enum UserRole {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN'
}

export interface UserWithRole {
  telegramId: bigint
  role: UserRole
}

export async function getUserRole(telegramId: bigint): Promise<UserRole> {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { role: true }
  })
  
  return (user?.role as UserRole) || UserRole.USER
}

export async function isModerator(telegramId: bigint): Promise<boolean> {
  const role = await getUserRole(telegramId)
  return role === UserRole.MODERATOR || role === UserRole.ADMIN
}

export async function isAdmin(telegramId: bigint): Promise<boolean> {
  const role = await getUserRole(telegramId)
  return role === UserRole.ADMIN
}

export async function hasPermission(telegramId: bigint, requiredRole: UserRole): Promise<boolean> {
  const userRole = await getUserRole(telegramId)
  
  switch (requiredRole) {
    case UserRole.USER:
      return true
    case UserRole.MODERATOR:
      return userRole === UserRole.MODERATOR || userRole === UserRole.ADMIN
    case UserRole.ADMIN:
      return userRole === UserRole.ADMIN
    default:
      return false
  }
}

export async function updateUserRole(telegramId: bigint, newRole: UserRole): Promise<void> {
  await prisma.user.update({
    where: { telegramId },
    data: { role: newRole }
  })
}
