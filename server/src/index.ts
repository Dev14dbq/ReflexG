import 'dotenv/config'
import { startBot } from './bot'
import { createApp } from '@/app'
import { ENV } from '@/config/env'
import { attachWsServer } from '@/ws/index'
import { startHealthCheck, stopHealthCheck } from '@/lib/healthCheck'

const app = createApp()
const server = app.listen(ENV.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API on :${ENV.PORT}`)
})

attachWsServer(server)
startBot()
startHealthCheck()

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  stopHealthCheck()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  stopHealthCheck()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})