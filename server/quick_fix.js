const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function quickFix() {
  console.log('🔧 Быстрое исправление проблем с анкетами...\n');
  
  try {
    // 1. Проверяем текущее состояние
    console.log('📊 Текущее состояние:');
    
    const totalUsers = await prisma.user.count();
    const totalProfiles = await prisma.profile.count();
    const totalPhotos = await prisma.photo.count();
    
    console.log(`👥 Пользователей: ${totalUsers}`);
    console.log(`📋 Профилей: ${totalProfiles}`);
    console.log(`📸 Фотографий: ${totalPhotos}`);
    
    // 2. Проверяем статусы
    const profileStats = await prisma.profile.groupBy({
      by: ['initialModerationStatus'],
      _count: { initialModerationStatus: true }
    });
    
    const photoStats = await prisma.photo.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    console.log('\n📋 Статусы профилей:');
    profileStats.forEach(stat => {
      console.log(`  ${stat.initialModerationStatus}: ${stat._count.initialModerationStatus}`);
    });
    
    console.log('\n📸 Статусы фотографий:');
    photoStats.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count.status}`);
    });
    
    // 3. ИСПРАВЛЯЕМ ПРОБЛЕМЫ
    console.log('\n🔧 ИСПРАВЛЯЕМ ПРОБЛЕМЫ...\n');
    
    // 3.1. Одобряем все фотографии
    const updatePhotos = await prisma.photo.updateMany({
      where: { status: 'PENDING' },
      data: { status: 'APPROVED' }
    });
    console.log(`✅ Одобрено фотографий: ${updatePhotos.count}`);
    
    // 3.2. Одобряем базовые профили
    const updateProfiles = await prisma.profile.updateMany({
      where: { initialModerationStatus: 'PENDING' },
      data: { initialModerationStatus: 'APPROVED' }
    });
    console.log(`✅ Одобрено профилей: ${updateProfiles.count}`);
    
    // 3.3. Одобряем описания
    const updateDescriptions = await prisma.profile.updateMany({
      where: { 
        descriptionModerationStatus: 'PENDING',
        description: { not: null },
        description: { not: '' }
      },
      data: { descriptionModerationStatus: 'APPROVED' }
    });
    console.log(`✅ Одобрено описаний: ${updateDescriptions.count}`);
    
    // 3.4. Убираем блокировки
    const unbanUsers = await prisma.user.updateMany({
      where: { isBanned: true },
      data: { isBanned: false, banReason: null, bannedAt: null }
    });
    console.log(`✅ Разблокировано пользователей: ${unbanUsers.count}`);
    
    // 4. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
    console.log('\n✅ ПРОВЕРЯЕМ РЕЗУЛЬТАТ...\n');
    
    // 4.1. Проверяем готовые профили
    const readyProfiles = await prisma.profile.findMany({
      where: {
        initialModerationStatus: 'APPROVED',
        OR: [
          { description: null },
          { description: '' },
          { descriptionModerationStatus: 'APPROVED' }
        ]
      },
      include: {
        photos: {
          where: { status: 'APPROVED' }
        }
      }
    });
    
    console.log(`📊 Готовых профилей: ${readyProfiles.length}`);
    
    readyProfiles.forEach(profile => {
      console.log(`  ✅ ${profile.userId} (${profile.displayName}): ${profile.photos.length} фото`);
    });
    
    // 4.2. Симулируем поиск
    console.log('\n🔍 СИМУЛЯЦИЯ ПОИСКА:');
    
    for (const profile of readyProfiles) {
      console.log(`\n  Поиск для ${profile.userId}:`);
      
      const candidates = await prisma.user.findMany({
        where: {
          telegramId: { not: profile.userId },
          isBanned: false,
          profile: {
            initialModerationStatus: 'APPROVED',
            OR: [
              { description: null },
              { description: '' },
              { descriptionModerationStatus: 'APPROVED' }
            ]
          }
        },
        include: {
          photos: {
            where: { status: 'APPROVED' }
          }
        }
      });
      
      console.log(`    Найдено кандидатов: ${candidates.length}`);
      
      candidates.forEach(candidate => {
        const age = candidate.profile?.birthDate ? 
          new Date().getFullYear() - candidate.profile.birthDate.getFullYear() : 0;
        
        if (candidate.photos.length > 0 && age >= 14) {
          console.log(`      ✅ ${candidate.telegramId}: готов к показу`);
        } else {
          console.log(`      ❌ ${candidate.telegramId}: ${candidate.photos.length} фото, возраст ${age}`);
        }
      });
    }
    
    if (readyProfiles.length >= 2) {
      console.log('\n🎉 УСПЕХ! Анкеты должны показываться!');
      console.log('Перезапустите сервер и проверьте приложение.');
    } else {
      console.log('\n⚠️  Недостаточно готовых профилей.');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickFix();
