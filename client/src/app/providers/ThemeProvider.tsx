import type { PropsWithChildren, JSX } from 'react'
import { useEffect } from 'react'
import { toast } from 'react-toastify'

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  useEffect(() => {
    // Функция для определения темы на основе системных настроек
    const updateTheme = () => {
      // Проверяем тему Telegram WebApp
      const telegramTheme = window?.Telegram?.WebApp?.colorScheme
      let isDark = false

      if (telegramTheme) {
        // Если есть информация о теме из Telegram, используем её
        isDark = telegramTheme === 'dark'
      } else {
        // Иначе используем системную тему браузера
        isDark = typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
          : false
      }

      // Применяем тему
      document.documentElement.classList.toggle('dark', isDark)
      
      // Обновляем тему для toast уведомлений
      try {
        document.documentElement.style.setProperty('--toastify-color-light', 'transparent')
        document.documentElement.style.setProperty('--toastify-text-color-light', 'inherit')
        document.documentElement.style.setProperty('--toastify-color-dark', 'transparent')
        document.documentElement.style.setProperty('--toastify-text-color-dark', 'inherit')
        toast.dismiss()
      } catch {}
    }

    // Устанавливаем тему при загрузке
    updateTheme()

    // Слушаем изменения системной темы браузера
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', updateTheme)
      
      return () => {
        mediaQuery.removeEventListener('change', updateTheme)
      }
    }

    // Периодически проверяем изменения темы Telegram WebApp
    // (так как Telegram WebApp может не предоставлять события изменения темы)
    const checkTelegramTheme = () => {
      updateTheme()
    }

    // Проверяем изменения темы каждые 500ms
    const intervalId = setInterval(checkTelegramTheme, 500)

    return () => {
      clearInterval(intervalId)
    }
  }, [])

  return <>{children}</>
}

export default ThemeProvider


