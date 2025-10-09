import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import ProfileCard, { ProfileCardSchema, type ProfileCardData } from '@/entities/ProfileCard/ui/ProfileCard'
import { wsClient, type WsEnvelope } from '@/shared/lib/ws'
import { exploreStore } from '@/shared/lib/exploreStore'

export default function ExplorePage(): JSX.Element {
  const [card, setCard] = useState<ProfileCardData | null>(exploreStore.getState().currentCard)
  const [loading, setLoading] = useState(!exploreStore.getState().currentCard)
  const [showLoadingMessage, setShowLoadingMessage] = useState(!exploreStore.getState().currentCard)
  const [error, setError] = useState<string | null>(null)
  const cidRef = useRef(0)
  const navigate = useNavigate()
  const timeoutRef = useRef<number | null>(null)

  function next(): void {
    // Проверяем, что WebSocket подключен
    if (!wsClient.getConnectionState()) {
      console.warn('WebSocket not connected, skipping next request')
      return
    }
    
    setLoading(true)
    setShowLoadingMessage(true)
    if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
    timeoutRef.current = window.setTimeout(() => {
      setError('Нет ответа от сервера')
      setLoading(false)
      setShowLoadingMessage(false)
    }, 6000)
    wsClient.send({ ch: 'explore', t: 'next' })
  }

  function like(isLike: boolean): void {
    if (!card) {
      console.error('No card available for like action')
      return
    }
    
    // Проверяем, что WebSocket подключен
    if (!wsClient.getConnectionState()) {
      console.warn('WebSocket not connected, cannot send like action')
      setError('Нет соединения с сервером')
      return
    }
    
    const cid = String(++cidRef.current)
    console.log('Sending like action:', { isLike, targetUserId: card.userId, cid })
    
    try {
      wsClient.send({ ch: 'explore', t: isLike ? 'like' : 'dislike', data: { targetUserId: card.userId }, cid })
      // сразу подгружаем следующую без показа loading сообщения
      setLoading(true)
      setShowLoadingMessage(false) // не показываем сообщение загрузки при лайке/дизлайке
      if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
      timeoutRef.current = window.setTimeout(() => {
        setError('Нет ответа от сервера')
        setLoading(false)
      }, 6000)
      wsClient.send({ ch: 'explore', t: 'next' })
    } catch (error) {
      console.error('Failed to send like action:', error)
      setError('Ошибка отправки лайка')
    }
  }


  useEffect(() => {
    const unsub = exploreStore.subscribe((s) => setCard(s.currentCard))
    const initData = window?.Telegram?.WebApp?.initData || ''
    wsClient.connect(initData)
    const off = wsClient.on((msg: WsEnvelope) => {
      if (msg.ch !== 'explore') return
      if (msg.t === 'profile') {
        if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
        if (msg.data === null) {
          // Нет анкет
          exploreStore.setCard(null)
          setError('Анкет больше нет')
        } else {
          try {
            console.log('Received profile data:', msg.data)
            const parsed = ProfileCardSchema.parse(msg.data)
            console.log('Profile data parsed successfully:', parsed)
            exploreStore.setCard(parsed)
            setError(null) // Сбрасываем ошибку при успешной загрузке
          } catch (error) {
            // invalid data
            console.error('Profile data validation failed:', error)
            console.error('Received data:', msg.data)
            console.error('Validation error details:', error instanceof Error ? error.message : String(error))
            setError('Ошибка загрузки анкеты')
          }
        }
        setLoading(false)
        setShowLoadingMessage(false)
      } else if (msg.t === 'match') {
        if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
        const chatId = (msg.data as any)?.chatId as string | undefined
        if (chatId) {
          toast.success('🎉 Ваш лайк взаимный!', {
            description: 'Нажмите чтобы перейти в чат',
            action: {
              label: 'Перейти',
              onClick: () => navigate(`/messages/${encodeURIComponent(chatId)}`)
            },
            duration: 5000
          })
        }
      } else if (msg.t === 'error') {
        if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
        const errorMessage = String((msg.data as any)?.message || 'Ошибка')
        console.error('WebSocket error:', errorMessage, msg)
        setError(errorMessage)
        setLoading(false)
        setShowLoadingMessage(false)
      } else if (msg.t === 'ack') {
        // Подтверждение получения лайка
        console.log('Like action acknowledged:', msg.cid)
        if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
      }
    })
    
    // Ждем подключения WebSocket перед отправкой запроса
    const offOpen = wsClient.onOpen(() => {
      if (!exploreStore.getState().currentCard) next()
    })
    
    // Если WebSocket уже подключен, отправляем запрос сразу
    if (wsClient.getConnectionState() && !exploreStore.getState().currentCard) {
      next()
    }

    return () => {
      off()
      offOpen()
      if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
      unsub()
    }
  }, [])

  // Обновляем данные при фокусе на странице
  useEffect(() => {
    let lastFocusTime = 0
    
    const handleFocus = () => {
      const now = Date.now()
      // Обновляем данные только если прошло больше 30 секунд с последнего фокуса
      if (now - lastFocusTime > 30000) {
        // Если нет текущей карточки, загружаем новую
        if (!exploreStore.getState().currentCard && wsClient.getConnectionState()) {
          next()
        }
        lastFocusTime = now
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  return (
    <div className="h-full p-4 max-w-md mx-auto">
      {error && error !== 'Анкет больше нет' ? (
        <div className="text-sm text-red-500 mb-2">
          {error}
          <div className="mt-2">
            <button className="btn btn-primary scale-in" onClick={() => { setError(null); next() }}>Повторить</button>
          </div>
        </div>
      ) : null}
      {showLoadingMessage ? <div className="text-sm text-muted fade-in">Загрузка…</div> : null}
      {card ? (
        <ProfileCard data={{
          userId: String(card.userId),
          displayName: card.displayName,
          age: card.age,
          city: card.city,
          photos: card.photos,
          bio: card.bio,
          heightCm: card.heightCm,
          weightKg: card.weightKg,
          wandSizeCm: card.wandSizeCm,
          gender: card.gender,
        }} onLike={() => like(true)} onDislike={() => like(false)} />
      ) : (!loading && error === 'Анкет больше нет' ? (
        <div className="text-center py-8">
          <div className="text-lg font-semibold mb-2">Анкет больше нет</div>
          <div className="text-sm text-muted mb-4">Попробуйте позже или измените настройки поиска</div>
          <button 
            className="btn btn-primary scale-in" 
            onClick={() => { setError(null); next() }}
          >
            Обновить
          </button>
        </div>
      ) : (!loading ? (
        <div className="text-center py-8">
          <div className="text-lg font-semibold mb-2">Загрузка анкет</div>
          <div className="text-sm text-muted mb-4">Пожалуйста, подождите...</div>
        </div>
      ) : null))}
    </div>
  )
}


