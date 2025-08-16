import type { PropsWithChildren, JSX } from 'react'
import { useEffect } from 'react'
import { toast } from 'react-toastify'

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    const prefersDark = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
    const isDark = stored ? stored === 'dark' : prefersDark
    document.documentElement.classList.toggle('dark', isDark)
    // Update toast theme at runtime
    try {
      const theme = isDark ? 'dark' : 'light'
      document.documentElement.style.setProperty('--toastify-color-light', 'transparent')
      document.documentElement.style.setProperty('--toastify-text-color-light', 'inherit')
      document.documentElement.style.setProperty('--toastify-color-dark', 'transparent')
      document.documentElement.style.setProperty('--toastify-text-color-dark', 'inherit')
      // Trigger a no-op to ensure container recalculates theme when toggling
      toast.dismiss()
    } catch {}
  }, [])
  return <>{children}</>
}

export default ThemeProvider


