import { Suspense, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { wsClient } from '@/shared/lib/ws'

import BottomNav from '@/app/layout/BottomNav'
import AdminBottomNav from '@/app/layout/AdminBottomNav'
import Header from '@/app/layout/Header'
import DesktopLayout from '@/app/layout/DesktopLayout'
import { MobileRoutes, DesktopRoutes } from './Routes'
import OnboardingPage from '@/pages/Onboarding/ui/OnboardingPage'
import WelcomePage from '@/pages/Onboarding/ui/WelcomePage'
import PendingModerationPage from '@/pages/Onboarding/ui/PendingModerationPage'
import DetailsPage from '@/pages/Onboarding/ui/DetailsPage'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import { getProfileStatus, getUserInfo } from '@/shared/api/profile'
import type { UserInfoResponse } from '@/shared/api/profile'
import PageTransition from '@/shared/ui/PageTransition'
import LikesNotification from '@/shared/components/LikesNotification'
import { HEADER_HEIGHT_PX, BOTTOM_NAV_HEIGHT_PX } from '@/app/layout/constants'

export function AppRouter(): JSX.Element {
  const {ready, isWebApp} = useTelegramAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [started, setStarted] = useState<boolean>(false)
  const [userInfo, setUserInfo] = useState<UserInfoResponse | null>(null)

  /* Массив со страницами где не требуется отображение нижней панели */
  const BottomNavIgnore = ['/theme/*', '/messages/*']

    /* Подключение к WebSocket серверу */
    useEffect(() => {
      const telegramInitData = window?.Telegram?.WebApp?.initData || ''
      if (telegramInitData) {
        wsClient.connect(telegramInitData)
      }
    }, [])

  const shouldHideBottomNav = (pathname: string): boolean => {
    const normalizePrefix = (value: string): string => (value.startsWith('/') ? value : `/${value}`)
    const normalizedPath = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    return BottomNavIgnore.some((raw) => {
      const hasWildcard = raw.endsWith('/*')
      const rawPrefix = hasWildcard ? raw.slice(0, -2) : raw
      const prefix = normalizePrefix(rawPrefix)
      if (prefix === '/') return true

      if (hasWildcard) {
        // Скрывать только если есть непустой хвост после префикса: '/theme/*' → '/theme/...' (но не '/theme' или '/theme/')
        if (!normalizedPath.startsWith(`${prefix}/`)) return false
        const rest = normalizedPath.slice(prefix.length + 1) // часть после `${prefix}/`
        return rest.length > 0
      }

      // Обычное поведение для точных префиксов
      return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!ready || !isWebApp) return
      const initData = window?.Telegram?.WebApp?.initData || ''
      
      // Получаем статус профиля
      const resp = await getProfileStatus(initData)
      if (!cancelled && resp.ok) setStatus(resp.status)
      
      // Получаем информацию о пользователе (включая роль)
      try {
        const userResp = await getUserInfo(initData)
        if (!cancelled && userResp.ok) setUserInfo(userResp)
      } catch (error) {
        console.error('Failed to fetch user info:', error)
      }
    })()
    return () => { cancelled = true }
  }, [ready, isWebApp])

  // Проверяем, является ли пользователь модератором или админом
  const isAdminUser = userInfo?.ok && (userInfo.user.isModerator || userInfo.user.isAdmin)

  function BottomNavSwitcher(): JSX.Element | null {
    const location = useLocation()
    const pathname = location.pathname
    if (pathname.startsWith('/admin')) return <AdminBottomNav />
    return !shouldHideBottomNav(pathname) ? <BottomNav /> : null
  }

  function LayoutSwitcher(): JSX.Element {
    const location = useLocation()
    const pathname = location.pathname
    
    // Для десктопа используем DesktopLayout
    if (window.innerWidth >= 1024) {
      return <DesktopLayout><DesktopRoutes /></DesktopLayout>
    }
    
    // Для мобильных устройств используем раскладку с учётом фиксированных header/bottom nav
    const showBottom = !shouldHideBottomNav(pathname)
    const bottomForMain = showBottom ? `${BOTTOM_NAV_HEIGHT_PX}px` : '0px'
    return (
      <div className="">
        <HeaderSwitcher />
        <main className="fixed left-0 right-0" style={{ top: `${HEADER_HEIGHT_PX}px`, bottom: bottomForMain, overflow: 'auto' }}>
          <PageTransition>
            <div className="h-full">
              <MobileRoutes />
            </div>
          </PageTransition>
        </main>
        <BottomNavSwitcher />
        <LikesNotification />
      </div>
    )
  }

  function HeaderSwitcher(): JSX.Element {
    const location = useLocation()
    const navigate = useNavigate()
    const p = location.pathname
    const title = p.startsWith('/u/') ? (() => {
      // Профиль пользователя: заголовок "Профиль"
      return 'Профиль'
    })()
      : p === '/my-profile' ? 'Моя анкета' 
      : p === '/help' ? 'Справка' 
      : p === '/privacy' ? 'Конфиденциальность' 
      : p === '/blacklist' ? 'Черный список'
      : p === '/likes-history' ? 'История лайков'
      : p === '/chat-settings' ? 'Тема'
      : p === '/recommendations' ? 'Рекомендации'
      : p === '/notifications' ? 'Уведомления'
      : p === '/about-position' ? 'Наша позиция'
      : 'Okeano'

    // Telegram BackButton integration
    useEffect(() => {
      const webApp = window?.Telegram?.WebApp
      const showBack = p.startsWith('/u/') || p === '/my-profile' || p === '/help' || p === '/privacy' || p === '/blacklist' || p === '/likes-history' || p === '/chat-settings' || p === '/recommendations' || p === '/notifications' || p === '/about-position'
      if (!webApp?.BackButton) return
      const onBack = () => navigate(-1)
      try {
        if (showBack) {
          webApp.BackButton.show?.()
          webApp.BackButton.onClick?.(onBack)
        } else {
          webApp.BackButton.hide?.()
        }
      } catch {}
      return () => {
        try { webApp?.BackButton?.offClick?.(onBack) } catch {}
      }
    }, [p, navigate])
    return <Header title={title} />
  }

  return (
    <Suspense fallback={null}>
      <BrowserRouter>
        {!ready ? null : status === 'UNDER_REVIEW_BASE' ? (
          <PageTransition>
            <PendingModerationPage />
          </PageTransition>
        ) : status === 'NEED_DESCRIPTION' ? (
          <PageTransition>
            <DetailsPage />
          </PageTransition>
        ) : status === 'BASE_DISCREPANT' ? (
          <PageTransition>
            <OnboardingPage />
          </PageTransition>
        ) : status === 'NO_PROFILE' ? (
          <PageTransition>  
            {started ? <OnboardingPage /> : <WelcomePage onStart={() => setStarted(true)} />}
          </PageTransition>
        ) : (
          <LayoutSwitcher />
        )}
      </BrowserRouter>
    </Suspense>
  )
}

export default AppRouter