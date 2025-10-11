import { Suspense, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { wsClient } from '@/shared/lib/ws'

import BottomNav from '@/app/layout/BottomNav'
import AdminBottomNav from '@/app/layout/AdminBottomNav'
import Header from '@/app/layout/Header'
import ThemeListPage from '@/pages/Theme/ui/ThemeListPage'
import ThemePage from '@/pages/Theme/ui/ThemePage'
import ExplorePage from '@/pages/Explore/ui/ExplorePage'
import LikesPage from '@/pages/Likes/ui/LikesPage'
import OnboardingPage from '@/pages/Onboarding/ui/OnboardingPage'
import WelcomePage from '@/pages/Onboarding/ui/WelcomePage'
import PendingModerationPage from '@/pages/Onboarding/ui/PendingModerationPage'
import DetailsPage from '@/pages/Onboarding/ui/DetailsPage'
import ProfilePage from '@/pages/Profile/ui/ProfilePage'
import MyProfilePage from '@/pages/MyProfile'
import HelpPage from '@/pages/Help'
import PrivacyPage from '@/pages/Privacy'
import BlacklistPage from '@/pages/Blacklist'
import ThemeSettingsPage from '@/pages/ThemeSettings'
import RecommendationsPage from '@/pages/Recommendations'
import NotificationsPage from '@/pages/Notifications'
import AboutPositionPage from '@/pages/AboutPosition'
import { AdminPage, ModerationPage, UsersPage } from '@/pages/Admin'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import { getProfileStatus, getUserInfo } from '@/shared/api/profile'
import type { UserInfoResponse } from '@/shared/api/profile'
import PageTransition from '@/shared/ui/PageTransition'
import LikesNotification from '@/shared/components/LikesNotification'

export function AppRouter(): JSX.Element {
  const {ready, isWebApp} = useTelegramAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [started, setStarted] = useState<boolean>(false)
  const [userInfo, setUserInfo] = useState<UserInfoResponse | null>(null)

  /* Массив со страницами где не требуется отображение нижней панели */
  const BottomNavIgnore = ['/theme/*']

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

  function HeaderSwitcher(): JSX.Element {
    const location = useLocation()
    const navigate = useNavigate()
    const p = location.pathname
    const title = p === '/my-profile' ? 'Моя анкета' 
      : p === '/help' ? 'Справка' 
      : p === '/privacy' ? 'Конфиденциальность' 
      : p === '/blacklist' ? 'Черный список'
      : p === '/chat-settings' ? 'Тема'
      : p === '/recommendations' ? 'Рекомендации'
      : p === '/notifications' ? 'Уведомления'
      : p === '/about-position' ? 'Наша позиция'
      : 'Okeano'

    // Telegram BackButton integration
    useEffect(() => {
      const webApp = window?.Telegram?.WebApp
      const showBack = p === '/my-profile' || p === '/help' || p === '/privacy' || p === '/blacklist' || p === '/chat-settings' || p === '/recommendations' || p === '/notifications' || p === '/about-position'
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
          <div className="">{/* reserve space for bottom nav */}
            <HeaderSwitcher />
            <main className="fixed left-0 right-0" style={{ top: '100px', bottom: '80px', overflow: 'auto' }}>
            <PageTransition>
              <div className="h-full">
                <Routes>
                <Route path="/" element={<Navigate to="/theme" replace />} />
                <Route path="/theme" element={<ThemeListPage />} />
                <Route path="/theme/:chatId" element={<ThemePage />} />
                <Route path="/likes" element={<LikesPage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/my-profile" element={<MyProfilePage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/blacklist" element={<BlacklistPage />} />
                <Route path="/chat-settings" element={<ThemeSettingsPage />} />
                <Route path="/recommendations" element={<RecommendationsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/about-position" element={<AboutPositionPage />} />
                
                {/* Админские роуты - всегда доступны, но защищены внутри компонентов */}
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/moderation" element={<ModerationPage />} />
                <Route path="/admin/users" element={<UsersPage />} />
                
                <Route path="*" element={<Navigate to="/theme" replace />} />
              </Routes>
              </div>
            </PageTransition>
            </main>
            
            {/* Показываем соответствующее нижнее меню */}
            <BottomNavSwitcher />
            
            {/* Глобальные уведомления */}
            <LikesNotification />
          </div>
        )}
      </BrowserRouter>
    </Suspense>
  )
}

export default AppRouter