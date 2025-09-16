const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function debugModeration() {
  try {
    console.log('🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА МОДЕРАЦИИ\n');
    
    // 1. Проверяем последние одобренные элементы
    console.log('1️⃣ ПОСЛЕДНИЕ ОДОБРЕННЫЕ ЭЛЕМЕНТЫ:');
    const approvedItems = await prisma.moderationItem.findMany({
      where: { status: 'APPROVED' },
      orderBy: { resolvedAt: 'desc' },
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

    approvedItems.forEach(item => {
      console.log(`\n📋 ID: ${item.id}`);
      console.log(`👤 Пользователь: ${item.user.username || item.user.firstName || item.user.telegramId}`);
      console.log(`📝 Тип: ${item.type}`);
      console.log(`✅ Статус: ${item.status}`);
      console.log(`📅 Одобрен: ${item.resolvedAt}`);
      console.log(`📦 Payload:`, JSON.stringify(item.payload, null, 2));
    });

    // 2. Проверяем профили пользователей
    console.log('\n\n2️⃣ ПРОФИЛИ ПОЛЬЗОВАТЕЛЕЙ:');
    const profiles = await prisma.profile.findMany({
      take: 10,
      include: {
        user: {
          select: {
            telegramId: true,
            username: true,
            firstName: true
          }
        },
        lookingFor: true
      }
    });

    profiles.forEach(profile => {
      console.log(`\n👤 Пользователь: ${profile.user.username || profile.user.firstName || profile.user.telegramId}`);
      console.log(`📝 Описание: ${profile.description || 'НЕТ'}`);
      console.log(`📏 Рост: ${profile.heightCm || 'НЕТ'} см`);
      console.log(`⚖️ Вес: ${profile.weightKg || 'НЕТ'} кг`);
      console.log(`🏙️ Город: ${profile.city || 'НЕТ'}`);
      console.log(`📛 Имя: ${profile.displayName || 'НЕТ'}`);
      console.log(`🎯 Ищет: ${profile.lookingFor.map(lf => lf.option).join(', ') || 'НЕТ'}`);
      console.log(`✅ Статус модерации: ${profile.initialModerationStatus}`);
      console.log(`📝 Статус описания: ${profile.descriptionModerationStatus}`);
    });

    // 3. Проверяем конкретного пользователя DDev14
    console.log('\n\n3️⃣ ДЕТАЛЬНАЯ ПРОВЕРКА DDev14:');
    const ddev14User = await prisma.user.findFirst({
      where: { username: 'DDev14' },
      include: {
        profile: {
          include: {
            lookingFor: true
          }
        },
        moderations: {
          where: { status: 'APPROVED' },
          orderBy: { resolvedAt: 'desc' },
          take: 3
        }
      }
    });

    if (ddev14User) {
      console.log(`\n👤 Пользователь: ${ddev14User.username}`);
      console.log(`📝 Описание: ${ddev14User.profile?.description || 'НЕТ'}`);
      console.log(`📏 Рост: ${ddev14User.profile?.heightCm || 'НЕТ'} см`);
      console.log(`⚖️ Вес: ${ddev14User.profile?.weightKg || 'НЕТ'} кг`);
      console.log(`🎯 Ищет: ${ddev14User.profile?.lookingFor.map(lf => lf.option).join(', ') || 'НЕТ'}`);
      
      console.log('\n📋 Последние одобренные модерации:');
      ddev14User.moderations.forEach(mod => {
        console.log(`  - ${mod.type}: ${mod.status} (${mod.resolvedAt})`);
        console.log(`    Payload:`, JSON.stringify(mod.payload, null, 4));
      });
    }

    // 4. Проверяем логи сервера (если есть)
    console.log('\n\n4️⃣ ПРОВЕРЬТЕ ЛОГИ СЕРВЕРА:');
    console.log('В терминале с сервером должны быть сообщения:');
    console.log('  - "Applying approved data for user X, type: PROFILE_DESCRIPTION"');
    console.log('  - "Profile description and related data updated for user X"');
    console.log('  - "Successfully applied approved data for user X, type: PROFILE_DESCRIPTION"');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugModeration();
