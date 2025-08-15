import type { JSX } from 'react'
import AppRouter from './app/router'
import ThemeProvider from './app/providers/ThemeProvider'

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  )
}
