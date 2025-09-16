const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function checkModeration() {
  try {
    console.log('=== Проверка последних элементов модерации ===');
    const items = await prisma.moderationItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            telegramId: true,
            username: true,
            firstName: true
          }
        }
      }
    });

    items.forEach(item => {
      console.log(`\nID: ${item.id}`);
      console.log(`Пользователь: ${item.user.username || item.user.firstName || item.user.telegramId}`);
      console.log(`Тип: ${item.type}`);
      console.log(`Статус: ${item.status}`);
      console.log(`Создан: ${item.createdAt}`);
      console.log(`Разрешен: ${item.resolvedAt || 'НЕТ'}`);
      console.log(`Payload:`, JSON.stringify(item.payload, null, 2));
    });

    console.log('\n=== Проверка профилей пользователей ===');
    const profiles = await prisma.profile.findMany({
      take: 5,
      include: {
        user: {
          select: {
            telegramId: true,
            username: true,
            firstName: true
          }
        }
      }
    });

    profiles.forEach(profile => {
      console.log(`\nПользователь: ${profile.user.username || profile.user.firstName || profile.user.telegramId}`);
      console.log(`Описание: ${profile.description || 'НЕТ'}`);
      console.log(`Статус модерации: ${profile.initialModerationStatus}`);
      console.log(`Статус описания: ${profile.descriptionModerationStatus}`);
    });

  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkModeration();
