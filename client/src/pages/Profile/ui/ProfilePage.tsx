import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RiUser3Line,
  RiNotification3Line,
  RiShieldLine,
  RiChat3Line,
  RiSettings3Line,
  RiArrowDownSLine,
  RiAdminLine
} from 'react-icons/ri'

import { getAvatar, getUserInfo, type UserInfoResponse } from '@/shared/api/profile'
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
  const [clearDataClicks, setClearDataClicks] = useState(0)
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
      onClick: () => console.log('Моя анкета')
    },
    {
      id: 'notifications',
      title: 'Уведомления и звуки',
      icon: <RiNotification3Line size={20} />,
      onClick: () => console.log('Уведомления и звуки')
    },
    {
      id: 'privacy',
      title: 'Конфиденциальность',
      icon: <RiShieldLine size={20} />,
      onClick: () => console.log('Конфиденциальность')
    },
    {
      id: 'chat-settings',
      title: 'Настройки чатов',
      icon: <RiChat3Line size={20} />,
      onClick: () => console.log('Настройки чатов')
    },
    {
      id: 'recommendations',
      title: 'Настройки рекомендаций',
      icon: <RiSettings3Line size={20} />,
      onClick: () => console.log('Настройки рекомендаций')
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

  return (
    <div className="max-w-md mx-auto">
      <div className="sticky top-0 left-0 right-0 z-10 px-4 py-3 text-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-xl font-semibold">Профиль</div>
      </div>
      
      <div className="p-4">
        {/* Аватар и имя пользователя в одну линию - кликабельная кнопка */}
        <div className="relative">
          <button
            ref={profileButtonRef}
            onClick={handleEditProfileClick}
            className="w-full flex items-center gap-3 py-4 px-4 text-left hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors rounded-lg cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full border border-accent overflow-hidden flex items-center justify-center">
              {avatarInfo.photoUrl ? (
                <img 
                  src={avatarInfo.photoUrl} 
                  alt={displayName} 
                  className="w-full h-12 object-cover"
                />
              ) : (
                <div className="text-sm text-muted">No</div>
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium">{displayName}</div>
              {user?.username && (
                <div className="text-sm text-muted">@{user.username}</div>
              )}
            </div>
            <RiArrowDownSLine 
              size={20} 
              className={`text-[var(--color-muted)] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
            />
          </button>

          {/* Выпадающее меню профиля */}
          <ProfileDropdown 
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            triggerRef={profileButtonRef}
            onAvatarChange={handleAvatarChange}
          />
        </div>

        {/* Меню настроек */}
        <div className="space-y-1">
          {profileMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors cursor-pointer"
            >
              <div className="text-accent">
                {item.icon}
              </div>
              <span className="font-medium">
                {item.title}
              </span>
            </button>
          ))}
          
          {/* Кнопка админки для модераторов и админов */}
          {isAdminUser && (
            <button
              key={adminMenuItem.id}
              onClick={adminMenuItem.onClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors border-t border-[var(--color-border)] pt-4 mt-4 cursor-pointer"
            >
              <div className="text-yellow-500">
                {adminMenuItem.icon}
              </div>
              <span className="font-medium text-yellow-600">
                {adminMenuItem.title}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Подпись внизу страницы */}
      <div 
        className="text-center text-xs text-muted cursor-pointer select-none hover:text-accent transition-colors"
        onClick={handleSignatureClick}
      >
        Okeano для Telegram App v0.14.2
      </div>
    </div>
  )
}
