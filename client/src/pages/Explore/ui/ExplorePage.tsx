import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import ProfileCard, { type ProfileCardData } from '@/entities/ProfileCard/ui/ProfileCard'
import { wsClient, type WsEnvelope } from '@/shared/lib/ws'
import { useNavigate } from 'react-router-dom'

export default function ExplorePage(): JSX.Element {
  const [card, setCard] = useState<ProfileCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cidRef = useRef(0)
  const navigate = useNavigate()
  const timeoutRef = useRef<number | null>(null)

  function next(): void {
    setLoading(true)
    wsClient.send({ ch: 'explore', t: 'next' })
  }

  function like(isLike: boolean): void {
    if (!card) return
    const cid = String(++cidRef.current)
    wsClient.send({ ch: 'explore', t: isLike ? 'like' : 'dislike', data: { targetUserId: card.userId }, cid })
    // сразу подгружаем следующую
    next()
  }

  useEffect(() => {
    const initData = window?.Telegram?.WebApp?.initData || ''
    wsClient.connect(initData)
    const off = wsClient.on((msg: WsEnvelope) => {
      if (msg.ch !== 'explore') return
      if (msg.t === 'profile') {
        if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
        setCard(msg.data as any)
        setLoading(false)
      } else if (msg.t === 'match') {
        if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
        const chatId = (msg.data as any)?.chatId as string | undefined
        if (chatId) navigate(`/messages/${encodeURIComponent(chatId)}`)
      } else if (msg.t === 'error') {
        if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
        setError(String((msg.data as any)?.message || 'Ошибка'))
        setLoading(false)
      }
    })
    // если сокет ещё не открыт — отправим next после открытия; иначе сейчас
    const offOpen = wsClient.onOpen(() => next())
    // гарантируем первый запрос и при открытом сокете
    next()

    // fail-safe: если ответа нет слишком долго, прерываем загрузку
    timeoutRef.current = window.setTimeout(() => {
      setError('Нет ответа от сервера')
      setLoading(false)
    }, 6000)
    return () => {
      off()
      offOpen()
      if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null }
    }
  }, [])

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="text-xl font-semibold mb-3">Анкеты</div>
      {error ? (
        <div className="text-sm text-red-500 mb-2">
          {error}
          <div className="mt-2">
            <button className="btn btn-primary" onClick={() => { setError(null); next() }}>Повторить</button>
          </div>
        </div>
      ) : null}
      {loading ? <div className="text-sm text-muted">Загрузка…</div> : null}
      {card ? (
        <ProfileCard data={{
          userId: String(card.userId),
          displayName: card.displayName,
          age: card.age,
          city: card.city,
          photos: card.photos,
          bio: card.bio,
        }} onLike={() => like(true)} onDislike={() => like(false)} />
      ) : (!loading ? <div className="text-sm text-muted">Кандидатов нет</div> : null)}
    </div>
  )
}


