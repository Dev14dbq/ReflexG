const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkProfiles() {
  console.log('Checking profiles...')
  
  // Проверяем профили с одобренной модерацией
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
    take: 5
  })
  
  console.log(`Found ${profiles.length} profiles:`)
  profiles.forEach(profile => {
    console.log(`User ${profile.userId}:`, {
      displayName: profile.displayName,
      city: profile.city,
      description: profile.description,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      wandSizeCm: profile.wandSizeCm,
      gender: profile.gender,
      initialModerationStatus: profile.initialModerationStatus,
      descriptionModerationStatus: profile.descriptionModerationStatus
    })
  })
  
  // Проверяем записи модерации
  const moderationItems = await prisma.moderationItem.findMany({
    where: {
      status: 'APPROVED',
      type: { in: ['INITIAL', 'PROFILE_DESCRIPTION', 'PROFILE_EDIT'] }
    },
    select: {
      id: true,
      userId: true,
      type: true,
      status: true,
      payload: true,
      resolvedAt: true
    },
    take: 5
  })
  
  console.log(`\nFound ${moderationItems.length} approved moderation items:`)
  moderationItems.forEach(item => {
    console.log(`Item ${item.id} (User ${item.userId}, Type: ${item.type}):`, {
      status: item.status,
      resolvedAt: item.resolvedAt,
      payload: item.payload
    })
  })
  
  await prisma.$disconnect()
}

checkProfiles().catch(console.error)
