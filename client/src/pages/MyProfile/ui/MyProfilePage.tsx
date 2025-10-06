import { useEffect, useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiArrowLeftSLine } from 'react-icons/ri'

import { getMyProfile, type MyProfileResponse } from '@/shared/api/profile'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import ProfileCard, { type ProfileCardData } from '@/entities/ProfileCard'
import { toast } from 'sonner'

export default function MyProfilePage(): JSX.Element {
  const { user } = useTelegramAuth()
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState<MyProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      <div className="max-w-md mx-auto min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-[var(--color-fg)]">Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-red-500 text-center">{error}</div>
      </div>
    )
  }

  if (!profileData?.ok || !profileData.profile) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-[var(--color-fg)]">Профиль не найден.</div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[var(--color-bg)]">
      {/* Верхний бар */}
      <div className="sticky top-0 left-0 right-0 bg-[var(--color-bg)] z-20 border-b border-[color-mix(in_oklab,var(--color-accent)10%,transparent)]">
        <div className="flex items-center justify-center h-14 px-4 relative">
          <button
            onClick={() => navigate(-1)}
            className="absolute left-4 text-[var(--color-fg)] hover:opacity-70 transition-opacity"
          >
            <RiArrowLeftSLine size={24} />
          </button>
          <h1 className="text-lg font-semibold text-[var(--color-fg)]">Моя анкета</h1>
        </div>
      </div>

      {/* Контент страницы */}
      <div className="px-4">
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
}