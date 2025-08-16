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
        setCard(msg.data as any)
        setLoading(false)
      } else if (msg.t === 'match') {
        const chatId = (msg.data as any)?.chatId as string | undefined
        if (chatId) navigate(`/messages/${encodeURIComponent(chatId)}`)
      } else if (msg.t === 'error') {
        setError(String((msg.data as any)?.message || 'Ошибка'))
        setLoading(false)
      }
    })
    // если сокет ещё не открыт — отправим next после открытия; иначе сейчас
    const offOpen = wsClient.onOpen(() => next())
    // гарантируем первый запрос и при открытом сокете
    next()
    return () => off()
  }, [])

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="text-xl font-semibold mb-3">Анкеты</div>
      {error ? <div className="text-sm text-red-500 mb-2">{error}</div> : null}
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


