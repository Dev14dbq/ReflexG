import { prisma } from '@/lib/prisma'

let isDbHealthy = false
let lastDbCheck = 0
let dbCheckInterval: NodeJS.Timeout | null = null

// Простой запрос для проверки соединения с БД
async function pingDatabase(): Promise<boolean> {
  try {
    // Простой SELECT запрос для проверки соединения
    await prisma.$queryRaw`SELECT 1 as ping`
    return true
  } catch (error) {
    console.error('[HEALTH CHECK] Database ping failed:', error)
    return false
  }
}

// Запуск периодической проверки БД
export function startHealthCheck(): void {
  if (dbCheckInterval) {
    return
  }

  console.log('[HEALTH CHECK] Starting database health check every 5 seconds')
  
  // Первая проверка сразу
  pingDatabase().then(result => {
    isDbHealthy = result
    lastDbCheck = Date.now()
  })

  // Периодические проверки каждые 5 секунд
  dbCheckInterval = setInterval(async () => {
    const result = await pingDatabase()
    const wasHealthy = isDbHealthy
    isDbHealthy = result
    lastDbCheck = Date.now()
    
    if (wasHealthy !== result) {
    }
  }, 5000)
}

// Остановка проверки
export function stopHealthCheck(): void {
  if (dbCheckInterval) {
    clearInterval(dbCheckInterval)
    dbCheckInterval = null
    console.log('[HEALTH CHECK] Stopped')
  }
}

// Получение статуса БД
export function getDatabaseStatus(): { healthy: boolean; lastCheck: number } {
  return {
    healthy: isDbHealthy,
    lastCheck: lastDbCheck
  }
}

// Проверка здоровья БД для API эндпоинта
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; responseTime: number }> {
  const startTime = Date.now()
  const healthy = await pingDatabase()
  const responseTime = Date.now() - startTime
  
  return { healthy, responseTime }
}
