import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // чтобы слушал все интерфейсы, не только localhost
    allowedHosts: [
      'dev.spectrmod.ru',
      'new.spectrmod.ru',
      'spectrmod.ru'
    ]
  }
})
