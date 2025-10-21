import type { JSX } from 'react'
import { useEffect, useRef } from 'react'
import MessageItem from './MessageItem'

export interface Message {
  id: string
  text: string
  photoUrl?: string | null
  stickerId?: string | null
  messageType?: 'TEXT' | 'IMAGE' | 'STICKER'
  timestamp: number
  isOwn: boolean
  senderName?: string | undefined
  senderAvatar?: string | undefined
}

interface MessagesListProps {
  messages: Message[]
  isLoading?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  onAtBottomChange?: (atBottom: boolean) => void
  shouldAutoScroll?: boolean
}

type GroupPosition = 'single' | 'first' | 'middle' | 'last'

export default function MessagesList({ messages, isLoading, isLoadingMore, onLoadMore, onAtBottomChange, shouldAutoScroll }: MessagesListProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Автоскролл к последнему сообщению — только если пользователь у низа
  useEffect(() => {
    if (!shouldAutoScroll) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, shouldAutoScroll])

  // Подгрузка истории при прокрутке вверх
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !onLoadMore) return
    const handler = () => {
      if (el.scrollTop <= 24 && !isLoadingMore) onLoadMore()
    }
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [onLoadMore, isLoadingMore])

  // Отслеживаем, находимся ли у низа списка, чтобы помечать прочитанным
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !onAtBottomChange) return

    const compute = () => {
      const threshold = 24 // px
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      onAtBottomChange(distance <= threshold)
    }

    compute()
    const onScroll = () => compute()
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [onAtBottomChange, messages])

  // Рассчитываем позицию каждого сообщения в группе
  const computed = messages.map((m, idx) => {
    const prev = idx > 0 ? messages[idx - 1] : undefined
    const next = idx < messages.length - 1 ? messages[idx + 1] : undefined
    const within2MinPrev = prev ? (m.timestamp - prev.timestamp) < 120000 : false
    const within2MinNext = next ? (next.timestamp - m.timestamp) < 120000 : false
    const sameSidePrev = prev ? prev.isOwn === m.isOwn : false
    const sameSideNext = next ? next.isOwn === m.isOwn : false

    const linkPrev = within2MinPrev && sameSidePrev
    const linkNext = within2MinNext && sameSideNext

    let position: GroupPosition = 'single'
    if (linkPrev && linkNext) position = 'middle'
    else if (linkPrev && !linkNext) position = 'last'
    else if (!linkPrev && linkNext) position = 'first'
    else position = 'single'

    return { message: m, position, linkPrev }
  })

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="text-sm text-muted">Загрузка сообщений...</div>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="text-sm text-muted">Пока нет сообщений</div>
        </div>
      ) : (
        <div className="flex flex-col min-h-full">
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <div className="text-xs text-muted">Загрузка истории…</div>
            </div>
          )}
          <div className="mt-auto">
            {computed.map(({ message, position, linkPrev }, idx) => (
              <div key={message.id} style={{ marginTop: idx === 0 ? 0 : (linkPrev ? 6 : 12) }}>
                <MessageItem message={message} position={position} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
