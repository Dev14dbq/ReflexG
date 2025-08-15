import type { PropsWithChildren, JSX } from 'react'
import { useEffect } from 'react'

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    const prefersDark = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
    const isDark = stored ? stored === 'dark' : prefersDark
    document.documentElement.classList.toggle('dark', isDark)
  }, [])
  return <>{children}</>
}

export default ThemeProvider


