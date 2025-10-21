import type { JSX } from 'react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { z } from 'zod'
import { FaVenusMars, FaRuler, FaMagic, FaHeart, FaTimes, FaEdit, FaWeight, FaFlag } from 'react-icons/fa'

import { patchMyProfile, GenderEnum, reportProfile, ReportReasonEnum } from '@/shared/api/profile'
import { uploadImage } from '@/shared/api/cdn'
import { compressImageToJpeg, cfImage } from '@/shared/lib/image'
import BottomSheet from '@/shared/ui/BottomSheet/BottomSheet'
import { toast } from 'sonner'

// DnD Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const ORIENTATION_RU: Record<string, string> = {
  GAY: 'Гей',
  LESBIAN: 'Лесби',
  BISEXUAL: 'Би',
  PANSEXUAL: 'Пан',
  QUEER: 'Квир',
  ASEXUAL: 'Асексуал',
}

// Компонент для сортируемого элемента фотографии
interface SortablePhotoItemProps {
  id: string
  photo: string
  index: number
  isUploading: boolean
  onReplace: (file: File) => void
}

function SortablePhotoItem({ id, photo, index, isUploading, onReplace }: SortablePhotoItemProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: 'color-mix(in oklab, var(--color-bg) 92%, var(--color-accent) 8%)',
    cursor: photo ? 'grab' : 'pointer'
  }

  return (
    <label className="block">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onReplace(file)
        }}
      />
      <div
        ref={setNodeRef}
        className={`h-24 w-20 rounded-lg border-2 border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] flex items-center justify-center overflow-hidden cursor-pointer hover:border-[color-mix(in_oklab,var(--color-accent)40%,transparent)] transition-all duration-200 relative group ${
          isDragging ? 'scale-105 shadow-lg' : ''
        }`}
        style={style}
        {...(photo ? { ...attributes, ...listeners } : {})}
      >
        {isUploading ? (
          <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)50%,var(--color-muted)50%)] animate-pulse">
            ...
          </div>
        ) : photo ? (
          <>
            <img src={cfImage(photo, { width: 480, quality: 85, format: 'auto' })} alt={`Фото ${index + 1}`} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
                Заменить
              </div>
            </div>
            {/* Drag handle */}
            <div className="absolute top-1 right-1 w-4 h-4 rounded bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-2 h-2 bg-white/60 rounded-full"></div>
            </div>
          </>
        ) : (
          <span className="text-2xl text-[var(--color-accent)]">+</span>
        )}
      </div>
    </label>
  )
}

export const ProfileCardSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().nullable(),
  age: z.number().int().min(1).max(120).nullable(),
  city: z.string().nullable(),
  // Принимаем как полные URL, так и Cloudflare image_id — cfImage соберёт финальный URL
  photos: z.array(z.string().min(1)).min(0),
  bio: z.string().nullable(),
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  weightKg: z.number().int().min(20).max(400).nullable().optional(),
  wandSizeCm: z.number().int().min(1).max(100).nullable().optional(),
  gender: GenderEnum.nullable().optional(),
})
export type ProfileCardData = z.infer<typeof ProfileCardSchema>

interface Props {
  data: ProfileCardData
  onLike: () => void
  onDislike: () => void
  isEditable?: boolean
  onProfileUpdate?: (updatedData: ProfileCardData) => void
  showActions?: boolean
}

interface ImageState {
  loading: boolean
  error: boolean
  loaded: boolean
}

interface SwipeState {
  startX: number
  currentX: number
  isDragging: boolean
}

export default function ProfileCard({ data, onLike, onDislike, isEditable = false, onProfileUpdate, showActions = true }: Props): JSX.Element {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [imageStates, setImageStates] = useState<ImageState[]>([])
  const [showAllTags, setShowAllTags] = useState(false)
  const [tagsOverflow, setTagsOverflow] = useState(false)
  const [showFullBio, setShowFullBio] = useState(false)
  const [bioOverflow, setBioOverflow] = useState(false)
  
  // Состояния для редактирования
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [photoUploading, setPhotoUploading] = useState<boolean[]>([false, false, false])
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false)
  
  // Состояния для репорта
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReasonEnum | null>(null)
  const [reportDescription, setReportDescription] = useState('')
  const [isReporting, setIsReporting] = useState(false)
  const [isReportModalVisible, setIsReportModalVisible] = useState(false)
  
  // Управление видимостью BottomSheet для анимации исчезновения
  useEffect(() => {
    if (editingField) {
      setIsBottomSheetVisible(true)
    } else {
      // Добавляем задержку для завершения анимации исчезновения
      const timer = setTimeout(() => {
        setIsBottomSheetVisible(false)
      }, 300) // 300ms - длительность анимации BottomSheet
      return () => clearTimeout(timer)
    }
  }, [editingField])

  // Управление анимацией модального окна репорта
  useEffect(() => {
    if (showReportModal) {
      setIsReportModalVisible(true)
    } else {
      // Добавляем задержку для завершения анимации исчезновения
      const timer = setTimeout(() => {
        setIsReportModalVisible(false)
      }, 200) // 200ms - длительность анимации
      return () => clearTimeout(timer)
    }
  }, [showReportModal])
  
  // DnD Kit сенсоры
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    currentX: 0,
    isDragging: false
  })
  const photoContainerRef = useRef<HTMLDivElement>(null)
  const tagsRef = useRef<HTMLDivElement>(null)
  const bioRef = useRef<HTMLDivElement>(null)
  const title = [data.displayName, data.age ? String(data.age) : null].filter(Boolean).join(', ')
  
  // Валидация данных профиля
  useEffect(() => {
    if (!data || !data.userId) {
      console.error('Invalid profile data:', data)
      return
    }
    
    if (!Array.isArray(data.photos)) {
      console.error('Photos should be an array:', data.photos)
      return
    }
    
    // Проверяем на дублирование изображений
    const uniquePhotos = [...new Set(data.photos.filter(Boolean))]
    if (uniquePhotos.length !== data.photos.filter(Boolean).length) {
      console.warn('Duplicate photos detected in profile:', data.userId)
    }
    
    // Валидация userId
    if (typeof data.userId !== 'string' || data.userId.trim() === '') {
      console.error('Invalid userId:', data.userId)
      return
    }
    
    console.log('Profile data loaded:', { 
      userId: data.userId, 
      photosCount: data.photos.length, 
      uniquePhotosCount: uniquePhotos.length,
      photos: data.photos,
      displayName: data.displayName,
      bio: data.bio,
      city: data.city,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      wandSizeCm: data.wandSizeCm,
      gender: data.gender,
      age: data.age
    })
  }, [data])

  // Инициализируем состояния для всех изображений
  useEffect(() => {
    setImageStates(data.photos.map(() => ({ loading: true, error: false, loaded: false })))
    
    // Устанавливаем timeout для каждого изображения (5 секунд)
    const timeouts: number[] = []
    data.photos.forEach((_, index) => {
      const timeout = window.setTimeout(() => {
        setImageStates(prev => prev.map((state, i) => 
          i === index && state.loading ? { ...state, loading: false, loaded: true, error: false } : state
        ))
        console.log(`Image ${index} auto-marked as loaded after 5 seconds timeout`)
      }, 5000) // 5 секунд timeout - считаем что изображение загрузилось
      timeouts.push(timeout)
    })
    
    // Дополнительный timeout для скрытия индикатора загрузки через 2 секунды
    const hideLoadingTimeout = window.setTimeout(() => {
      setImageStates(prev => prev.map(state => ({ ...state, loading: false })))
      console.log('Hiding loading indicators after 2 seconds')
    }, 2000)
    timeouts.push(hideLoadingTimeout)
    
    // Принудительно показываем изображения через 3 секунды
    const showImagesTimeout = window.setTimeout(() => {
      setImageStates(prev => prev.map(state => ({ ...state, loading: false, loaded: true })))
      console.log('Forcing images to be visible after 3 seconds')
    }, 3000)
    timeouts.push(showImagesTimeout)
    
    return () => {
      timeouts.forEach(timeout => window.clearTimeout(timeout))
    }
  }, [data.photos])

  // Проверяем корректность URL изображений
  useEffect(() => {
    console.log('Checking photo URLs:', data.photos)
    data.photos.forEach((photoUrl, index) => {
      console.log(`Checking photo ${index}:`, photoUrl)
      if (!photoUrl || !isValidImageUrl(photoUrl)) {
        console.warn(`Invalid image URL at index ${index}:`, photoUrl)
        setImageStates(prev => prev.map((state, i) => 
          i === index ? { ...state, loading: false, error: true, loaded: false } : state
        ))
      } else {
        console.log(`Valid image URL at index ${index}:`, photoUrl)
      }
    })
  }, [data.photos])

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
  
  const nextPhoto = useCallback(() => {
    if (data.photos.length > 1) {
      const nextIndex = findNextValidPhotoIndex(currentPhotoIndex)
      if (nextIndex !== -1) {
        setCurrentPhotoIndex(nextIndex)
      }
    }
  }, [data.photos.length, currentPhotoIndex])
  
  const prevPhoto = useCallback(() => {
    if (data.photos.length > 1) {
      const prevIndex = findPrevValidPhotoIndex(currentPhotoIndex)
      if (prevIndex !== -1) {
        setCurrentPhotoIndex(prevIndex)
      }
    }
  }, [data.photos.length, currentPhotoIndex])

  const handlePhotoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (data.photos.length <= 1 || swipeState.isDragging) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const halfWidth = rect.width / 2
    
    if (clickX < halfWidth) {
      prevPhoto()
    } else {
      nextPhoto()
    }
  }

  // Обработчики для свайп-жестов
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (data.photos.length <= 1) return
    
    const touch = e.touches[0]
    if (!touch) return
    
    setSwipeState(prev => ({
      ...prev,
      startX: touch.clientX,
      currentX: touch.clientX,
      isDragging: true
    }))
  }, [data.photos.length])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeState.isDragging || data.photos.length <= 1) return
    
    const touch = e.touches[0]
    if (!touch) return
    
    setSwipeState(prev => ({
      ...prev,
      currentX: touch.clientX
    }))
  }, [swipeState.isDragging, data.photos.length])

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeState.isDragging || data.photos.length <= 1) return
    
    const deltaX = swipeState.currentX - swipeState.startX
    const threshold = 80 // Минимальное расстояние для срабатывания свайпа
    const velocity = Math.abs(deltaX) / 300 // Простая оценка скорости
    
    // Срабатывает если свайп достаточно далеко ИЛИ достаточно быстрый
    if (Math.abs(deltaX) > threshold || velocity > 0.3) {
      if (deltaX > 0) {
        prevPhoto()
      } else {
        nextPhoto()
      }
    }
    
    setSwipeState(prev => ({
      ...prev,
      isDragging: false,
      startX: 0,
      currentX: 0
    }))
  }, [swipeState.isDragging, swipeState.currentX, swipeState.startX, data.photos.length, prevPhoto, nextPhoto])

  // Обработчики для мыши (для десктопа)
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (data.photos.length <= 1) return
    
    setSwipeState(prev => ({
      ...prev,
      startX: e.clientX,
      currentX: e.clientX,
      isDragging: true
    }))
  }, [data.photos.length])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!swipeState.isDragging || data.photos.length <= 1) return
    
    setSwipeState(prev => ({
      ...prev,
      currentX: e.clientX
    }))
  }, [swipeState.isDragging, data.photos.length])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!swipeState.isDragging || data.photos.length <= 1) return
    
    const deltaX = swipeState.currentX - swipeState.startX
    const threshold = 80
    const velocity = Math.abs(deltaX) / 300
    
    if (Math.abs(deltaX) > threshold || velocity > 0.3) {
      if (deltaX > 0) {
        prevPhoto()
      } else {
        nextPhoto()
      }
    }
    
    setSwipeState(prev => ({
      ...prev,
      isDragging: false,
      startX: 0,
      currentX: 0
    }))
  }, [swipeState.isDragging, swipeState.currentX, swipeState.startX, data.photos.length, prevPhoto, nextPhoto])

  const handleImageLoad = (index: number) => {
    console.log(`Image ${index} loaded successfully:`, data.photos[index])
    
    // Получаем элемент img из DOM для проверки размеров
    const imgElement = document.querySelector(`img[src="${data.photos[index]}"]`) as HTMLImageElement
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
        
        // Если это текущее изображение и оно загрузилось, убираем индикатор загрузки
        if (index === currentPhotoIndex) {
          console.log(`Current image ${index} loaded successfully`)
        }
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
    console.error(`Image ${index} failed to load:`, data.photos[index])
    
    // Определяем тип ошибки
    const photoUrl = data.photos[index]
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
    const totalPhotos = data.photos.length
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
    const totalPhotos = data.photos.length
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

  // Проверка переполнения тегов
  useEffect(() => {
    const checkOverflow = () => {
      if (tagsRef.current) {
        const container = tagsRef.current
        const children = Array.from(container.children) as HTMLElement[]
        
        if (children.length > 0) {
          const containerWidth = container.offsetWidth
          let totalWidth = 0
          let visibleCount = 0
          
          for (let i = 0; i < children.length; i++) {
            const child = children[i]
            if (child) {
              totalWidth += child.offsetWidth + 8 // 8px gap
              if (totalWidth <= containerWidth) {
                visibleCount++
              } else {
                break
              }
            }
          }
          
          setTagsOverflow(visibleCount < children.length)
        }
      }
    }

    // Проверяем после рендера
    const timeout = setTimeout(checkOverflow, 100)
    window.addEventListener('resize', checkOverflow)
    
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', checkOverflow)
    }
  }, [data.city, data.gender, data.heightCm, data.weightKg, data.wandSizeCm])

  // Проверка переполнения описания (2 строки)
  useEffect(() => {
    if (!data.bio) return

    const checkBioOverflow = () => {
      if (bioRef.current) {
        const container = bioRef.current
        const computedStyle = window.getComputedStyle(container)
        
        // Создаем временный элемент для измерения высоты
        const tempDiv = document.createElement('div')
        tempDiv.style.cssText = `
          position: absolute;
          visibility: hidden;
          width: ${container.offsetWidth}px;
          font-family: ${computedStyle.fontFamily};
          font-size: ${computedStyle.fontSize};
          font-weight: ${computedStyle.fontWeight};
          line-height: ${computedStyle.lineHeight};
          letter-spacing: ${computedStyle.letterSpacing};
          word-spacing: ${computedStyle.wordSpacing};
          white-space: normal;
          word-wrap: break-word;
          overflow-wrap: break-word;
        `
        tempDiv.textContent = data.bio
        
        document.body.appendChild(tempDiv)
        
        // Вычисляем высоту одной строки
        const singleLineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2
        const maxHeight = singleLineHeight * 2 // 2 строки
        const actualHeight = tempDiv.offsetHeight
        
        document.body.removeChild(tempDiv)
        
        setBioOverflow(actualHeight > maxHeight)
      }
    }

    // Проверяем после рендера
    const timeout = setTimeout(checkBioOverflow, 100)
    window.addEventListener('resize', checkBioOverflow)
    
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', checkBioOverflow)
    }
  }, [data.bio])

  // Обработка переключения на следующее изображение при ошибках
  useEffect(() => {
    const currentState = imageStates[currentPhotoIndex]
    if (currentState?.error && data.photos.length > 1) {
      const nextValidIndex = findNextValidPhotoIndex(currentPhotoIndex)
      if (nextValidIndex !== -1 && nextValidIndex !== currentPhotoIndex) {
        console.log(`Auto-switching from failed image ${currentPhotoIndex} to ${nextValidIndex}`)
        setCurrentPhotoIndex(nextValidIndex)
      }
    }
  }, [imageStates, data.photos.length]) // Убираем currentPhotoIndex из зависимостей

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


  const currentImageState = imageStates[currentPhotoIndex] || { loading: true, error: false, loaded: false }
  const hasValidPhotos = data.photos.length > 0 && data.photos.some((_, index) => !imageStates[index]?.error)
  const allPhotosFailed = data.photos.length > 0 && data.photos.every((_, index) => imageStates[index]?.error)
  
  console.log('Photo states:', {
    photosCount: data.photos.length,
    imageStates: imageStates,
    currentPhotoIndex,
    hasValidPhotos,
    allPhotosFailed
  })

  const containerWidth = photoContainerRef.current?.clientWidth || 1
  const dragPercent = swipeState.isDragging
    ? ((swipeState.currentX - swipeState.startX) / containerWidth) * 100
    : 0

  // Если все изображения не загрузились, показываем сообщение об ошибке
  useEffect(() => {
    if (allPhotosFailed) {
      console.error('All photos failed to load:', data.photos)
    }
  }, [allPhotosFailed, data.photos])

  // Функции для редактирования
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      displayName: 'Имя',
      city: 'Город',
      bio: 'О себе',
      gender: 'Ориентацию',
      heightCm: 'Рост',
      weightKg: 'Вес',
      wandSizeCm: 'Размер',
      photos: 'Фотографии'
    }
    return labels[field] || field
  }

  const handleFieldClick = (field: string, currentValue: any) => {
    if (!isEditable) return
    
    setEditingField(field)
    if (field === 'photos') {
      setEditValue(data.photos.join('\n'))
    } else if (field === 'gender') {
      setEditValue(currentValue || '')
    } else {
      setEditValue(currentValue || '')
    }
  }

  const handleSave = async () => {
    if (!editingField || !onProfileUpdate) return
    
    setIsSubmitting(true)
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      let updateData: any = { initData }
      
      if (editingField === 'photos') {
        const photos = editValue.split('\n').filter(Boolean)
        if (photos.length < 3) {
          toast.error('Нужно загрузить минимум 3 фотографии')
          return
        }
        updateData.photos = photos
      } else if (editingField === 'gender') {
        updateData.gender = editValue || null
      } else if (editingField === 'heightCm' || editingField === 'weightKg' || editingField === 'wandSizeCm') {
        const numValue = editValue ? parseInt(editValue) : null
        if (editingField === 'heightCm') updateData.heightCm = numValue
        else if (editingField === 'weightKg') updateData.weightKg = numValue
        else if (editingField === 'wandSizeCm') updateData.wandSizeCm = numValue
      } else if (editingField === 'displayName') {
        updateData.displayName = editValue || null
      } else if (editingField === 'city') {
        updateData.city = editValue || null
      } else if (editingField === 'bio') {
        updateData.bio = editValue || null
      }
      
      const resp = await patchMyProfile(updateData)
      if (resp.ok) {
        // Обновляем локальное состояние
        const updatedData = { ...data }
        if (editingField === 'photos') {
          updatedData.photos = editValue.split('\n').filter(Boolean)
        } else if (editingField === 'gender') {
          updatedData.gender = editValue as any
        } else if (editingField === 'heightCm' || editingField === 'weightKg' || editingField === 'wandSizeCm') {
          const numValue = editValue ? parseInt(editValue) : null
          if (editingField === 'heightCm') updatedData.heightCm = numValue
          else if (editingField === 'weightKg') updatedData.weightKg = numValue
          else if (editingField === 'wandSizeCm') updatedData.wandSizeCm = numValue
        } else if (editingField === 'displayName') {
          updatedData.displayName = editValue
        } else if (editingField === 'city') {
          updatedData.city = editValue
        } else if (editingField === 'bio') {
          updatedData.bio = editValue
        }
        
        onProfileUpdate(updatedData)
        toast.success('Изменения сохранены!')
        setEditingField(null)
      } else {
        toast.error(resp.message || 'Ошибка сохранения')
      }
    } catch (error) {
      toast.error('Ошибка сохранения')
      console.error('Save error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    
    const photos = editValue.split('\n').filter(Boolean)
    const oldIndex = photos.indexOf(active.id as string)
    const newIndex = photos.indexOf(over.id as string)
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newPhotos = arrayMove(photos, oldIndex, newIndex)
      setEditValue(newPhotos.join('\n'))
    }
  }

  // Обработчики для репорта
  const handleReportClick = () => {
    setShowReportModal(true)
    setReportReason(null)
    setReportDescription('')
  }

  const handleReportSubmit = async () => {
    if (!reportReason) {
      toast.error('Выберите причину репорта')
      return
    }

    setIsReporting(true)
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const response = await reportProfile({
        initData,
        reportedUserId: data.userId,
        reason: reportReason,
        description: reportDescription.trim() || undefined
      })

      if (response.ok) {
        toast.success('Репорт отправлен успешно')
        setShowReportModal(false)
        setReportReason(null)
        setReportDescription('')
      } else {
        toast.error(response.message || 'Ошибка отправки репорта')
      }
    } catch (error) {
      toast.error('Ошибка отправки репорта')
      console.error('Report error:', error)
    } finally {
      setIsReporting(false)
    }
  }

  const handleReportCancel = () => {
    setShowReportModal(false)
    setReportReason(null)
    setReportDescription('')
  }

  return (
    <div 
      ref={photoContainerRef}
      className={`relative w-full h-full overflow-hidden select-none rounded-xl border-2 border-accent slide-in ${
        editingField ? 'pointer-events-none' : 'cursor-pointer'
      }`}
      style={{ 
        height: '100%',
        minHeight: 'auto',
        maxHeight: '100%',
        '--bottom-nav-height': '80px'
      } as React.CSSProperties}
      onClick={editingField ? undefined : handlePhotoClick}
      onTouchStart={editingField ? undefined : (isEditable ? undefined : handleTouchStart)}
      onTouchMove={editingField ? undefined : (isEditable ? undefined : handleTouchMove)}
      onTouchEnd={editingField ? undefined : (isEditable ? undefined : handleTouchEnd)}
      onMouseDown={editingField ? undefined : (isEditable ? undefined : handleMouseDown)}
      onMouseMove={editingField ? undefined : (isEditable ? undefined : handleMouseMove)}
      onMouseUp={editingField ? undefined : (isEditable ? undefined : handleMouseUp)}
      onMouseLeave={() => !isEditable && !editingField && setSwipeState(prev => ({ ...prev, isDragging: false }))}
    >
        {data.photos?.[currentPhotoIndex] ? (
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
            
            {/* Простой горизонтальный слайдер как в галерее */}
            <div className="w-full h-full overflow-hidden">
              <div
                className="w-full h-full flex"
                style={{
                  transform: `translateX(calc(${(-currentPhotoIndex * 100).toFixed(4)}% + ${dragPercent.toFixed(4)}%))`,
                  transition: swipeState.isDragging ? 'none' : 'transform 0.3s ease',
                  willChange: swipeState.isDragging ? 'transform' : 'auto'
                }}
              >
                {data.photos.map((photoUrl, index) => (
                  <div key={photoUrl + index} className="w-full h-full flex-shrink-0 relative">
                    <img
                      src={cfImage(photoUrl, { width: 1080, quality: 85, format: 'auto' })}
                      alt={title}
                      className={`w-full h-full object-cover transition-opacity duration-300 ${
                        imageStates[index]?.loaded || !imageStates[index]?.loading ? 'opacity-100' : 'opacity-0'
                      }`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center'
                      }}
                      onLoad={() => handleImageLoad(index)}
                      onError={() => handleImageError(index)}
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
            </div>
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
                      setImageStates(data.photos.map(() => ({ loading: true, error: false, loaded: false })))
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
        
        {/* Новый оверлей поверх изображения */}
        {/* Градиент подложка для читаемости */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10"></div>

        {/* Верхняя панель: счетчик фото и кнопка редактирования */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {data.photos.length > 1 && hasValidPhotos && (
            <div className="px-3 py-1 rounded-full text-white text-xs bg-black/60 backdrop-blur-sm border border-white/20">
              {currentPhotoIndex + 1} / {data.photos.filter((_, index) => !imageStates[index]?.error).length}
            </div>
          )}
        </div>

        {/* Кнопка редактирования фотографий в правом верхнем углу */}
        {isEditable && (
          <button
            className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-white bg-black/60 backdrop-blur-sm border border-white/20 hover:bg-black/80 transition-colors z-20"
            onClick={() => handleFieldClick('photos', data.photos)}
          >
            <FaEdit className="w-4 h-4" />
          </button>
        )}

        {/* Кнопка репорта в правом верхнем углу */}
        {!isEditable && (
          <button
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white bg-white/15 hover:bg-white/25 border border-white/30 transition-all duration-200 hover:scale-110 backdrop-blur-sm z-20"
            onClick={handleReportClick}
            title="Пожаловаться на профиль"
          >
            <FaFlag className="w-3 h-3" />
          </button>
        )}

        {/* Нижний стек: имя, теги, био, кнопки */}
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 pt-2 max-h-[60%] overflow-hidden">
          {/* Градиент для обрезки контента */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none"></div>
          
          {/* Контент */}
          <div className="relative z-10">
          {/* Имя и возраст */}
          <div 
            className={`text-white text-2xl font-bold drop-shadow-2xl ${isEditable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={() => isEditable && handleFieldClick('displayName', data.displayName)}
          >
            {title || 'Без имени'}
          </div>

          {/* Теги */}
          <div ref={tagsRef} className="mt-3 flex flex-wrap gap-2 max-h-16 overflow-hidden">
            {(() => {
              const allTags = []
              
              if (data.city) {
                allTags.push(
                  <span 
                    key="city" 
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 ${isEditable ? 'cursor-pointer hover:bg-white/20 transition-colors' : ''}`}
                    onClick={() => isEditable && handleFieldClick('city', data.city)}
                  >
                    📍 {data.city}
                  </span>
                )
              }
              
              if (data.gender) {
                allTags.push(
                  <span 
                    key="gender" 
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 ${isEditable ? 'cursor-pointer hover:bg-white/20 transition-colors' : ''}`}
                    onClick={() => isEditable && handleFieldClick('gender', data.gender)}
                  >
                    <FaVenusMars className="w-3 h-3" />
                    {data.gender}
                  </span>
                )
              }
              
              if (data.heightCm) {
                allTags.push(
                  <span 
                    key="height" 
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 ${isEditable ? 'cursor-pointer hover:bg-white/20 transition-colors' : ''}`}
                    onClick={() => isEditable && handleFieldClick('heightCm', data.heightCm)}
                  >
                    <FaRuler className="w-3 h-3" />
                    {formatHeight(data.heightCm)}
                  </span>
                )
              }
              
              if (data.weightKg) {
                allTags.push(
                  <span 
                    key="weight" 
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 ${isEditable ? 'cursor-pointer hover:bg-white/20 transition-colors' : ''}`}
                    onClick={() => isEditable && handleFieldClick('weightKg', data.weightKg)}
                  >
                    <FaWeight className="w-3 h-3" />
                    {formatWeight(data.weightKg)}
                  </span>
                )
              }
              
              if (data.wandSizeCm) {
                allTags.push(
                  <span 
                    key="wand" 
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 ${isEditable ? 'cursor-pointer hover:bg-white/20 transition-colors' : ''}`}
                    onClick={() => isEditable && handleFieldClick('wandSizeCm', data.wandSizeCm)}
                  >
                    <FaMagic className="w-3 h-3" />
                    {formatWandSize(data.wandSizeCm)}
                  </span>
                )
              }
              
              if (showAllTags || !tagsOverflow) {
                return allTags
              } else {
                return [
                  ...allTags.slice(0, 2),
                  <button
                    key="more"
                    onClick={() => setShowAllTags(true)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors"
                  >
                    ...
                  </button>
                ]
              }
            })()}
          </div>

          {/* Описание */}
          {data.bio && (
            <div 
              ref={bioRef} 
              className={`mt-3 text-white text-sm drop-shadow-xl max-h-20 overflow-hidden ${isEditable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={() => isEditable && handleFieldClick('bio', data.bio)}
            >
              {showFullBio || !bioOverflow ? (
                data.bio
              ) : (
                <div 
                  className="overflow-hidden relative"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: '1.4',
                    maxHeight: '2.8em' // 2 строки * 1.4 line-height
                  }}
                >
                  {data.bio}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowFullBio(true)
                    }}
                    className="absolute bottom-0 right-0 bg-gradient-to-l from-black/80 to-transparent pl-2 text-white/80 hover:text-white underline cursor-pointer text-xs"
                    style={{ marginTop: '-0.2em' }}
                  >
                    ...
                  </button>
                </div>
              )}
            </div>
          )}

        {/* Кнопки действий */}
        {showActions && !isEditable && (
            <div className="mt-5 mb-1 flex items-center justify-center gap-8">
              <button
                className="w-14 h-14 rounded-full flex items-center justify-center text-white bg-white/15 hover:bg-white/25 border border-white/30 transition-all duration-200 hover:scale-110 backdrop-blur-sm"
                onClick={onDislike}
              >
                <FaTimes className="w-6 h-6" />
              </button>
              <button
                className="w-14 h-14 rounded-full flex items-center justify-center text-white bg-white/15 hover:bg-white/25 border border-white/30 transition-all duration-200 hover:scale-110 backdrop-blur-sm"
                onClick={onLike}
              >
                <FaHeart className="w-6 h-6" />
              </button>
            </div>
          )}
          </div>
        </div>

        {/* BottomSheet для редактирования */}
        {isEditable && (editingField || isBottomSheetVisible) && (
          <>
            {/* Оверлей для блокировки взаимодействия с фоном */}
            <div className="absolute inset-0 bg-black/20 z-30 pointer-events-auto" />
            <BottomSheet
              isOpen={editingField !== null}
              title={editingField ? `Редактировать ${getFieldLabel(editingField)}` : 'Редактирование'}
              onClose={() => setEditingField(null)}
              footer={
                editingField ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingField(null)}
                      className="flex-1 px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] border border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)90%,var(--color-accent)10%)] transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-accent)90%,black)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                ) : undefined
              }
            >
            {editingField === 'photos' ? (
              <div className="space-y-4">
                <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
                  Управление фотографиями. Нажмите на фото чтобы заменить, удерживайте чтобы изменить порядок.
                </div>

                {/* Фотографии с возможностью замены и перетаскивания */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-[var(--color-fg)]">Ваши фотографии (3 фото):</div>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={editValue.split('\n').filter(Boolean)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="flex gap-3 justify-center">
                        {(() => {
                          const photos = editValue.split('\n').filter(Boolean)
                          // Дополняем до 3 фотографий пустыми строками
                          while (photos.length < 3) {
                            photos.push('')
                          }

                          return photos.slice(0, 3).map((photo, index) => (
                            <SortablePhotoItem
                              key={photo || `empty-${index}`}
                              id={photo || `empty-${index}`}
                              photo={photo}
                              index={index}
                              isUploading={photoUploading[index] || false}
                              onReplace={async (file) => {
                                setPhotoUploading(prev => prev.map((v, idx) => idx === index ? true : v))
                                try {
                                  let input: File | Blob = file
                                  try { 
                                    input = await compressImageToJpeg(file, 1080, 0.82) 
                                  } catch (compressError) {
                                    console.error('Image compression failed:', compressError)
                                    toast.error('Ошибка обработки изображения. Попробуйте другое фото.')
                                    return
                                  }
                                  const up = await uploadImage(input, { variant: 'profile' })
                                  if (!up.ok) throw new Error(up.message || 'Не удалось загрузить')

                                  // Заменяем фото по индексу
                                  const currentPhotos = editValue.split('\n').filter(Boolean)
                                  const newPhotos = [...currentPhotos]
                                  while (newPhotos.length < 3) {
                                    newPhotos.push('')
                                  }
                                  newPhotos[index] = up.url
                                  setEditValue(newPhotos.filter(Boolean).join('\n'))
                                  toast.success('Фото заменено!')
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Ошибка загрузки')
                                } finally {
                                  setPhotoUploading(prev => prev.map((v, idx) => idx === index ? false : v))
                                }
                              }}
                            />
                          ))
                        })()}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)50%,var(--color-muted)50%)] text-center">
                    Только ваши фото, рисунки или природа. Не принимаются NSFW, текст/буквы и т.п.
                  </div>
                </div>

              </div>
            ) : editingField === 'bio' ? (
              <div className="space-y-2">
                <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
                  Расскажите о себе (1-1200 символов)
                </div>
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full p-3 border border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] rounded-lg bg-[var(--color-bg)] text-[var(--color-fg)] resize-none"
                  rows={6}
                  placeholder="Расскажите о себе..."
                  maxLength={1200}
                />
                <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)50%,var(--color-muted)50%)] text-right">
                  {editValue.length}/1200
                </div>
              </div>
            ) : editingField === 'gender' ? (
              <div className="space-y-3">
                <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
                  Выберите ориентацию
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const currentGender = data.gender
                    let availableOptions = Object.keys(ORIENTATION_RU)
                    
                    // Фильтруем опции в зависимости от текущего пола
                    if (currentGender === 'GAY') {
                      availableOptions = ['GAY', 'BISEXUAL', 'PANSEXUAL', 'QUEER', 'ASEXUAL']
                    } else if (currentGender === 'LESBIAN') {
                      availableOptions = ['LESBIAN', 'BISEXUAL', 'PANSEXUAL', 'QUEER', 'ASEXUAL']
                    }
                    
                    return availableOptions.map((key) => (
                      <button
                        key={key}
                        onClick={() => setEditValue(key)}
                        className={`p-3 text-sm font-medium rounded-lg border transition-colors ${
                          editValue === key
                            ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                            : 'bg-[var(--color-bg)] text-[var(--color-fg)] border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] hover:border-[color-mix(in_oklab,var(--color-accent)40%,transparent)]'
                        }`}
                      >
                        {ORIENTATION_RU[key]}
                      </button>
                    ))
                  })()}
                </div>
              </div>
            ) : editingField === 'heightCm' || editingField === 'weightKg' || editingField === 'wandSizeCm' ? (
              <div className="space-y-4">
                <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
                  {editingField === 'heightCm' && 'Рост (130-220 см)'}
                  {editingField === 'weightKg' && 'Вес (30-150 кг)'}
                  {editingField === 'wandSizeCm' && 'Размер (3-30 см)'}
                </div>
                <div className="space-y-2">
                  <input
                    type="range"
                    min={editingField === 'heightCm' ? 130 : editingField === 'weightKg' ? 30 : 3}
                    max={editingField === 'heightCm' ? 220 : editingField === 'weightKg' ? 150 : 30}
                    value={editValue || ''}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="slider w-full"
                  />
                  <div className="text-center">
                    <span className="text-lg font-semibold text-[var(--color-fg)]">
                      {editValue || 'Не указано'}
                    </span>
                    <span className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)] ml-1">
                      {editingField === 'heightCm' ? 'см' : editingField === 'weightKg' ? 'кг' : 'см'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
                  {editingField === 'displayName' && 'Имя (2-32 символа)'}
                  {editingField === 'city' && 'Город (1-128 символов)'}
                </div>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full p-3 border border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] rounded-lg bg-[var(--color-bg)] text-[var(--color-fg)]"
                  placeholder={editingField === 'displayName' ? 'Введите имя' : 'Введите город'}
                  maxLength={editingField === 'displayName' ? 32 : 128}
                />
              </div>
            )}
            </BottomSheet>
          </>
        )}

        {/* Модальное окно для репорта */}
        {isReportModalVisible && (
          <>
            {/* Оверлей с анимацией */}
            <div 
              className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center px-4"
              style={{
                opacity: showReportModal ? 1 : 0,
                transition: 'opacity 200ms ease-in-out'
              }}
            >
              <div 
                className="bg-[var(--color-bg)] rounded-lg max-w-sm w-full border border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] shadow-lg"
                style={{
                  transform: showReportModal ? 'scale(1)' : 'scale(0.95)',
                  opacity: showReportModal ? 1 : 0,
                  transition: 'transform 200ms ease-in-out, opacity 200ms ease-in-out'
                }}
              >
                {/* Заголовок */}
                <div className="px-4 py-4 border-b border-[color-mix(in_oklab,var(--color-accent)15%,transparent)]">
                  <h3 className="text-lg font-semibold text-[var(--color-fg)]">Пожаловаться на профиль</h3>
                  <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)] mt-1">
                    Выберите причину жалобы
                  </p>
                </div>

                {/* Контент */}
                <div className="px-4 py-4 space-y-4 max-h-80 overflow-y-auto">
                  {/* Причины репорта */}
                  <div className="space-y-2">
                    {[
                      // Неподходящий контент
                      { value: 'INAPPROPRIATE_CONTENT', label: 'Неподобающий контент' },
                      { value: 'UNDERAGE', label: 'Провокационное или враждебное поведение' },
                      { value: 'COPYRIGHT_VIOLATION', label: 'Возрастные ограничения (13-19)' },
                      
                      // Поведение
                      { value: 'HARASSMENT', label: 'Домогательства и Харасмент' },
                      { value: 'VIOLENCE', label: 'Обман и Мошенничество' },
                      
                      // Спам и реклама
                      { value: 'SPAM', label: 'Флуд и спам' },
                      { value: 'FAKE_PROFILE', label: 'Реклама' },
                      
                      // Прочее
                      { value: 'OTHER', label: 'Другое' }
                    ].map((reason) => (
                      <label key={reason.value} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="reportReason"
                          value={reason.value}
                          checked={reportReason === reason.value}
                          onChange={(e) => setReportReason(e.target.value as ReportReasonEnum)}
                          className="w-4 h-4 text-[var(--color-accent)] border-[color-mix(in_oklab,var(--color-accent)30%,transparent)] focus:ring-[var(--color-accent)]"
                        />
                        <span className="text-sm text-[var(--color-fg)]">{reason.label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Дополнительное описание */}
                  <div className="space-y-2">
                    <label className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
                      Дополнительная информация (необязательно)
                    </label>
                    <textarea
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      placeholder="Опишите проблему подробнее..."
                      className="input resize-none"
                      rows={3}
                      maxLength={500}
                    />
                    <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)50%,var(--color-muted)50%)] text-right">
                      {reportDescription.length}/500
                    </div>
                  </div>
                </div>

                {/* Кнопки */}
                <div className="px-4 py-4 border-t border-[color-mix(in_oklab,var(--color-accent)15%,transparent)] flex gap-3">
                  <button
                    onClick={handleReportCancel}
                    className="btn flex-1"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleReportSubmit}
                    disabled={!reportReason || isReporting}
                    className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isReporting ? 'Отправка...' : 'Отправить'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

    </div>
  )
}


