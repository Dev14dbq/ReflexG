import express from 'express'
import cors from 'cors'
import { authRouter } from '@/routes/auth'
import { ordersRouter } from '@/routes/orders'
import { profileRouter } from '@/routes/profile'
import { cdnRouter } from '@/routes/cdn'
import { placesRouter } from '@/routes/places'

export function createApp(): express.Express {
  const app = express()
  app.use(cors())
  app.use(express.json())

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
  app.use('/api', authRouter)
  app.use('/api', ordersRouter)
  app.use('/api', profileRouter)
  app.use('/api', cdnRouter)
  app.use('/api', placesRouter)

  // error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err)
    res.status(500).json({ message: 'Internal error' })
  })

  return app
}


