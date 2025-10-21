import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ProfileCard, { ProfileCardSchema, type ProfileCardData } from '@/entities/ProfileCard/ui/ProfileCard'
import { likesWsClient, type LikesWsEnvelope } from '@/shared/lib/likesWs'

export type LikeData = {
  id: string
  userId: string
  displayName: string
  age: number | null
  city: string | null
  photos: string[]
  bio: string | null
  heightCm: number | null
  weightKg: number | null
  wandSizeCm: number | null
  gender: string | null
  likedAt: string
  matchedAt: string | null
  isMatched: boolean
}

export default function LikesPage(): JSX.Element {
  const [currentLike, setCurrentLike] = useState<LikeData | null>(null)
  const [likes, setLikes] = useState<LikeData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showLoadingMessage, setShowLoadingMessage] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const cidRef = useRef(0)
  const navigate = useNavigate()
  const timeoutRef = useRef<number | null>(null)

  // Подключение к WebSocket
  useEffect(() => {
    const initData = window?.Telegram?.WebApp?.initData || ''
    likesWsClient.connect(initData)
  }, [])

  // Обработка WebSocket сообщений
  useEffect(() => {
    const off = likesWsClient.on((msg: LikesWsEnvelope) => {
      // Обрабатываем hello сообщение
      if ((msg as any).type === 'hello') {
        return
      }
      
      switch (msg.t) {
        case 'received_likes':
          const receivedLikes = (msg.data as any)?.likes || []
          setLikes(receivedLikes)
          setCurrentLike(receivedLikes[0] || null)
          setCurrentIndex(0)
          setLoading(false)
          setShowLoadingMessage(false)
          setError(null)
          if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
          break

        case 'action_success':
          // После действия с лайком переходим к следующему
          nextLike()
          break

        case 'match':
          // При матче открываем чат
          const chatId = (msg.data as any)?.chatId as string | undefined
          if (chatId) navigate(`/messages/${encodeURIComponent(chatId)}`)
          break

        case 'error':
          setError((msg.data as any)?.message || 'Ошибка')
          setLoading(false)
          setShowLoadingMessage(false)
          if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
          break
      }
    })

    return off
  }, [])

  // Загрузка данных при монтировании
  useEffect(() => {
    // Даем время WebSocket подключиться
    const timer = setTimeout(() => {
      loadLikes()
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  // Обновляем данные при фокусе на странице (только если нет данных)
  useEffect(() => {
    const handleFocus = () => {
      // Загружаем данные только если их нет
      if (likes.length === 0 && !loading) {
        loadLikes()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [likes.length, loading])

  const loadLikes = () => {
    setLoading(true)
    setShowLoadingMessage(true)
    if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
    timeoutRef.current = window.setTimeout(() => {
      setError('Нет ответа от сервера')
      setLoading(false)
      setShowLoadingMessage(false)
    }, 6000)
    
    likesWsClient.getReceivedLikes(1, 20)
  }

  const nextLike = () => {
    if (currentIndex < likes.length - 1) {
      const nextIndex = currentIndex + 1
      const nextLike = likes[nextIndex]
      if (nextLike) {
        setCurrentIndex(nextIndex)
        setCurrentLike(nextLike)
      }
    } else {
      // Нет больше лайков
      setCurrentLike(null)
      setError('Лайков больше нет')
    }
  }

  const handleLike = () => {
    if (!currentLike) return
    // Лайкаем в ответ
    likesWsClient.likeAction(currentLike.userId, 'like')
  }

  const handleDislike = () => {
    if (!currentLike) return
    // Дизлайкаем
    likesWsClient.likeAction(currentLike.userId, 'dislike')
  }

  // Конвертируем LikeData в ProfileCardData
  const convertToProfileCard = (like: LikeData): ProfileCardData => ({
    userId: like.userId,
    displayName: like.displayName,
    age: like.age,
    city: like.city,
    photos: like.photos,
    bio: like.bio,
    heightCm: like.heightCm,
    weightKg: like.weightKg,
    wandSizeCm: like.wandSizeCm,
    gender: like.gender,
  })

  return (
    <div className="h-full p-4 max-w-md mx-auto">
      {error && error !== 'Лайков больше нет' ? (
        <div className="text-sm text-red-500 mb-2">
          {error}
          <div className="mt-2">
            <button className="btn btn-primary" onClick={() => { setError(null); loadLikes() }}>Повторить</button>
          </div>
        </div>
      ) : null}
      {showLoadingMessage ? <div className="text-sm text-muted">Загрузка…</div> : null}
      {currentLike ? (
        <ProfileCard 
          data={convertToProfileCard(currentLike)} 
          onLike={handleLike} 
          onDislike={handleDislike} 
        />
      ) : (!loading && error === 'Лайков больше нет' ? (
        <div className="text-center py-8">
          <div className="text-lg font-semibold mb-2">Лайков больше нет</div>
          <div className="text-sm text-muted mb-4">Попробуйте позже</div>
          <button 
            className="btn btn-primary" 
            onClick={() => { setError(null); loadLikes() }}
          >
            Обновить
          </button>
        </div>
      ) : (!loading && likes.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-lg font-semibold mb-2">Вас пока что еще никто не лайкнул</div>
          <div className="text-sm text-muted mb-4">Попробуйте посмотреть анкеты других пользователей</div>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate('/explore')}
          >
            Смотреть анкеты
          </button>
        </div>
      ) : null))}
    </div>
  )
}
