import { useEffect, useState, type JSX } from 'react'

import { getMyProfile, type MyProfileResponse } from '@/shared/api/profile'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import ProfileCard, { type ProfileCardData } from '@/entities/ProfileCard'
import { toast } from 'sonner'
import DesktopProfileLayout from '@/app/layout/DesktopProfileLayout'

export default function MyProfilePage(): JSX.Element {
  const { user } = useTelegramAuth()
  const [isDesktop, setIsDesktop] = useState(false)
  const [profileData, setProfileData] = useState<MyProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Определяем размер экрана
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError(null)
      const initData = window?.Telegram?.WebApp?.initData || ''
      try {
        const resp = await getMyProfile(initData)
        if (resp.ok) {
          setProfileData(resp)
        } else {
          setError(resp.message || 'Не удалось загрузить профиль')
        }
      } catch (e) {
        setError('Ошибка загрузки профиля')
        console.error('Failed to load profile:', e)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadProfile()
    }
  }, [user])

  const handleProfileUpdate = (updatedProfile: ProfileCardData) => {
    if (profileData?.ok) {
      setProfileData({
        ...profileData,
        profile: {
          ...profileData.profile,
          displayName: updatedProfile.displayName,
          city: updatedProfile.city,
          bio: updatedProfile.bio,
          gender: updatedProfile.gender ?? null,
          heightCm: updatedProfile.heightCm ?? null,
          weightKg: updatedProfile.weightKg ?? null,
          wandSizeCm: updatedProfile.wandSizeCm ?? null,
          photos: updatedProfile.photos,
        }
      })
    }
  }

  if (loading) {
    return (
      <div className={`mx-auto h-full bg-[var(--color-bg)] flex items-center justify-center ${isDesktop ? 'max-w-4xl' : 'max-w-md'}`}>
        <div className="text-[var(--color-fg)]">Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`mx-auto h-full bg-[var(--color-bg)] flex items-center justify-center ${isDesktop ? 'max-w-4xl' : 'max-w-md'}`}>
        <div className="text-red-500 text-center">{error}</div>
      </div>
    )
  }

  if (!profileData?.ok || !profileData.profile) {
    return (
      <div className={`mx-auto h-full bg-[var(--color-bg)] flex items-center justify-center ${isDesktop ? 'max-w-4xl' : 'max-w-md'}`}>
        <div className="text-[var(--color-fg)]">Профиль не найден.</div>
      </div>
    )
  }

  const profileContent = (
    <div className={`mx-auto h-full bg-[var(--color-bg)] ${isDesktop ? 'max-w-4xl' : 'max-w-md'}`}>
      {/* Контент страницы */}
      <div className={`h-full ${isDesktop ? 'px-6 py-8' : 'px-4'}`}>
        <ProfileCard
          data={{
            userId: user?.id?.toString() || '',
            displayName: profileData.profile.displayName,
            age: null, // Возраст не используется в моем профиле
            city: profileData.profile.city,
            photos: profileData.profile.photos,
            bio: profileData.profile.bio,
            heightCm: profileData.profile.heightCm,
            weightKg: profileData.profile.weightKg,
            wandSizeCm: profileData.profile.wandSizeCm,
            gender: profileData.profile.gender,
          }}
          onLike={() => {}} // Пустые функции для режима редактирования
          onDislike={() => {}}
          isEditable={true}
          onProfileUpdate={handleProfileUpdate}
        />
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <DesktopProfileLayout>
        {profileContent}
      </DesktopProfileLayout>
    )
  }

  return profileContent
}
