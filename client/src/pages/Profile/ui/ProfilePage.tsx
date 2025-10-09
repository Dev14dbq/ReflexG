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
  RiQuestionLine
} from 'react-icons/ri'

import { getAvatar, getUserInfo, type UserInfoResponse, getMyProfile, patchMyProfile } from '@/shared/api/profile'
import BottomSheet from '@/shared/ui/BottomSheet/BottomSheet'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import ProfileDropdown from '@/entities/ProfileDropdown'
import { toast } from 'sonner'


interface ProfileMenuItem {
  id: string
  title: string
  icon: JSX.Element
  onClick: () => void
}

export default function ProfilePage(): JSX.Element {
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
      onClick: () => navigate('/my-profile')
    },
    {
      id: 'privacy',
      title: 'Конфиденциальность',
      icon: <RiShieldLine size={20} />,
      onClick: () => navigate('/privacy')
    },
    {
      id: 'chat-settings',
      title: 'Настройки чатов',
      icon: <RiChat3Line size={20} />,
      onClick: () => navigate('/chat-settings')
    },
    {
      id: 'recommendations',
      title: 'Настройки рекомендаций',
      icon: <RiSettings3Line size={20} />,
      onClick: () => navigate('/recommendations')
    },
    {
      id: 'notifications',
      title: 'Уведомления',
      icon: <RiNotification3Line size={20} />,
      onClick: () => navigate('/notifications')
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

  return (
    <>
    <div className="max-w-md mx-auto min-h-screen bg-[var(--color-bg)] pb-20">
      {/* Заголовок с градиентом */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-b from-[var(--color-accent)] via-[color-mix(in_oklab,var(--color-accent)70%,var(--color-bg)30%)] to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)]/10 to-transparent dark:from-[var(--color-bg)]/20"></div>
      </div>

      <div className="px-4 -mt-28 relative z-10">
        {/* Карточка профиля */}
        <div className="bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-lg shadow-sm">
          {/* Аватар и основная информация */}
          <div className="relative p-4">
            <button
              ref={profileButtonRef}
              onClick={handleEditProfileClick}
              className="w-full flex flex-col items-center text-center hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-all duration-200 rounded-lg cursor-pointer group py-2"
            >
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-full border border-[var(--color-accent)] overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  {avatarInfo.photoUrl ? (
                    <img 
                      src={avatarInfo.photoUrl} 
                      alt={displayName} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
                      <RiUser3Line size={24} className="text-[var(--color-accent)]" />
                    </div>
                  )}
                </div>
                {/* Индикатор редактирования */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[var(--color-accent)] rounded-full flex items-center justify-center border border-[var(--color-bg)]">
                  <RiArrowDownSLine 
                    size={10} 
                    className={`text-white transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  />
                </div>
              </div>
              
              <div className="w-full">
                <div className="font-bold text-lg text-[var(--color-fg)] mb-1">
                  {displayName}
                </div>
                {user?.username && (
                  <div className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)] mb-2">
                    @{user.username}
                  </div>
                )}
                {isDescPending && !botHidden ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-[var(--color-accent)] text-[var(--color-accent)] cursor-pointer hover:opacity-80 transition-opacity ${botFading ? 'animate-bot-fade' : ''}`}
                    style={{ background: 'color-mix(in oklab, var(--color-accent) 12%, var(--color-bg) 88%)' }}
                    title="Данные профиля на модерации"
                    onClick={handleModerationBadgeClick}
                    onAnimationEnd={handleAnimationEnd}
                  >
                    ⏳ На модерации
                  </span>
                ) : (
                  <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)50%,var(--color-muted)50%)]">
                    Нажмите для редактирования
                  </div>
                )}
              </div>
            </button>

            {/* Выпадающее меню профиля */}
            <ProfileDropdown 
              isOpen={isDropdownOpen}
              onClose={() => setIsDropdownOpen(false)}
              triggerRef={profileButtonRef}
              onAvatarChange={handleAvatarChange}
            />
          </div>
        </div>
        
        {/* Меню настроек */}
        <div className="mt-4 space-y-2">
          {/* Кнопка справки */}
          <div className="hover:shadow-sm transition-all duration-200">
            <button
              onClick={() => navigate('/help')}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors rounded-lg cursor-pointer group border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] hover:border-[color-mix(in_oklab,var(--color-accent)20%,transparent)]"
            >
              <div className="w-8 h-8 rounded-md bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center group-hover:bg-[color-mix(in_oklab,var(--color-accent)20%,transparent)] transition-colors duration-200">
                <div className="text-[var(--color-accent)]">
                  <RiQuestionLine size={20} />
                </div>
              </div>
              <div className="flex-1">
                <span className="font-medium text-[var(--color-fg)] text-sm">
                  Справка
                </span>
              </div>
              <RiArrowDownSLine 
                size={14} 
                className="text-[color-mix(in_oklab,var(--color-fg)50%,var(--color-muted)50%)] rotate-[-90deg]" 
              />
            </button>
          </div>
          
          <div className="text-sm font-semibold text-[color-mix(in_oklab,var(--color-fg)80%,var(--color-muted)20%)] px-2 mb-3">
            Настройки
          </div>
          
          {profileMenuItems.map((item) => (
            <div key={item.id} className="hover:shadow-sm transition-all duration-200">
              <button
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors rounded-lg cursor-pointer group border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] hover:border-[color-mix(in_oklab,var(--color-accent)20%,transparent)]"
              >
                <div className="w-8 h-8 rounded-md bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center group-hover:bg-[color-mix(in_oklab,var(--color-accent)20%,transparent)] transition-colors duration-200">
                  <div className="text-[var(--color-accent)]">
                    {item.icon}
                  </div>
                </div>
                <div className="flex-1">
                  <span className="font-medium text-[var(--color-fg)] text-sm">
                    {item.title}
                  </span>
                </div>
                <RiArrowDownSLine 
                  size={14} 
                  className="text-[color-mix(in_oklab,var(--color-fg)50%,var(--color-muted)50%)] rotate-[-90deg]" 
                />
              </button>
            </div>
          ))}
          
          {/* Кнопка админки для модераторов и админов */}
          {isAdminUser && (
            <div className="hover:shadow-sm transition-all duration-200">
              <button
                key={adminMenuItem.id}
                onClick={adminMenuItem.onClick}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-[color-mix(in_oklab,var(--color-bg)95%,yellow5005%)] transition-colors rounded-lg cursor-pointer group border border-yellow-200 hover:border-yellow-300"
              >
                <div className="w-8 h-8 rounded-md bg-yellow-100 flex items-center justify-center group-hover:bg-yellow-200 transition-colors duration-200">
                  <div className="text-yellow-600">
                    {adminMenuItem.icon}
                  </div>
                </div>
                <div className="flex-1">
                  <span className="font-medium text-yellow-700 text-sm">
                    {adminMenuItem.title}
                  </span>
                </div>
                <RiArrowDownSLine 
                  size={14} 
                  className="text-yellow-500 rotate-[-90deg]" 
                />
              </button>
            </div>
          )}
        </div>

        {/* Статистика или дополнительная информация */}
        <div className="mt-4 mb-3"></div>
      </div>

      {/* Подпись внизу страницы */}
      <div className="px-4 pb-4">
        <div 
          className="text-center text-xs text-[color-mix(in_oklab,var(--color-fg)50%,var(--color-muted)50%)] cursor-pointer select-none hover:text-[var(--color-accent)] transition-colors py-1"
          onClick={handleSignatureClick}
        >
          Okeano для Telegram App v0.14.2
        </div>
      </div>
    </div>
    <BottomSheet
      isOpen={sheetOpen}
      title={editingField === 'photos' ? 'Фотографии' : 'Редактирование'}
      onClose={() => setSheetOpen(false)}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button className="btn" onClick={() => setSheetOpen(false)}>Отмена</button>
          <button className="btn btn-primary" onClick={submitEdit}>Сохранить</button>
        </div>
      }
    >
      {editingField === 'photos' ? (
        <div className="space-y-2">
          <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
            Вставьте ссылки на фото, по одной в каждой строке. Минимум 1 фото.
          </div>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full h-40 p-3 rounded-lg border border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] bg-[color-mix(in_oklab,var(--color-bg)97%,var(--color-accent)3%)] outline-none"
            placeholder="https://...\nhttps://..."
          />
        </div>
      ) : (
        <input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="input"
          placeholder={editingField === 'gender' ? 'GAY / LESBIAN / ...' : ''}
        />
      )}
    </BottomSheet>
    </>
  )
}
