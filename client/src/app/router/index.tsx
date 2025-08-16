import { Suspense, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from '../../pages/Home/ui/HomePage'
import BottomNav from '@/app/layout/BottomNav'
import ChatListPage from '@/pages/Messages/ui/ChatListPage'
import ChatPage from '@/pages/Messages/ui/ChatPage'
import ExplorePage from '@/pages/Explore/ui/ExplorePage'
import OnboardingPage from '@/pages/Onboarding/ui/OnboardingPage'
import WelcomePage from '@/pages/Onboarding/ui/WelcomePage'
import PendingModerationPage from '@/pages/Onboarding/ui/PendingModerationPage'
import DetailsPage from '@/pages/Onboarding/ui/DetailsPage'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import { getProfileStatus } from '@/shared/api/profile'

export function AppRouter(): JSX.Element {
  const { ready, isWebApp } = useTelegramAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [started, setStarted] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!ready || !isWebApp) return
      const initData = window?.Telegram?.WebApp?.initData || ''
      const resp = await getProfileStatus(initData)
      if (!cancelled && resp.ok) setStatus(resp.status)
    })()
    return () => { cancelled = true }
  }, [ready, isWebApp])

  return (
    <Suspense fallback={null}>
      <BrowserRouter>
        {!ready ? null : status === 'UNDER_REVIEW_BASE' ? (
          <PendingModerationPage />
        ) : status === 'NEED_DESCRIPTION' ? (
          <DetailsPage />
        ) : status === 'NO_PROFILE' ? (
          started ? <OnboardingPage /> : <WelcomePage onStart={() => setStarted(true)} />
        ) : (
          <div className="pb-16">{/* reserve space for bottom nav */}
            <Routes>
              <Route path="/" element={<Navigate to="/messages" replace />} />
              <Route path="/messages" element={<ChatListPage />} />
              <Route path="/messages/:chatId" element={<ChatPage />} />
              <Route path="/likes" element={<div className="p-4">Лайки (в разработке)</div>} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/profile" element={<div className="p-4">Профиль (в разработке)</div>} />
              <Route path="*" element={<Navigate to="/messages" replace />} />
            </Routes>
            <BottomNav />
          </div>
        )}
      </BrowserRouter>
    </Suspense>
  )
}

export default AppRouter


