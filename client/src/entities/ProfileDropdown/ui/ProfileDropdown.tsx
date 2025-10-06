import type { JSX } from 'react'
import { useRef, useEffect, useState } from 'react'
import { RiUser3Line, RiUploadLine } from 'react-icons/ri'

import { uploadImage } from '@/shared/api/cdn'
import { getAvatar, removeCustomAvatar, updateAvatar } from '@/shared/api/profile'

interface ProfileDropdownProps {
  isOpen: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLElement | null>
  onAvatarChange?: (photoUrl: string | null, isCustom: boolean) => void
}

interface AvatarInfoState {
  photoUrl: string | null
  isCustom: boolean
  needsUpdate: boolean
}

export default function ProfileDropdown({ isOpen, onClose, triggerRef, onAvatarChange }: ProfileDropdownProps): JSX.Element {
  const [avatar, setAvatar] = useState<AvatarInfoState>({ photoUrl: null, isCustom: false, needsUpdate: false })
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<boolean>(false)
  const [isVisible, setIsVisible] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      loadAvatar()
    } else {
      // Добавляем задержку для завершения анимации исчезновения
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 200) // Увеличиваем до 200ms для полного завершения анимации
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current && 
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, triggerRef])

  async function loadAvatar(): Promise<void> {
    const initData = window?.Telegram?.WebApp?.initData || ''
    setLoading(true)
    setError(null)
    try {
      const resp = await getAvatar(initData)
      if (resp.ok) {
        setAvatar({ 
          photoUrl: resp.photoUrl ?? null, 
          isCustom: resp.isCustom, 
          needsUpdate: resp.needsUpdate 
        })
      } else {
        setError(resp.message || 'Не удалось получить аватар')
      }
    } catch {
      setError('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  async function handleUseTelegramPhoto(): Promise<void> {
    const initData = window?.Telegram?.WebApp?.initData || ''
    setLoading(true)
    setError(null)
    try {
      const resp = await removeCustomAvatar({ initData })
      if (!resp.ok) {
        setError(resp.message || 'Не удалось вернуть аватар Telegram')
        setLoading(false)
        return
      }
      await loadAvatar()
      // Уведомляем родителя об изменении
      if (onAvatarChange) {
        onAvatarChange(avatar.photoUrl, false)
      }
    } catch {
      setError('Ошибка')
    } finally {
      setLoading(false)
    }
  }

  function handleUploadClick(): void {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
        setError('Поддерживаются JPEG/PNG/WebP')
        setUploading(false)
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Файл слишком большой (>5MB)')
        setUploading(false)
        return
      }
      const resp = await uploadImage(file)
      if (!resp.ok) {
        setError(resp.message || 'Не удалось загрузить изображение')
        setUploading(false)
        return
      }
      // Save custom avatar via HTTP
      const initData = window?.Telegram?.WebApp?.initData || ''
      const save = await updateAvatar({ initData, photoUrl: resp.url })
      if (!save.ok) {
        setError(save.message || 'Не удалось сохранить аватар')
        setUploading(false)
        return
      }
      const newAvatar = { 
        photoUrl: save.photoUrl || avatar.photoUrl || null, 
        isCustom: true, 
        needsUpdate: false 
      }
      setAvatar(newAvatar)
      if (onAvatarChange) {
        onAvatarChange(newAvatar.photoUrl, newAvatar.isCustom)
      }
      setUploading(false)
    } catch (err) {
      setError('Ошибка загрузки')
      setUploading(false)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <>
      {(isOpen || isVisible) && (
        <div 
          ref={dropdownRef}
          className={`absolute top-full left-0 mt-2 bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] rounded-lg shadow-lg z-50 overflow-hidden w-full transition-all duration-200 ease-out ${
            isOpen && isVisible
              ? 'opacity-100 scale-100 translate-y-0' 
              : 'opacity-0 scale-95 -translate-y-2'
          }`}
          style={{ 
            minWidth: '200px'
          }}
        >
        {/* Заголовок */}
        <div className="px-4 py-3 border-b border-[color-mix(in_oklab,var(--color-accent)15%,transparent)]">
          <div className="text-sm font-medium text-[var(--color-fg)]">Фото профиля</div>
        </div>

        {/* Кнопки действий */}
        <div className="p-3 space-y-2">
          <button 
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleUseTelegramPhoto}
            disabled={loading || uploading}
          >
            <RiUser3Line size={18} className="text-[var(--color-accent)]" />
            <span className="text-sm">Использовать фото из Telegram</span>
          </button>

          <button 
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleUploadClick}
            disabled={uploading || loading}
          >
            <RiUploadLine size={18} className="text-[var(--color-accent)]" />
            <span className="text-sm">
              {uploading ? 'Загрузка…' : 'Загрузить новое фото'}
            </span>
          </button>

          <input 
            ref={fileInputRef} 
            type="file" 
            accept="image/jpeg,image/png,image/webp" 
            className="hidden" 
            onChange={handleFileChange} 
          />
        </div>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
          </div>
        )}

        {/* Статус аватара */}
        <div className="px-4 py-2 bg-[color-mix(in_oklab,var(--color-bg)98%,var(--color-accent)2%)] border-t border-[color-mix(in_oklab,var(--color-accent)15%,transparent)]">
          <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
            {avatar.isCustom ? 'Используется загруженное фото' : 'Используется фото из Telegram'}
          </div>
        </div>
        </div>
      )}
    </>
  )
}
