import type { JSX } from 'react'
import { Toaster } from 'sonner'

import AppRouter from './app/router'
import ThemeProvider from './app/providers/ThemeProvider'
import TelegramAuthProvider from './app/providers/TelegramAuthProvider'
import EntryGate from './app/providers/EntryGate'

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <TelegramAuthProvider>
        <EntryGate>
          <AppRouter />
        </EntryGate>
        <Toaster position="top-center" richColors toastOptions={{ className: 'sonner-toast' }} />
      </TelegramAuthProvider>
    </ThemeProvider>
  )
}
