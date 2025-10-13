import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RiUser3Line,
  RiNotification3Line,
  RiShieldLine,
  RiChat3Line,
  RiSettings3Line,
  RiArrowDownSLine,
  RiAdminLine,
  RiQuestionLine,
  RiEditLine,
  RiMapPinLine,
  RiFileTextLine,
  RiUserLine,
  RiRulerLine,
  RiWeightLine,
  RiImageLine
} from 'react-icons/ri'

import { getAvatar, getUserInfo, type UserInfoResponse, getMyProfile, patchMyProfile } from '@/shared/api/profile'
import BottomSheet from '@/shared/ui/BottomSheet/BottomSheet'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import { toast } from 'sonner'

// Импорты для вкладок
import PrivacyPage from '@/pages/Privacy/ui/PrivacyPage'
import ThemeSettingsPage from '@/pages/ThemeSettings/ui/ThemeSettingsPage'
import RecommendationsPage from '@/pages/Recommendations/ui/RecommendationsPage'
import NotificationsPage from '@/pages/Notifications/ui/NotificationsPage'

interface ProfileMenuItem {
  id: string
  title: string
  icon: JSX.Element
  onClick: () => void
}

export default function DesktopProfilePage(): JSX.Element {
  const { user } = useTelegramAuth()

  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false)
  const [avatarInfo, setAvatarInfo] = useState<{ photoUrl: string | null; isCustom: boolean }>({
    photoUrl: user?.photo_url ?? null,
    isCustom: false
  })
  const [userInfo, setUserInfo] = useState<UserInfoResponse | null>(null)
  const [myProfile, setMyProfile] = useState<{
    displayName: string | null
    city: string | null
    bio: string | null
    gender: string | null
    heightCm: number | null
    weightKg: number | null
    wandSizeCm: number | null
    photos: string[]
  } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingField, setEditingField] = useState<
    null | 'displayName' | 'city' | 'bio' | 'gender' | 'heightCm' | 'weightKg' | 'wandSizeCm' | 'photos'
  >(null)
  const [editValue, setEditValue] = useState<string>('')
  const isDescPending = userInfo?.ok && userInfo.user.profile && userInfo.user.profile.descriptionModerationStatus === 'PENDING'
  const [clearDataClicks, setClearDataClicks] = useState(0)
  const [botFading, setBotFading] = useState(false)
  const [botHidden, setBotHidden] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('profile')
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

  
  // Загружаем информацию об аватаре и пользователе при монтировании
  useEffect(() => {
    async function loadUserData() {
      const initData = window?.Telegram?.WebApp?.initData || ''
      try {
        // Загружаем информацию об аватаре
        const avatarResp = await getAvatar(initData)
        if (avatarResp.ok) {
          setAvatarInfo({
            photoUrl: avatarResp.photoUrl ?? user?.photo_url ?? null,
            isCustom: avatarResp.isCustom
          })
        }
        
        // Загружаем информацию о пользователе (включая роль)
        const userResp = await getUserInfo(initData)
        if (userResp.ok) {
          setUserInfo(userResp)
        }

        // Загружаем мою анкету
        const myResp = await getMyProfile(initData)
        if (myResp.ok) {
          setMyProfile({
            displayName: myResp.profile.displayName,
            city: myResp.profile.city,
            bio: myResp.profile.bio,
            gender: myResp.profile.gender ?? null,
            heightCm: myResp.profile.heightCm,
            weightKg: myResp.profile.weightKg,
            wandSizeCm: myResp.profile.wandSizeCm,
            photos: myResp.profile.photos,
          })
        }
      } catch {
        // Игнорируем ошибки, используем фото из Telegram
      }
    }
    
    if (user) {
      loadUserData()
    }
  }, [user])
  
  const displayName = useMemo(() => {
    if (!user) return 'Пользователь'
    return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `ID ${user.id}`
  }, [user])

  // Функция очистки всех локальных данных
  const clearAllLocalData = () => {
    try {
      // Очищаем localStorage
      localStorage.clear()
      
      // Очищаем sessionStorage
      sessionStorage.clear()
      
      // Очищаем IndexedDB (если используется)
      if ('indexedDB' in window) {
        indexedDB.databases?.().then(databases => {
          databases.forEach(db => {
            if (db.name) {
              indexedDB.deleteDatabase(db.name)
            }
          })
        })
      }
      
      // Очищаем cookies
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=")
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      })
      
      console.log('Все локальные данные очищены')
      toast.success('Все локальные данные приложения очищены!')
    } catch (error) {
      console.error('Ошибка при очистке данных:', error)
      toast.error('Ошибка при очистке данных')
    }
  }

  // Функция закрытия приложения через Telegram WebApp API
  const closeWebApp = () => {
    try {
      const anyWin = window as any
      anyWin?.Telegram?.WebApp?.close?.()
    } catch (error) {
      console.error('Ошибка при закрытии приложения:', error)
      // Fallback для обычных браузеров
      if (window.close) {
        window.close()
      } else {
        window.location.href = 'about:blank'
      }
    }
  }

  // Обработчик клика на подпись для скрытой функции очистки
  const handleSignatureClick = () => {
    const newClicks = clearDataClicks + 1
    setClearDataClicks(newClicks)
    
    if (newClicks >= 5) {
      // Очищаем данные
      clearAllLocalData()
      
      // Закрываем приложение через Telegram WebApp API
      setTimeout(() => {
        closeWebApp()
      }, 1000) // Даем время показать тост успеха
    } else {
      // Показываем тост с прогрессом
      const remaining = 5 - newClicks
      toast.info(`Осталось нажатий: ${remaining}`)
    }
  }

  const profileMenuItems: ProfileMenuItem[] = [
    {
      id: 'profile',
      title: 'Моя анкета',
      icon: <RiUser3Line size={20} />,
      onClick: () => setActiveTab('profile')
    },
    {
      id: 'privacy',
      title: 'Конфиденциальность',
      icon: <RiShieldLine size={20} />,
      onClick: () => setActiveTab('privacy')
    },
    {
      id: 'chat-settings',
      title: 'Настройки темы',
      icon: <RiChat3Line size={20} />,
      onClick: () => setActiveTab('chat-settings')
    },
    {
      id: 'recommendations',
      title: 'Настройки рекомендаций',
      icon: <RiSettings3Line size={20} />,
      onClick: () => setActiveTab('recommendations')
    },
    {
      id: 'notifications',
      title: 'Уведомления',
      icon: <RiNotification3Line size={20} />,
      onClick: () => setActiveTab('notifications')
    }
  ]

  // Добавляем кнопку админки для модераторов и админов
  const adminMenuItem: ProfileMenuItem = {
    id: 'admin',
    title: 'Админ панель',
    icon: <RiAdminLine size={20} />,
    onClick: () => navigate('/admin')
  }

  // Проверяем, является ли пользователь модератором или админом
  const isAdminUser = userInfo?.ok && (userInfo.user.isModerator || userInfo.user.isAdmin)

  function handleEditProfileClick(): void {
    setIsDropdownOpen(!isDropdownOpen)
  }

  function handleAvatarChange(photoUrl: string | null, isCustom: boolean): void {
    setAvatarInfo({ photoUrl, isCustom })
  }

  // Обработчик клика на бейдж модерации
  function handleModerationBadgeClick(): void {
    setBotFading(true)
    toast.info('Ваш профиль находится на модерации. Мы проверяем ваши данные и скоро дадим результат!', {
      duration: 5000,
      description: 'Обычно модерация занимает несколько часов'
    })
  }

  // Обработчик завершения анимации
  function handleAnimationEnd(): void {
    if (botFading) {
      setBotHidden(true)
      setBotFading(false)
    }
  }

  function openEdit(field: typeof editingField, preset?: string): void {
    setEditingField(field)
    setEditValue(preset ?? '')
    setSheetOpen(true)
  }

  async function submitEdit(): Promise<void> {
    const initData = window?.Telegram?.WebApp?.initData || ''
    if (!editingField) return
    try {
      const body: any = { initData }
      if (editingField === 'heightCm' || editingField === 'weightKg' || editingField === 'wandSizeCm') {
        // allow null to delete value
        body[editingField] = editValue.trim() === '' ? null : Number(editValue)
      } else if (editingField === 'photos') {
        const urls = editValue.split('\n').map(s => s.trim()).filter(Boolean)
        if (urls.length > 0) body.photos = urls
      } else {
        body[editingField] = editValue
      }
      const resp = await patchMyProfile(body)
      if (resp.ok) {
        toast.success('Изменения отправлены на модерацию')
        setSheetOpen(false)
      } else {
        toast.error(resp.message || 'Ошибка сохранения')
      }
    } catch (e) {
      toast.error('Ошибка сохранения')
    }
  }

  // Функция для рендеринга контента вкладок
  const renderTabContent = () => {
    const tabContent = (() => {
      switch (activeTab) {
        case 'privacy':
          return <PrivacyPage />
        case 'chat-settings':
          return <ThemeSettingsPage />
        case 'recommendations':
          return <RecommendationsPage />
        case 'notifications':
          return <NotificationsPage />
        case 'profile':
        default:
          return renderProfileContent()
      }
    })()

    // Если это не профиль, оборачиваем в контейнер
    if (activeTab !== 'profile') {
      return (
        <div className="min-h-[400px]">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--color-fg)] mb-2">
              {profileMenuItems.find(item => item.id === activeTab)?.title || 'Настройки'}
            </h2>
            <p className="text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">
              Управление настройками и параметрами
            </p>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--color-bg)98%,var(--color-accent)2%)] rounded-lg p-6 border border-[color-mix(in_oklab,var(--color-accent)5%,transparent)]">
            {tabContent}
          </div>
        </div>
      )
    }

    return tabContent
  }

  // Функция для рендеринга контента профиля
  const renderProfileContent = () => (
    <>
      {/* Аватар и основная информация */}
      <div className="flex items-end gap-6 mb-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[var(--color-bg)] shadow-lg">
            {avatarInfo.photoUrl ? (
              <img src={avatarInfo.photoUrl} alt="Аватар" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
                <RiUser3Line size={32} className="text-[var(--color-accent)]" />
              </div>
            )}
          </div>
          {isDescPending && !botHidden && (
            <div 
              className={`absolute -top-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${botFading ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}
              onClick={handleModerationBadgeClick}
              onAnimationEnd={handleAnimationEnd}
            >
              <RiEditLine size={16} className="text-white" />
            </div>
          )}
        </div>

        <div className="flex-1">
          <h2 className="text-2xl font-bold text-[var(--color-fg)] mb-1">
            {myProfile?.displayName || displayName}
          </h2>
          <p className="text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] mb-2">
            {myProfile?.city || 'Город не указан'}
          </p>
          {myProfile?.bio && (
            <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,transparent)] line-clamp-2">
              {myProfile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Детальная информация */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Пол */}
        <div className="flex items-center gap-3 p-4 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] rounded-lg">
          <RiUserLine size={20} className="text-[var(--color-accent)]" />
          <div>
            <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">Пол</p>
            <p className="font-medium text-[var(--color-fg)]">
              {myProfile?.gender || 'Не указан'}
            </p>
          </div>
        </div>

        {/* Рост */}
        <div className="flex items-center gap-3 p-4 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] rounded-lg">
          <RiRulerLine size={20} className="text-[var(--color-accent)]" />
          <div>
            <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">Рост</p>
            <p className="font-medium text-[var(--color-fg)]">
              {myProfile?.heightCm ? `${myProfile.heightCm} см` : 'Не указан'}
            </p>
          </div>
        </div>

        {/* Вес */}
        <div className="flex items-center gap-3 p-4 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] rounded-lg">
          <RiWeightLine size={20} className="text-[var(--color-accent)]" />
          <div>
            <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">Вес</p>
            <p className="font-medium text-[var(--color-fg)]">
              {myProfile?.weightKg ? `${myProfile.weightKg} кг` : 'Не указан'}
            </p>
          </div>
        </div>

        {/* Размер */}
        <div className="flex items-center gap-3 p-4 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] rounded-lg">
          <RiRulerLine size={20} className="text-[var(--color-accent)]" />
          <div>
            <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">Размер</p>
            <p className="font-medium text-[var(--color-fg)]">
              {myProfile?.wandSizeCm ? `${myProfile.wandSizeCm} см` : 'Не указан'}
            </p>
          </div>
        </div>
      </div>

      {/* Фото */}
      {myProfile?.photos && myProfile.photos.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-[var(--color-fg)] mb-4 flex items-center gap-2">
            <RiImageLine size={20} className="text-[var(--color-accent)]" />
            Фотографии
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {myProfile.photos.map((photo, index) => (
              <div key={index} className="aspect-square rounded-lg overflow-hidden">
                <img src={photo} alt={`Фото ${index + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className="h-full bg-[var(--color-bg)]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-fg)] mb-2">Профиль</h1>
          <p className="text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">Управление настройками и информацией о себе</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Левая колонка - основная информация */}
          <div className="lg:col-span-2 space-y-6">
            {/* Карточка профиля */}
            <div className="bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-xl shadow-sm overflow-hidden">
              {/* Заголовок с градиентом */}
              <div className="relative h-32 bg-gradient-to-br from-[var(--color-accent)] via-[color-mix(in_oklab,var(--color-accent)70%,var(--color-bg)30%)] to-transparent">
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)]/10 to-transparent"></div>
              </div>

              <div className="px-6 pb-6 -mt-16 relative z-10">
                {renderTabContent()}
              </div>
            </div>
          </div>

          {/* Правая колонка - меню */}
          <div className="space-y-6">
            {/* Быстрые действия */}
            <div className="bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-[var(--color-fg)] mb-4">Быстрые действия</h3>
              <div className="space-y-2">
                {profileMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                      activeTab === item.id 
                        ? 'bg-[var(--color-accent)] text-white' 
                        : 'hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)]'
                    }`}
                  >
                    <div className={activeTab === item.id ? 'text-white' : 'text-[var(--color-accent)]'}>
                      {item.icon}
                    </div>
                    <span className={`font-medium ${activeTab === item.id ? 'text-white' : 'text-[var(--color-fg)]'}`}>
                      {item.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Админские функции */}
            {isAdminUser && (
              <div className="bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-[var(--color-fg)] mb-4">Администрирование</h3>
                <button
                  onClick={adminMenuItem.onClick}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors text-left"
                >
                  <div className="text-[var(--color-accent)]">{adminMenuItem.icon}</div>
                  <span className="text-[var(--color-fg)] font-medium">{adminMenuItem.title}</span>
                </button>
              </div>
            )}

            {/* Информация */}
            <div className="bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--color-fg)] mb-4">Информация</h3>
              <div className="space-y-3 text-sm text-[color-mix(in_oklab,var(--color-fg)70%,transparent)]">
                <p>• Редактируйте информацию в разделе "Моя анкета"</p>
                <p>• Настройте конфиденциальность в соответствующих разделах</p>
                <p>• Все изменения проходят модерацию</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sheet для редактирования */}
      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[var(--color-fg)] mb-4">
            {editingField === 'displayName' && 'Имя'}
            {editingField === 'city' && 'Город'}
            {editingField === 'bio' && 'О себе'}
            {editingField === 'gender' && 'Пол'}
            {editingField === 'heightCm' && 'Рост (см)'}
            {editingField === 'weightKg' && 'Вес (кг)'}
            {editingField === 'wandSizeCm' && 'Размер (см)'}
            {editingField === 'photos' && 'Фотографии'}
          </h3>
          
          {editingField === 'photos' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Введите URL фотографий, каждое с новой строки"
              className="w-full h-32 p-3 border border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] rounded-lg bg-[var(--color-bg)] text-[var(--color-fg)] resize-none"
            />
          ) : (
            <input
              type={editingField === 'heightCm' || editingField === 'weightKg' || editingField === 'wandSizeCm' ? 'number' : 'text'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={`Введите ${editingField === 'displayName' ? 'имя' : editingField === 'city' ? 'город' : editingField === 'bio' ? 'описание' : editingField === 'gender' ? 'пол' : 'значение'}`}
              className="w-full p-3 border border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] rounded-lg bg-[var(--color-bg)] text-[var(--color-fg)]"
            />
          )}
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setSheetOpen(false)}
              className="flex-1 px-4 py-2 border border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] text-[var(--color-fg)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={submitEdit}
              className="flex-1 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[color-mix(in_oklab,var(--color-accent)90%,black)] transition-colors"
            >
              Сохранить
            </button>
          </div>
        </div>
      </BottomSheet>

    </div>
  )
}