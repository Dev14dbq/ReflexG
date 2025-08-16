import type { JSX } from 'react'
import AppRouter from './app/router'
import ThemeProvider from './app/providers/ThemeProvider'
import { Toaster } from 'sonner'
import TelegramAuthProvider from './app/providers/TelegramAuthProvider'

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <TelegramAuthProvider>
        <AppRouter />
        <Toaster position="top-center" richColors toastOptions={{ className: 'sonner-toast' }} />
      </TelegramAuthProvider>
    </ThemeProvider>
  )
}
