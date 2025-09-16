import type { JSX } from 'react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { z } from 'zod'
import { FaVenusMars, FaRuler, FaMagic, FaCheck, FaRedo, FaBan, FaExclamationTriangle, FaPlus, FaMinus } from 'react-icons/fa'

export const ModerationCardSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().nullable(),
  age: z.number().int().min(14).max(120).nullable(),
  city: z.string().nullable(),
  photos: z.array(z.union([
    z.string(), // URL строка
    z.object({ // Объект фото с сервера
      id: z.string(),
      url: z.string(),
      position: z.number(),
      status: z.string()
    })
  ])).min(0),
  bio: z.string().nullable(),
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  weightKg: z.number().int().min(20).max(400).nullable().optional(),
  wandSizeCm: z.number().int().min(1).max(100).nullable().optional(),
  gender: z.string().nullable().optional(),
  type: z.enum(['INITIAL', 'PROFILE_DESCRIPTION', 'PROFILE_EDIT', 'PHOTOS']),
  createdAt: z.string(),
  user: z.object({
    telegramId: z.string(),
    username: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable()
  }),
  // Новые поля для отслеживания изменений
  payload: z.object({
    profile: z.object({
      city: z.string().nullable(),
      displayName: z.string().nullable(),
      birthDate: z.string().nullable(),
      gender: z.string().nullable(),
      sex: z.string().nullable(),
      description: z.string().nullable(),
      heightCm: z.number().nullable(),
      weightKg: z.number().nullable(),
      wandSizeCm: z.number().nullable(),
      createdAt: z.string(),
      updatedAt: z.string()
    }).nullable().optional(),
    isNewProfile: z.boolean().optional(),
    changes: z.object({
      displayName: z.object({
        old: z.string().nullable().optional(),
        new: z.string().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      city: z.object({
        old: z.string().nullable().optional(),
        new: z.string().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      description: z.object({
        old: z.string().nullable().optional(),
        new: z.string().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      heightCm: z.object({
        old: z.number().nullable().optional(),
        new: z.number().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      weightKg: z.object({
        old: z.number().nullable().optional(),
        new: z.number().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      wandSizeCm: z.object({
        old: z.number().nullable().optional(),
        new: z.number().nullable().optional(),
        changed: z.boolean()
      }).optional(),
      gender: z.object({
        old: z.string().nullable().optional(),
        new: z.string().nullable().optional(),
        changed: z.boolean()
      }).optional()
    }).optional(),
    photoChanges: z.object({
      added: z.array(z.string()).optional(),
      removed: z.array(z.string()).optional(),
      reordered: z.boolean().optional()
    }).optional()
  }).passthrough().optional()
})
export type ModerationCardData = z.infer<typeof ModerationCardSchema>

interface Props {
  data: ModerationCardData
  onApprove: (itemId: string) => void
  onReject: (itemId: string, reason: string, banUser: boolean) => void
  onDiscrepant: (itemId: string, reason: string) => void
}

interface ImageState {
  loading: boolean
  error: boolean
  loaded: boolean
}

export default function ModerationCard({ data, onApprove, onReject, onDiscrepant }: Props): JSX.Element {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [imageStates, setImageStates] = useState<ImageState[]>([])
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState<'REJECT' | 'DISCREPANT' | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [banUser, setBanUser] = useState(false)
  const [selectedIssues, setSelectedIssues] = useState<string[]>([])
  
  const photoContainerRef = useRef<HTMLDivElement>(null)
  
  // Используем данные из payload если доступны, иначе fallback на старые поля
  type PayloadType = NonNullable<ModerationCardData['payload']>
  const payload = (data.payload ?? {}) as Partial<PayloadType>
  const isNewProfile: boolean = typeof payload.isNewProfile === 'boolean' ? payload.isNewProfile : false
  const changes = (payload.changes ?? {}) as Partial<NonNullable<PayloadType['changes']>>
  const photoChanges = (payload.photoChanges ?? {}) as Partial<NonNullable<PayloadType['photoChanges']>>
  
  // Определяем какие данные показывать (учитываем payload.profile как источник правды)
  const profilePayload = (payload as any).profile ?? {}
  const pickString = (direct: unknown, fromProfile: unknown, fallback: string | null): string | null => {
    if (typeof direct === 'string' && direct.trim() !== '') return direct
    if (typeof fromProfile === 'string' && fromProfile.trim() !== '') return fromProfile
    return fallback
  }
  const pickNumber = (direct: unknown, fromProfile: unknown, fallback: number | null): number | null => {
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct
    if (typeof fromProfile === 'number' && Number.isFinite(fromProfile)) return fromProfile as number
    return fallback
  }

  const displayName: string | null = pickString((payload as any).displayName, (profilePayload as any).displayName, data.displayName)
  const city: string | null = pickString((payload as any).city, (profilePayload as any).city, data.city)
  const bio: string | null = pickString((payload as any).description, (profilePayload as any).description, data.bio)
  const heightCm: number | null = pickNumber((payload as any).heightCm, (profilePayload as any).heightCm, data.heightCm ?? null)
  const weightKg: number | null = pickNumber((payload as any).weightKg, (profilePayload as any).weightKg, data.weightKg ?? null)
  const wandSizeCm: number | null = pickNumber((payload as any).wandSizeCm, (profilePayload as any).wandSizeCm, data.wandSizeCm ?? null)
  const gender: string | null = pickString((payload as any).gender, (profilePayload as any).gender, data.gender ?? null)
  
  // Обрабатываем фотографии - они могут быть строками или объектами
  const rawPhotos = (payload.photos ?? data.photos ?? []) as Array<string | { id: string; url: string; position: number; status: string }>
  const photos: string[] = useMemo(() => {
    const source = Array.isArray(rawPhotos) ? rawPhotos : []
    return source
      .map(photo => {
        if (typeof photo === 'string') return photo
        if (photo && typeof photo === 'object' && 'url' in photo && typeof (photo as any).url === 'string') {
          return (photo as any).url
        }
        return null
      })
      .filter((url): url is string => url !== null)
  }, [rawPhotos])
  
  const title = [displayName, data.age ? String(data.age) : null].filter(Boolean).join(', ')
  
  // Валидация данных профиля
  useEffect(() => {
    if (!data || !data.userId) return
    // Предупреждаем только при реальном дубле
    const uniquePhotos = [...new Set(photos.filter((p) => Boolean(p)))]
    if (uniquePhotos.length !== photos.filter((p) => Boolean(p)).length) {
      console.warn('Duplicate photos detected in profile:', data.userId)
    }
  }, [data, photos])

  // Инициализируем состояния для всех изображений
  useEffect(() => {
    if (!Array.isArray(photos)) return
    
    setImageStates(photos.map(() => ({ loading: true, error: false, loaded: false })))
    
    // Устанавливаем timeout для каждого изображения (5 секунд)
    const timeouts: number[] = []
    photos.forEach((_, index) => {
      const timeout = window.setTimeout(() => {
        setImageStates(prev => prev.map((state, i) => 
          i === index && state.loading ? { ...state, loading: false, loaded: true, error: false } : state
        ))
      }, 5000) // 5 секунд timeout - считаем что изображение загрузилось
      timeouts.push(timeout)
    })
    
    // Дополнительный timeout для скрытия индикатора загрузки через 2 секунды
    const hideLoadingTimeout = window.setTimeout(() => {
      setImageStates(prev => prev.map(state => ({ ...state, loading: false })))
    }, 2000)
    timeouts.push(hideLoadingTimeout)
    
    // Принудительно показываем изображения через 3 секунды
    const showImagesTimeout = window.setTimeout(() => {
      setImageStates(prev => prev.map(state => ({ ...state, loading: false, loaded: true })))
    }, 3000)
    timeouts.push(showImagesTimeout)
    
    return () => {
      timeouts.forEach(timeout => window.clearTimeout(timeout))
    }
  }, [photos])

  // Проверяем корректность URL изображений
  useEffect(() => {
    photos.forEach((photoUrl, index) => {
      if (!photoUrl || !isValidImageUrl(photoUrl)) {
        console.warn(`Invalid image URL at index ${index}:`, photoUrl)
        setImageStates(prev => prev.map((state, i) => 
          i === index ? { ...state, loading: false, error: true, loaded: false } : state
        ))
      }
    })
  }, [photos])

  // Проверка корректности URL изображения
  const isValidImageUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string' || url.trim() === '') return false
    
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }
  
  const nextPhoto = () => {
    if (photos.length > 1) {
      const nextIndex = findNextValidPhotoIndex(currentPhotoIndex)
      if (nextIndex !== -1) {
        setCurrentPhotoIndex(nextIndex)
      }
    }
  }
  
  const prevPhoto = () => {
    if (photos.length > 1) {
      const prevIndex = findPrevValidPhotoIndex(currentPhotoIndex)
      if (prevIndex !== -1) {
        setCurrentPhotoIndex(prevIndex)
      }
    }
  }

  const handlePhotoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (photos.length <= 1) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const halfWidth = rect.width / 2
    
    if (clickX < halfWidth) {
      prevPhoto()
    } else {
      nextPhoto()
    }
  }

  const handleImageLoad = (index: number) => {
    // Получаем элемент img из DOM для проверки размеров
    const imgElement = document.querySelector(`img[src="${photos[index]}"]`) as HTMLImageElement
    if (imgElement) {
      if (imgElement.naturalWidth > 0 && imgElement.naturalHeight > 0) {
        // Проверяем минимальные размеры изображения
        if (imgElement.naturalWidth < 50 || imgElement.naturalHeight < 50) {
          console.warn(`Image ${index} too small: ${imgElement.naturalWidth}x${imgElement.naturalHeight}`)
          handleImageError(index)
          return
        }
        
        setImageStates(prev => prev.map((state, i) => 
          i === index ? { ...state, loading: false, loaded: true, error: false } : state
        ))
      } else {
        console.warn(`Image ${index} loaded but has zero dimensions`)
        handleImageError(index)
      }
    } else {
      // Если элемент не найден, считаем что изображение загрузилось
      setImageStates(prev => prev.map((state, i) => 
        i === index ? { ...state, loading: false, loaded: true, error: false } : state
      ))
    }
  }

  const handleImageError = (index: number) => {
    console.error(`Image ${index} failed to load:`, photos[index])
    
    // Определяем тип ошибки
    const photoUrl = photos[index]
    if (photoUrl) {
      const img = new Image()
      img.onerror = () => {
        console.error(`Image ${index} network error or invalid format`)
      }
      img.src = photoUrl
    }
    
    setImageStates(prev => prev.map((state, i) => 
      i === index ? { ...state, loading: false, error: true, loaded: false } : state
    ))
    
    // Если текущее изображение не загрузилось, переключаемся на следующее рабочее
    if (index === currentPhotoIndex) {
      const nextValidIndex = findNextValidPhotoIndex(index)
      if (nextValidIndex !== -1) {
        console.log(`Switching to next valid image: ${nextValidIndex}`)
        setCurrentPhotoIndex(nextValidIndex)
      }
    }
  }

  // Поиск следующего рабочего изображения
  const findNextValidPhotoIndex = (startIndex: number): number => {
    const totalPhotos = photos.length
    if (totalPhotos === 0) return -1
    
    // Ищем по часовой стрелке
    for (let i = 1; i < totalPhotos; i++) {
      const nextIndex = (startIndex + i) % totalPhotos
      const state = imageStates[nextIndex]
      if (!state?.error) return nextIndex
    }
    
    // Если не нашли, ищем против часовой стрелки
    for (let i = 1; i < totalPhotos; i++) {
      const prevIndex = (startIndex - i + totalPhotos) % totalPhotos
      const state = imageStates[prevIndex]
      if (!state?.error) return prevIndex
    }
    
    return -1
  }

  // Поиск предыдущего рабочего изображения
  const findPrevValidPhotoIndex = (startIndex: number): number => {
    const totalPhotos = photos.length
    if (totalPhotos === 0) return -1
    
    // Ищем против часовой стрелки
    for (let i = 1; i < totalPhotos; i++) {
      const prevIndex = (startIndex - i + totalPhotos) % totalPhotos
      const state = imageStates[prevIndex]
      if (!state?.error) return prevIndex
    }
    
    // Если не нашли, ищем по часовой стрелке
    for (let i = 1; i < totalPhotos; i++) {
      const nextIndex = (startIndex + i) % totalPhotos
      const state = imageStates[nextIndex]
      if (!state?.error) return nextIndex
    }
    
    return -1
  }

  // Сброс индекса фото при смене карточки
  useEffect(() => {
    setCurrentPhotoIndex(0)
  }, [data.userId])

  // Обработка переключения на следующее изображение при ошибках
  useEffect(() => {
    const currentState = imageStates[currentPhotoIndex]
    if (currentState?.error && photos.length > 1) {
      const nextValidIndex = findNextValidPhotoIndex(currentPhotoIndex)
      if (nextValidIndex !== -1 && nextValidIndex !== currentPhotoIndex) {
        console.log(`Auto-switching from failed image ${currentPhotoIndex} to ${nextValidIndex}`)
        setCurrentPhotoIndex(nextValidIndex)
      }
    }
  }, [imageStates, photos.length]) // Убираем currentPhotoIndex из зависимостей

  const formatHeight = (heightCm: number | null | undefined) => {
    if (!heightCm) return null
    const meters = Math.floor(heightCm / 100)
    const cm = heightCm % 100
    return `${meters}.${cm.toString().padStart(2, '0')} м`
  }

  const formatWeight = (weightKg: number | null | undefined) => {
    if (!weightKg) return null
    return `${weightKg} кг`
  }

  const formatWandSize = (wandSizeCm: number | null | undefined) => {
    if (!wandSizeCm) return null
    return `${wandSizeCm} см`
  }

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'INITIAL': return 'Первичная модерация'
      case 'PROFILE_DESCRIPTION': return 'Описание профиля'
      case 'PROFILE_EDIT': return 'Редактирование профиля'
      case 'PHOTOS': return 'Фотографии'
      default: return type
    }
  }

  const openActionModal = (type: 'REJECT' | 'DISCREPANT') => {
    setActionType(type)
    setActionReason('')
    setBanUser(false)
    setSelectedIssues([])
    setShowActionModal(true)
  }

  const executeAction = () => {
    if (!actionType) return
    
    switch (actionType) {
      case 'REJECT':
        onReject(data.id, actionReason, banUser)
        break
      case 'DISCREPANT':
        onDiscrepant(data.id, actionReason)
        break
    }
    
    setShowActionModal(false)
    setActionType(null)
    setActionReason('')
    setBanUser(false)
    setSelectedIssues([])
  }

  const currentImageState = imageStates[currentPhotoIndex] || { loading: true, error: false, loaded: false }
  const hasValidPhotos = Array.isArray(photos) && photos.length > 0 && photos.some((_, index) => !imageStates[index]?.error)
  const allPhotosFailed = Array.isArray(photos) && photos.length > 0 && photos.every((_, index) => imageStates[index]?.error)

  // Если все изображения не загрузились, показываем сообщение об ошибке
  useEffect(() => {
    if (allPhotosFailed && Array.isArray(photos)) {
      console.error('All photos failed to load:', photos)
    }
  }, [allPhotosFailed, photos])

  // Функция для подсветки измененных данных
  const renderField = (fieldName: string, value: any, oldValue?: any) => {
    const fieldChanges = (changes as any)[fieldName]
    const isChanged = fieldChanges?.changed || false
    const isNew = isNewProfile
    
    if (isChanged || isNew) {
      return (
        <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm">
          {value || 'Не указано'}
          {isChanged && oldValue && (
            <span className="text-xs text-green-600 dark:text-green-400 ml-2">
              было: {oldValue || 'Не указано'}
            </span>
          )}
        </span>
      )
    }
    
    return <span className="text-[var(--color-fg)]">{value || 'Не указано'}</span>
  }

  return (
    <div className="card">
      {/* Заголовок с типом модерации */}
      <div className="mb-3 p-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] rounded-lg">
        <div className="text-sm text-[var(--color-fg-secondary)] mb-1">
          {getTypeLabel(data.type)}
          {isNewProfile && (
            <span className="ml-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              Новый профиль
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--color-fg-secondary)]">
          Создано: {new Date(data.createdAt).toLocaleString('ru-RU')}
        </div>
        <div className="text-xs text-[var(--color-fg-secondary)]">
          Пользователь: {data.user.firstName || data.user.username || data.user.telegramId}
        </div>
      </div>

      {/* Показываем изменения если это не новый профиль */}
      {!isNewProfile && Object.keys(changes).length > 0 && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            Изменения в профиле:
          </div>
          <div className="space-y-2 text-sm">
            {changes.displayName?.changed && (
              <div>
                <span className="text-blue-600 dark:text-blue-400">Имя:</span>{' '}
                <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                  {changes.displayName.new || 'Не указано'}
                </span>
                <span className="text-gray-500 ml-2">
                  (было: {changes.displayName.old || 'Не указано'})
                </span>
              </div>
            )}
            {changes.city?.changed && (
              <div>
                <span className="text-blue-600 dark:text-blue-400">Город:</span>{' '}
                <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                  {changes.city.new || 'Не указано'}
                </span>
                <span className="text-gray-500 ml-2">
                  (было: {changes.city.old || 'Не указано'})
                </span>
              </div>
            )}
            {changes.description?.changed && (
              <div>
                <span className="text-blue-600 dark:text-blue-400">Описание:</span>{' '}
                <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                  {changes.description.new || 'Не указано'}
                </span>
                <span className="text-gray-500 ml-2">
                  (было: {changes.description.old || 'Не указано'})
                </span>
              </div>
            )}
            {changes.heightCm?.changed && (
              <div>
                <span className="text-blue-600 dark:text-blue-400">Рост:</span>{' '}
                <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                  {changes.heightCm.new ? `${changes.heightCm.new} см` : 'Не указано'}
                </span>
                <span className="text-gray-500 ml-2">
                  (было: {changes.heightCm.old ? `${changes.heightCm.old} см` : 'Не указано'})
                </span>
              </div>
            )}
            {changes.weightKg?.changed && (
              <div>
                <span className="text-blue-600 dark:text-blue-400">Вес:</span>{' '}
                <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                  {changes.weightKg.new ? `${changes.weightKg.new} кг` : 'Не указано'}
                </span>
                <span className="text-gray-500 ml-2">
                  (было: {changes.weightKg.old ? `${changes.weightKg.old} кг` : 'Не указано'})
                </span>
              </div>
            )}
            {changes.wandSizeCm?.changed && (
              <div>
                <span className="text-blue-600 dark:text-blue-400">Размер палочки:</span>{' '}
                <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                  {changes.wandSizeCm.new ? `${changes.wandSizeCm.new} см` : 'Не указано'}
                </span>
                <span className="text-gray-500 ml-2">
                  (было: {changes.wandSizeCm.old ? `${changes.wandSizeCm.old} см` : 'Не указано'})
                </span>
              </div>
            )}
            {changes.gender?.changed && (
              <div>
                <span className="text-blue-600 dark:text-blue-400">Пол:</span>{' '}
                <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                  {changes.gender.new || 'Не указано'}
                </span>
                <span className="text-gray-500 ml-2">
                  (было: {changes.gender.old || 'Не указано'})
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Показываем изменения фотографий */}
      {Object.keys(photoChanges).length > 0 && (
        <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
            Изменения фотографий:
          </div>
          <div className="space-y-2 text-sm">
            {photoChanges.added && photoChanges.added.length > 0 && (
              <div className="flex items-center gap-2">
                <FaPlus className="text-green-500" />
                <span className="text-green-700 dark:text-green-300">
                  Добавлено: {photoChanges.added.length} фото
                </span>
              </div>
            )}
            {photoChanges.removed && photoChanges.removed.length > 0 && (
              <div className="flex items-center gap-2">
                <FaMinus className="text-red-500" />
                <span className="text-red-700 dark:text-red-300">
                  Удалено: {photoChanges.removed.length} фото
                </span>
              </div>
            )}
            {photoChanges.reordered && (
              <div className="flex items-center gap-2">
                <FaRedo className="text-blue-500" />
                <span className="text-blue-700 dark:text-blue-300">
                  Изменен порядок фотографий
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div 
        ref={photoContainerRef}
        className="relative w-full aspect-[4/5] overflow-hidden rounded-xl border border-accent bg-[color-mix(in_oklab,var(--color-bg)92%,var(--color-accent)8%)] cursor-pointer"
        onClick={handlePhotoClick}
      >
        {photos?.[currentPhotoIndex] ? (
          <>
            {/* Показываем загрузку только первые 2 секунды */}
            {currentImageState.loading && !currentImageState.loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] z-10">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-sm text-muted">Загрузка...</div>
                </div>
              </div>
            )}
            
            {/* Изображение показываем всегда, если есть URL */}
            <img 
              src={photos[currentPhotoIndex]} 
              alt={title} 
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                currentImageState.loaded || !currentImageState.loading ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => handleImageLoad(currentPhotoIndex)}
              onError={() => handleImageError(currentPhotoIndex)}
            />
          </>
        ) : (
          <div className="text-muted flex items-center justify-center h-full">
            {currentImageState.error ? (
              <div className="text-center">
                <div className="text-sm mb-2">
                  {allPhotosFailed ? 'Все изображения недоступны' : 'Ошибка загрузки'}
                </div>
                {!allPhotosFailed && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageStates(prev => prev.map((state, i) => 
                        i === currentPhotoIndex ? { ...state, loading: true, error: false, loaded: false } : state
                      ))
                    }}
                    className="text-xs px-2 py-1 bg-accent text-white rounded hover:bg-accent/80 transition-colors"
                  >
                    Повторить
                  </button>
                )}
                {allPhotosFailed && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      // Перезагружаем все изображения
                      setImageStates(photos.map(() => ({ loading: true, error: false, loaded: false })))
                      setCurrentPhotoIndex(0)
                    }}
                    className="text-xs px-2 py-1 bg-accent text-white rounded hover:bg-accent/80 transition-colors"
                  >
                    Перезагрузить все
                  </button>
                )}
              </div>
            ) : (
              'Нет фото'
            )}
          </div>
        )}
        
        {/* Индикатор текущего фото */}
        {Array.isArray(photos) && photos.length > 1 && hasValidPhotos && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_, index) => {
              const state = imageStates[index]
              if (state?.error) return null // Не показываем индикатор для битых фото
              
              return (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentPhotoIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              )
            }).filter((el): el is JSX.Element => el !== null)}
          </div>
        )}
        
        {/* Теги с информацией поверх изображения снизу */}
        <div className="absolute bottom-8 left-2 right-2 flex flex-wrap gap-2">
          {gender && (
            <div className="bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <FaVenusMars className="w-3 h-3" />
              {gender}
            </div>
          )}
          
          {(heightCm || weightKg) && (
            <div className="bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <FaRuler className="w-3 h-3" />
              {[formatHeight(heightCm), formatWeight(weightKg)].filter(Boolean).join(', ')}
            </div>
          )}
          
          {wandSizeCm && (
            <div className="bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <FaMagic className="w-3 h-3" />
              {formatWandSize(wandSizeCm)}
            </div>
          )}
        </div>
        
        {/* Подсказка о листании */}
        {Array.isArray(photos) && photos.length > 1 && hasValidPhotos && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
            {currentPhotoIndex + 1} / {photos.filter((_, index) => !imageStates[index]?.error).length}
          </div>
        )}
      </div>
      
      <div className="mt-3">
        <div className="text-lg font-semibold">
          {isNewProfile ? (
            <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
              {title || 'Без имени'}
            </span>
          ) : (
            title || 'Без имени'
          )}
        </div>
        
        {/* Основная информация */}
        <div className="mt-2 space-y-1">
          {city && (
            <div className="text-sm text-muted">
              📍 {renderField('city', city, changes.city?.old)}
            </div>
          )}
        </div>
        
        {/* Описание */}
        {bio && (
          <div className="text-sm mt-3 p-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] rounded-lg">
            {renderField('description', bio, changes.description?.old)}
          </div>
        )}
      </div>
      
      {/* Кнопки модерации */}
      <div className="mt-4 flex gap-2">
        <button 
          className="btn btn-primary flex-1 flex items-center justify-center gap-2" 
          onClick={() => onApprove(data.id)}
        >
          <FaCheck className="w-4 h-4" />
        </button>
        
        <button 
          className="btn btn-warning flex-1 flex items-center justify-center gap-2" 
          onClick={() => openActionModal('DISCREPANT')}
        >
          <FaExclamationTriangle className="w-4 h-4" />
        </button>
        
        <button 
          className="btn btn-error flex-1 flex items-center justify-center gap-2" 
          onClick={() => openActionModal('REJECT')}
        >
          <FaBan className="w-4 h-4" />
        </button>
      </div>

      {/* Модальное окно для действий */}
      {showActionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg)] rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-fg)]">
                {actionType === 'REJECT' ? 'Отклонить анкету' : 'Отметить для переделки'}
              </h3>
              <button
                onClick={() => setShowActionModal(false)}
                className="text-[var(--color-fg-secondary)] hover:text-[var(--color-fg)]"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Выбор проблемных параметров для DISCREPANT */}
              {actionType === 'DISCREPANT' && (
                <div>
                  <label className="block text-sm text-[var(--color-fg-secondary)] mb-2">
                    Выберите проблемные параметры:
                  </label>
                  <div className="space-y-2">
                    {[
                      { key: 'displayName', label: 'Имя' },
                      { key: 'age', label: 'Возраст' },
                      { key: 'city', label: 'Город' },
                      { key: 'bio', label: 'Описание' },
                      { key: 'heightCm', label: 'Рост' },
                      { key: 'weightKg', label: 'Вес' },
                      { key: 'wandSizeCm', label: 'Размер палочки' },
                      { key: 'gender', label: 'Пол' },
                      { key: 'photos', label: 'Фотографии' }
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIssues.includes(key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIssues([...selectedIssues, key])
                            } else {
                              setSelectedIssues(selectedIssues.filter(k => k !== key))
                            }
                          }}
                          className="rounded border-[var(--color-border)]"
                        />
                        <span className="text-sm text-[var(--color-fg)]">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm text-[var(--color-fg-secondary)] mb-2">
                  Причина {actionType === 'DISCREPANT' ? '(описание проблемы)' : '(обязательно)'}
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={actionType === 'DISCREPANT' ? 'Опишите, какие данные нужно исправить...' : 'Укажите причину отклонения...'}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg)] resize-none"
                  rows={3}
                  required={actionType === 'REJECT'}
                />
              </div>
              
              {actionType === 'REJECT' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="banUser"
                    checked={banUser}
                    onChange={(e) => setBanUser(e.target.checked)}
                    className="rounded border-[var(--color-border)]"
                  />
                  <label htmlFor="banUser" className="text-sm text-[var(--color-fg)]">
                    Заблокировать пользователя
                  </label>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-fg)] hover:opacity-80 transition-opacity"
                >
                  Отмена
                </button>
                <button
                  onClick={executeAction}
                  disabled={actionType === 'REJECT' && !actionReason.trim()}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors ${
                    actionType === 'REJECT' ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {actionType === 'REJECT' ? 'Отклонить' : 'Отметить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
