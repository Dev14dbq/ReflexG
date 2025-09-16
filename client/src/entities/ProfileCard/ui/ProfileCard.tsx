import type { JSX } from 'react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { z } from 'zod'
import { FaVenusMars, FaRuler, FaMagic, FaHeart, FaTimes } from 'react-icons/fa'

export const ProfileCardSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().nullable(),
  age: z.number().int().min(14).max(120).nullable(),
  city: z.string().nullable(),
  photos: z.array(z.string().url()).min(0),
  bio: z.string().nullable(),
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  weightKg: z.number().int().min(20).max(400).nullable().optional(),
  wandSizeCm: z.number().int().min(1).max(100).nullable().optional(),
  gender: z.string().nullable().optional(),
})
export type ProfileCardData = z.infer<typeof ProfileCardSchema>

interface Props {
  data: ProfileCardData
  onLike: () => void
  onDislike: () => void
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

export default function ProfileCard({ data, onLike, onDislike }: Props): JSX.Element {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [imageStates, setImageStates] = useState<ImageState[]>([])
  const [showAllTags, setShowAllTags] = useState(false)
  const [tagsOverflow, setTagsOverflow] = useState(false)
  const [showFullBio, setShowFullBio] = useState(false)
  const [bioOverflow, setBioOverflow] = useState(false)
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

  return (
    <div 
      ref={photoContainerRef}
      className="relative w-full h-full overflow-hidden cursor-pointer select-none rounded-xl border-2 border-accent slide-in"
      style={{ 
        height: 'calc(100vh - var(--bottom-nav-height, 80px))', 
        minHeight: '500px',
        maxHeight: 'calc(100vh - 60px)',
        '--bottom-nav-height': '80px'
      } as React.CSSProperties}
      onClick={handlePhotoClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setSwipeState(prev => ({ ...prev, isDragging: false }))}
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
                      src={photoUrl}
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

        {/* Верхняя панель: счетчик фото */}
        {data.photos.length > 1 && hasValidPhotos && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
            <div className="px-3 py-1 rounded-full text-white text-xs bg-black/60 backdrop-blur-sm border border-white/20">
              {currentPhotoIndex + 1} / {data.photos.filter((_, index) => !imageStates[index]?.error).length}
            </div>
          </div>
        )}

        {/* Нижний стек: имя, теги, био, кнопки */}
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 pt-2">
          {/* Имя и возраст */}
          <div className="text-white text-2xl font-bold drop-shadow-2xl">
            {title || 'Без имени'}
          </div>

          {/* Теги */}
          <div ref={tagsRef} className="mt-3 flex flex-wrap gap-2">
            {(() => {
              const allTags = []
              
              if (data.city) {
                allTags.push(
                  <span key="city" className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20">
                    📍 {data.city}
                  </span>
                )
              }
              
              if (data.gender) {
                allTags.push(
                  <span key="gender" className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20">
                    <FaVenusMars className="w-3 h-3" />
                    {data.gender}
                  </span>
                )
              }
              
              if (data.heightCm || data.weightKg) {
                allTags.push(
                  <span key="physical" className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20">
                    <FaRuler className="w-3 h-3" />
                    {[formatHeight(data.heightCm), formatWeight(data.weightKg)]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                )
              }
              
              if (data.wandSizeCm) {
                allTags.push(
                  <span key="wand" className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20">
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
            <div ref={bioRef} className="mt-3 text-white text-sm drop-shadow-xl">
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
                    onClick={() => setShowFullBio(true)}
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
        </div>

    </div>
  )
}


