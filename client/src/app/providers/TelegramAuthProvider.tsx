import type { JSX, PropsWithChildren } from 'react'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isTelegramInWebApp } from '@/shared/lib/telegram'
import { validateTelegramInitData } from '@/shared/api/telegram'
import LoadingScreen from '@/shared/ui/LoadingScreen/LoadingScreen'

export interface TelegramAuthState {
  ready: boolean
  isWebApp: boolean
  user: import('@/shared/lib/telegram').TelegramUser | null
  statuses: string[]
  error: string | null
}

const TelegramAuthContext = createContext<TelegramAuthState | null>(null)

export function useTelegramAuth(): TelegramAuthState {
  const ctx = useContext(TelegramAuthContext)
  if (!ctx) {
    throw new Error('useTelegramAuth must be used within TelegramAuthProvider')
  }
  return ctx
}

export function TelegramAuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [ready, setReady] = useState<boolean>(false)
  const [isWebApp, setIsWebApp] = useState<boolean>(false)
  const [user, setUser] = useState<import('@/shared/lib/telegram').TelegramUser | null>(null)
  const [statuses, setStatuses] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showLoading, setShowLoading] = useState<boolean>(false)

  const pushStatus = (msg: string) => setStatuses(prev => [...prev, msg])
  const hasInitializedRef = useRef<boolean>(false)

  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    // Defer showing the loading overlay to avoid flash on fast init
    const timer = setTimeout(() => setShowLoading(true), 200)

    const inWebApp = isTelegramInWebApp()
    setIsWebApp(inWebApp)
    pushStatus('Инициализация Telegram WebApp')

    if (inWebApp) {
      try {
        window.Telegram?.WebApp?.ready?.()
        pushStatus('Уведомление готовности веб‑приложения')
        window.Telegram?.WebApp?.expand?.()
        pushStatus('Расширение окна WebApp')
      } catch {}
    }

    ;(async () => {
      try {
        if (!inWebApp) {
          // В браузере вне Telegram разрешаем продолжить без пользователя
          pushStatus('Запуск вне Telegram')
          return
        }
        const initData = window?.Telegram?.WebApp?.initData
        if (!initData) {
          pushStatus('initData отсутствует')
          return
        }
        pushStatus('Проверка пользователя')
        const result = await validateTelegramInitData(initData)
        if (result.ok) {
          setUser(result.user ?? null)
          pushStatus('Проверка завершена')
        } else {
          setError(result.message ?? 'Не удалось подтвердить пользователя')
          pushStatus('Ошибка проверки')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
        pushStatus('Ошибка проверки')
      } finally {
        setReady(true)
        clearTimeout(timer)
      }
    })()
  }, [])

  const value = useMemo<TelegramAuthState>(() => ({ ready, isWebApp, user, statuses, error }), [ready, isWebApp, user, statuses, error])

  if (!ready) {
    // Suppress overlay until delay elapsed; hide debug statuses to avoid flicker of text
    if (!showLoading) return <TelegramAuthContext.Provider value={value}></TelegramAuthContext.Provider>
    return (
      <TelegramAuthContext.Provider value={value}>
        <LoadingScreen statuses={[]} />
      </TelegramAuthContext.Provider>
    )
  }

  return <TelegramAuthContext.Provider value={value}>{children}</TelegramAuthContext.Provider>
}

export default TelegramAuthProvider


