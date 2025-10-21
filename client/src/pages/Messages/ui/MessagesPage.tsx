import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchChatInfo, fetchChatMessages, markMessagesAsRead, sendImageMessage, type ChatInfoResponse, type ChatMessageItem } from '@/shared/api/chat'
import { uploadImage } from '@/shared/api/cdn'
import { compressImageToJpeg } from '@/shared/lib/image'
import ChatHeader from './ChatHeader'
import ChatComposer from './ChatComposer'
import MessagesList from './MessagesList'
import StickerPanel from './StickerPanel'
import { wsClient, type WsEnvelope } from '@/shared/lib/ws'
import { chatStore } from '@/shared/lib/chatStore'

export default function MessagesPage(): JSX.Element {
  const { chatId } = useParams<{ chatId: string }>()
  const navigate = useNavigate()
  const [chatInfo, setChatInfo] = useState<ChatInfoResponse['chat'] | null>(null)
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [showStickerPanel, setShowStickerPanel] = useState<boolean>(false)
  const [atBottom, setAtBottom] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!chatId) return
      try {
        const initData = window?.Telegram?.WebApp?.initData || ''
        const resp = await fetchChatInfo(initData, chatId)
        if (!cancelled) setChatInfo(resp.chat)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [chatId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!chatId) return
      setIsLoading(true)
      try {
        const initData = window?.Telegram?.WebApp?.initData || ''
        const resp = await fetchChatMessages(initData, chatId, undefined, 30)
        if (cancelled) return
        setMessages(resp.items)
        setNextCursor(resp.nextCursor)
      } catch {
        if (!cancelled) {
          setMessages([])
          setNextCursor(undefined)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [chatId])

  // Subscribe to WS for this chat: receive messages and presence
  useEffect(() => {
    if (!chatId) return
    const initData = window?.Telegram?.WebApp?.initData || ''
    wsClient.connect(initData)
    const off = wsClient.on((msg: WsEnvelope<any>) => {
      if (msg.ch !== 'messages') return
      if (msg.t === 'message' && (msg.data as any)?.chatId === chatId) {
        const m = msg.data as { 
          id: string; 
          chatId: string; 
          senderId: string; 
          text?: string; 
          photoUrl?: string;
          stickerId?: string;
          messageType?: 'TEXT' | 'IMAGE' | 'STICKER';
          createdAt: string;
          replyId?: string;
          isPinned?: boolean;
          isEdit?: boolean;
        }
        console.log('Received WebSocket message:', m)
        console.log('Message has stickerId:', !!m.stickerId, 'stickerId value:', m.stickerId)
        console.log('Message has messageType:', m.messageType)
        console.log('Message has photoUrl:', !!m.photoUrl, 'photoUrl value:', m.photoUrl)
        setMessages(prev => [...prev, {
          id: m.id,
          senderId: m.senderId,
          text: m.text || '',
          photoUrl: m.photoUrl || null,
          stickerId: m.stickerId || null,
          messageType: m.messageType || 'TEXT',
          createdAt: m.createdAt,
          replyId: m.replyId || null,
          isPinned: m.isPinned || false,
          isEdit: m.isEdit || false,
        }])
        // Если внизу – помечаем как прочитанные
        if (atBottom) {
          const safeInit = window?.Telegram?.WebApp?.initData || ''
          void markMessagesAsRead(safeInit, chatId)
          // синхронно обновим chatStore, чтобы чатлист показал 0 непрочитанных
          chatStore.updateChatItem(chatId, { unreadCount: 0, isRead: true })
        }
      }
      if (msg.t === 'presence' && (msg.data as any)?.chatId === chatId) {
        const d = msg.data as { chatId: string; userId: string; isOnline: boolean }
        setChatInfo(prev => prev ? { ...prev, isOnline: d.isOnline } : prev)
      }
      if (msg.t === 'chat_info' && (msg.data as any)?.id === chatId) {
        // could update header online state here if needed
      }
    })
    // subscribe
    wsClient.send({ ch: 'messages', t: 'subscribe', data: { chatId } })
    return () => {
      off()
      wsClient.send({ ch: 'messages', t: 'unsubscribe', data: { chatId } })
    }
  }, [chatId])

  async function loadMore(): Promise<void> {
    if (!chatId || !nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const resp = await fetchChatMessages(initData, chatId, nextCursor, 30)
      // prepend older messages
      setMessages(prev => [...resp.items, ...prev])
      setNextCursor(resp.nextCursor)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // При первом заходе, если мы уже у нижней границы – помечаем как прочитанные
  useEffect(() => {
    if (!chatId) return
    if (!isLoading && atBottom && messages.length > 0) {
      const initData = window?.Telegram?.WebApp?.initData || ''
      void markMessagesAsRead(initData, chatId)
    }
  }, [chatId, isLoading, atBottom, messages.length])

  return (
    <div className="h-full relative overflow-hidden">
      {/* SVG-обои: прокрашиваем линии в акцентный цвет через mask */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: 'var(--color-accent)',
          WebkitMask: "url('/Chat/Wallpaper/love-tg.svg') center / auto repeat",
          mask: "url('/Chat/Wallpaper/love-tg.svg') center / auto repeat",
          opacity: 0.22
        }}
      />

      {/* Локальный хедер чата - на всю ширину */}
      <ChatHeader title={chatInfo?.title || 'Чат'} avatarUrl={chatInfo?.avatarUrl || null} isOnline={!!chatInfo?.isOnline} onBack={() => navigate(-1)} />

      {/* Контент с ограничением ширины */}
      <div className="relative max-w-md mx-auto overflow-y-auto flex flex-col" style={{ height: 'calc(100% - 56px)' }}>
        {/* Список сообщений */}
        <MessagesList 
          messages={messages.map(m => ({
            id: m.id,
            text: m.text,
            photoUrl: m.photoUrl,
            stickerId: m.stickerId,
            messageType: m.messageType,
            timestamp: Date.parse(m.createdAt),
            isOwn: String((window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id || '') === m.senderId,
            senderName: undefined,
            senderAvatar: undefined,
          }))}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
        onAtBottomChange={setAtBottom}
        shouldAutoScroll={atBottom}
        />
        
        {/* Композер сообщений */}
        <ChatComposer 
          onSend={(text) => {
            if (!chatId) return
            wsClient.send({ ch: 'messages', t: 'send', data: { chatId, text } })
          }} 
          onAttach={async () => {
            if (!chatId) return
            try {
              // Открываем файловый пикер
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/*'
              input.multiple = false
              const filePromise = new Promise<File | null>((resolve) => {
                input.onchange = () => {
                  const f = input.files && input.files[0] ? input.files[0] : null
                  resolve(f)
                }
              })
              input.click()
              const file = await filePromise
              if (!file) return

              // Сжимаем изображение для ускорения загрузки
              const blob = await compressImageToJpeg(file, 1440, 0.85)
              const initData = window?.Telegram?.WebApp?.initData || ''

              // Загружаем в CDN, получаем id
              const up = await uploadImage(blob, { variant: 'media' })
              if (!up.ok || !up.id) throw new Error(('message' in up && up.message) ? up.message : 'Upload failed')

              // Отправляем сообщение с фото
              const sent = await sendImageMessage(initData, chatId, up.id)
              // Локально добавим сообщение, чтобы появилось без перезагрузки
              setMessages(prev => [...prev, sent.item])
              // Скролл в конец — уже делается, если atBottom
            } catch (e) {
              console.error('attach failed', e)
            }
          }}
          onStickers={() => setShowStickerPanel(!showStickerPanel)}
        />
        
        {showStickerPanel && chatId && (
          <StickerPanel
            chatId={chatId}
            onStickerSent={async () => {
              setShowStickerPanel(false)
              // Стикер уже отправлен через API, WebSocket должен получить его
              // Дополнительная перезагрузка не нужна
            }}
            onClose={() => setShowStickerPanel(false)}
          />
        )}
      </div>
    </div>
  )
}


