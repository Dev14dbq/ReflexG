import type { JSX } from 'react'
import type { Message as UiMessage } from './MessagesList'
import { cfImage } from '@/shared/lib/image'

type GroupPosition = 'single' | 'first' | 'middle' | 'last'

interface MessageItemProps {
  message: UiMessage
  position?: GroupPosition
}

export default function MessageItem({ message, position = 'single' }: MessageItemProps): JSX.Element {
  console.log('MessageItem rendering:', {
    id: message.id,
    hasStickerId: !!message.stickerId,
    stickerId: message.stickerId,
    hasPhotoUrl: !!message.photoUrl,
    hasText: !!message.text,
    messageType: (message as any).messageType
  })
  
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const shapeClass = (() => {
    const isOwn = message.isOwn
    if (position === 'single') return isOwn ? 'rounded-br-md' : 'rounded-bl-md'
    if (position === 'first') return isOwn ? 'rounded-br-md' : 'rounded-bl-md'
    if (position === 'middle') return isOwn ? 'rounded-br-sm rounded-tr-sm' : 'rounded-bl-sm rounded-tl-sm'
    if (position === 'last') return isOwn ? 'rounded-tr-md' : 'rounded-tl-md'
    return ''
  })()

  return (
    <div className={`flex gap-2 ${message.isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Сообщение */}
      <div className={`max-w-[70%] ${message.isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Имя отправителя (только для чужих сообщений) */}
        {!message.isOwn && message.senderName && (
          <div className="text-xs text-muted px-1">{message.senderName}</div>
        )}

        {/* Контент сообщения: стикер, фото или текст */}
        <div className="flex flex-col gap-1">
          {(message as any).messageType === 'STICKER' ? (
            <div className="flex justify-center">
              <img
                src={(() => {
                  const src = message.photoUrl || message.stickerId || ''
                  const url = cfImage(src, { variant: 'media', width: 256, quality: 85, format: 'auto' })
                  console.log('Generated sticker URL:', url, 'from src:', src)
                  return url
                })()}
                alt="стикер"
                className="w-32 h-32 object-contain"
                loading="lazy"
                onError={(e) => {
                  console.error('Failed to load sticker:', message.stickerId, 'photoUrl:', message.photoUrl, e)
                  console.error('Failed URL:', e.target.src)
                }}
                onLoad={() => {
                  console.log('Sticker loaded successfully:', message.stickerId)
                }}
              />
            </div>
          ) : message.photoUrl ? (
            <div className="overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--color-accent)40%,transparent)]">
              <img
                src={cfImage(message.photoUrl, { variant: 'media', width: 1080, quality: 85, format: 'auto' })}
                alt="фото"
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>
          ) : message.text ? (
            <div
              className={`px-4 py-2.25 rounded-2xl text-base break-words ${
                message.isOwn
                  ? `bg-[var(--color-accent)] text-white ${shapeClass}`
                  : `bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] text-[var(--color-fg)] border border-[color-mix(in_oklab,var(--color-accent)50%,transparent)] ${shapeClass}`
              }`}
            >
              {message.text}
            </div>
          ) : null}
        </div>

        {/* Время — только для одиночных и последних в группе */}
        {(position === 'single' || position === 'last') && (
          <div className={`text-xs text-muted px-1 ${message.isOwn ? 'text-right' : 'text-left'}`}>
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  )
}
