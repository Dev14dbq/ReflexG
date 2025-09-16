import express from 'express'
import cors from 'cors'

import { profileDetailsRouter } from '@/routes/profile.details'
import { profileRouter } from '@/routes/profile'
import { authRouter } from '@/routes/auth'
import { ordersRouter } from '@/routes/orders'
import { cdnRouter } from '@/routes/cdn'
import { placesRouter } from '@/routes/places'
import { messagesRouter } from '@/routes/messages'
import { adminRouter } from '@/routes/admin'
import { moderationRouter } from '@/routes/moderation'
import { likesRouter } from '@/routes/likes'
import { checkUserBan } from '@/lib/middleware/banCheck'
import { settingsChatRouter } from '@/routes/settings'

export function createApp(): express.Express {
  const app = express()
  
  // Настраиваем CORS для разрешения запросов с spectrmod.ru
  app.use(cors({
    origin: [
      'https://dev.spectrmod.ru',
      'https://spectrmod.ru',
      'https://www.spectrmod.ru',
      'https://new.spectrmod.ru',
      'http://localhost:3001',
      'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-id']
  }))
  
  // Обработка preflight запросов OPTIONS
  app.options('*', cors())
  
  app.use(express.json())
  
  // Проверка бана пользователей
  app.use(checkUserBan)

  // ping must stay
  app.get('/ping', (req, res) => {
    res.json({ pong: true, ts: Date.now(), pid: process.pid })
  })

  // mount routers at root and at /api
  app.use('/', authRouter)
  app.use('/', ordersRouter)
  app.use('/', profileRouter)
  app.use('/', cdnRouter)
  app.use('/', placesRouter)
  app.use('/', profileDetailsRouter)
  app.use('/', messagesRouter)
  app.use('/', adminRouter)
  app.use('/', settingsChatRouter)
  app.use('/', likesRouter)
  app.use('/moderation', moderationRouter)
  
  // API роуты
  app.use('/api', authRouter)
  app.use('/api', ordersRouter)
  app.use('/api', profileRouter)
  app.use('/api', cdnRouter)
  app.use('/api', placesRouter)
  app.use('/api', profileDetailsRouter)
  app.use('/api', messagesRouter)
  app.use('/api', adminRouter)
  app.use('/api', settingsChatRouter)
  app.use('/api', likesRouter)
  app.use('/api/moderation', moderationRouter)

  // error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err)
    res.status(500).json({ message: 'Internal error' })
  })

  return app
}


