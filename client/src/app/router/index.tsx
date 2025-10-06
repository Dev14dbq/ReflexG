import { Suspense, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { wsClient } from '@/shared/lib/ws'

import BottomNav from '@/app/layout/BottomNav'
import AdminBottomNav from '@/app/layout/AdminBottomNav'
import ChatListPage from '@/pages/Chat/ui/ChatListPage'
import ChatPage from '@/pages/Chat/ui/ChatPage'
import ExplorePage from '@/pages/Explore/ui/ExplorePage'
import LikesPage from '@/pages/Likes/ui/LikesPage'
import OnboardingPage from '@/pages/Onboarding/ui/OnboardingPage'
import WelcomePage from '@/pages/Onboarding/ui/WelcomePage'
import PendingModerationPage from '@/pages/Onboarding/ui/PendingModerationPage'
import DetailsPage from '@/pages/Onboarding/ui/DetailsPage'
import ProfilePage from '@/pages/Profile/ui/ProfilePage'
import MyProfilePage from '@/pages/MyProfile'
import HelpPage from '@/pages/Help'
import { AdminPage, ModerationPage, UsersPage } from '@/pages/Admin'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import { getProfileStatus, getUserInfo } from '@/shared/api/profile'
import type { UserInfoResponse } from '@/shared/api/profile'
import PageTransition from '@/shared/ui/PageTransition'

export function AppRouter(): JSX.Element {
  const {ready, isWebApp} = useTelegramAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [started, setStarted] = useState<boolean>(false)
  const [userInfo, setUserInfo] = useState<UserInfoResponse | null>(null)

  /* Массив со страницами где не требуется отображение нижней панели */
  const BottomNavIgnore = ['/chat/*']

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
        // Скрывать только если есть непустой хвост после префикса: '/chat/*' → '/chat/...' (но не '/chat' или '/chat/')
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
            <PageTransition>
              <Routes>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/chat" element={<ChatListPage />} />
                <Route path="/chat/:chatId" element={<ChatPage />} />
                <Route path="/likes" element={<LikesPage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/my-profile" element={<MyProfilePage />} />
                <Route path="/help" element={<HelpPage />} />
                
                {/* Админские роуты - всегда доступны, но защищены внутри компонентов */}
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/moderation" element={<ModerationPage />} />
                <Route path="/admin/users" element={<UsersPage />} />
                
                <Route path="*" element={<Navigate to="/chat" replace />} />
              </Routes>
            </PageTransition>
            
            {/* Показываем соответствующее нижнее меню */}
            <BottomNavSwitcher />
          </div>
        )}
      </BrowserRouter>
    </Suspense>
  )
}

export default AppRouter