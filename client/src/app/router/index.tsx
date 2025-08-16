import { Suspense, useEffect, useState } from 'react'
import type { JSX } from 'react'
import HomePage from '../../pages/Home/ui/HomePage'
import OnboardingPage from '@/pages/Onboarding/ui/OnboardingPage'
import WelcomePage from '@/pages/Onboarding/ui/WelcomePage'
import PendingModerationPage from '@/pages/Onboarding/ui/PendingModerationPage'
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
      {!ready ? null : status === 'UNDER_REVIEW_BASE' ? (
        <PendingModerationPage />
      ) : status === 'NO_PROFILE' ? (
        started ? <OnboardingPage /> : <WelcomePage onStart={() => setStarted(true)} />
      ) : (
        <HomePage />
      )}
    </Suspense>
  )
}

export default AppRouter


