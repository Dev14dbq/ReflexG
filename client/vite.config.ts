import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // ✅ вместо require('tailwindcss')()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0', // чтобы слушал все интерфейсы, не только localhost
    allowedHosts: [
      'dev.spectrmod.ru',
      'new.spectrmod.ru',
      'spectrmod.ru'
    ]
  }
})
