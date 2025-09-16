import { prisma } from '@/lib/prisma'
import { UserRole } from '@/services/auth'

async function setupAdmin() {
  const telegramId = process.argv[2]
  
  if (!telegramId) {
    console.error('Usage: npm run setup-admin <telegram_id>')
    console.error('Example: npm run setup-admin 123456789')
    process.exit(1)
  }

  try {
    const bigIntId = BigInt(telegramId)
    
    // Проверяем, существует ли пользователь
    const user = await prisma.user.findUnique({
      where: { telegramId: bigIntId },
      select: { telegramId: true, username: true, firstName: true, role: true }
    })

    if (!user) {
      console.error(`User with telegram ID ${telegramId} not found`)
      console.error('Make sure the user has already registered in the system')
      process.exit(1)
    }

    // Обновляем роль на ADMIN
    await prisma.user.update({
      where: { telegramId: bigIntId },
      data: { role: UserRole.ADMIN }
    })

    console.log(`✅ Successfully set user ${user.firstName || user.username || telegramId} as ADMIN`)
    console.log(`User ID: ${telegramId}`)
    console.log(`Role: ${UserRole.ADMIN}`)
    
  } catch (error) {
    console.error('Error setting up admin:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

setupAdmin()
