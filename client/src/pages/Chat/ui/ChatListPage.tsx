import type { JSX } from 'react'
import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { RiRefreshLine, RiMessage3Line, RiHeartLine } from 'react-icons/ri'
import Lottie from 'lottie-react'
import chatAnim from '@/assets/chat.json'

import { fetchChats, type ChatListItem, fetchArchiveData, fetchUsersOnlineStatus, markAllMessagesRead } from '@/shared/api/chat'
import { chatStore } from '@/shared/lib/chatStore'
import { useChatWebSocket } from '@/shared/hooks/useChatWebSocket'
import { wsClient } from '@/shared/lib/ws'

export default function ChatListPage(): JSX.Element {
  // Состояние списка чатов
  const [themeList, setThemeList] = useState<ChatListItem[]>(chatStore.getState().items)
  const [paginationCursor, setPaginationCursor] = useState<string | undefined>(chatStore.getState().cursor)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [errorState, setErrorState] = useState<string | null>(null)
  
  // Состояние архива
  const [archiveData, setArchiveData] = useState<{
    messageCount: number
    chatTitles: string[]
  } | null>(null)

  // Состояние для swipe-жестов
  const [swipeState, setSwipeState] = useState<{
    chatId: string | null
    translateX: number
    isSwipeActive: boolean
  }>({
    chatId: null,
    translateX: 0,
    isSwipeActive: false
  })
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [lotteryAnimation, setLotteryAnimation] = useState<{
    chatId: string | null
    isAnimating: boolean
  }>({
    chatId: null,
    isAnimating: false
  })
  
  // Состояние для плавного возврата
  const [isReturning, setIsReturning] = useState(false)

  /* Загрузка данных архива */
  async function loadArchiveData(): Promise<void> {
    try {
      const telegramInitData = window?.Telegram?.WebApp?.initData || ''
      if (!telegramInitData) return
      
      const response = await fetchArchiveData(telegramInitData)
      if (response.messageCount > 0) {
        setArchiveData({
          messageCount: response.messageCount,
          chatTitles: response.chatTitles
        })
      } else {
        setArchiveData(null)
      }
    } catch (error) {
      console.error('Failed to load archive data:', error)
      setArchiveData(null)
    }
  }

  /* Загрузка онлайн статуса пользователей */
  async function loadUsersOnlineStatus(chatIds: string[]): Promise<void> {
    if (chatIds.length === 0) return
    
    try {
      const telegramInitData = window?.Telegram?.WebApp?.initData || ''
      const response = await fetchUsersOnlineStatus(telegramInitData, chatIds)
      
      // Обновляем онлайн статус в списке чатов
      setThemeList(prev => prev.map(chat => {
        const userStatus = response.users.find(user => user.chatId === chat.id)
        if (userStatus) {
          return { 
            ...chat, 
            isOnline: userStatus.isOnline, 
            lastSeen: userStatus.lastSeen || undefined 
          } as ChatListItem
        }
        return chat
      }))
      
      // Логирование для отладки (можно раскомментировать при необходимости)
      // console.log('Online status loaded:', response.users)
    } catch (error) {
      console.error('Failed to load online status:', error)
    }
  }

  /* Загрузка дополнительных тем (пагинация) */
  async function loadMoreThemes(): Promise<void> {
    if (isLoading) return
    setIsLoading(true)

    try {
      const telegramInitData = window?.Telegram?.WebApp?.initData || ''
      const response = await fetchChats(telegramInitData, paginationCursor, 20)
      
      if (paginationCursor) {
        setThemeList(prev => [...prev, ...response.items])
        chatStore.appendItems(response.items, response.nextCursor)
      } else {
      setThemeList(response.items)
      chatStore.setItems(response.items, response.nextCursor)
      
      // Логирование для отладки онлайн статуса (можно раскомментировать при необходимости)
      // console.log('Chats loaded:', response.items.map(chat => ({
      //   id: chat.id,
      //   title: chat.title,
      //   isOnline: chat.isOnline,
      //   lastSeen: chat.lastSeen
      // })))
    }
      
      setPaginationCursor(response.nextCursor)
      
      // Загружаем онлайн статус для всех чатов
      const allChatIds = paginationCursor 
        ? [...themeList.map(chat => chat.id), ...response.items.map(chat => chat.id)]
        : response.items.map(chat => chat.id)
      await loadUsersOnlineStatus(allChatIds)
    } catch (error) {
      setErrorState(error instanceof Error ? error.message : 'Возникла ошибка при загрузки тем!')
    } finally {
      setIsLoading(false)
    }
  }

  /* Обновление списка тем */
  async function refreshThemeList(): Promise<void> {
    chatStore.clear()
    setThemeList([])
    setPaginationCursor(undefined)
    setErrorState(null)
    await loadMoreThemes()
  }

  /* Подписка на изменения в store и первичная загрузка */
  useEffect(() => {
    const unsubscribe = chatStore.subscribe((state) => {
      setThemeList(state.items)
      setPaginationCursor(state.cursor)
    })
    
    const cachedState = chatStore.getState()
    if (cachedState.items.length === 0 || chatStore.isStale()) {
      (async () => {
        setIsInitialLoading(true)
        try {
          await Promise.all([
            loadMoreThemes(),
            loadArchiveData()
          ])
        } finally {
          setIsInitialLoading(false)
        }
      })()
    } else {
      loadArchiveData()
    }
    
    return unsubscribe
  }, [])

  /* WS: подключение и подписка на presence для всех чатов списка */
  useEffect(() => {
    const initData = window?.Telegram?.WebApp?.initData || ''
    if (!initData) return

    // Ensure WS connection
    wsClient.connect(initData)

    // After connected (or immediately if already), subscribe to each chatId
    const performSubscribe = () => {
      const uniqueChatIds = Array.from(new Set(themeList.map(c => c.id)))
      uniqueChatIds.forEach(chatId => {
        wsClient.send({ ch: 'messages', t: 'subscribe', data: { chatId } })
      })
    }

    if (wsClient.getConnectionState()) {
      performSubscribe()
    } else {
      const off = wsClient.onOpen(() => {
        performSubscribe()
      })
      // Cleanup on unmount
      return () => { try { off() } catch {} }
    }

    // On unmount or themeList change, unsubscribe previous ids
    return () => {
      const uniqueChatIds = Array.from(new Set(themeList.map(c => c.id)))
      uniqueChatIds.forEach(chatId => {
        wsClient.send({ ch: 'messages', t: 'unsubscribe', data: { chatId } })
      })
    }
  }, [themeList])

  /* Форматирование даты или времени для отображения */
  function formatChatTimestamp(timestamp: string): string {    
    timestamp = timestamp + 'Z'
    const messageDate = new Date(timestamp)
    const currentDate = new Date()
  
    const currentDateComponents = {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth(),
      day: currentDate.getDate()
    }
  
    const messageYear = messageDate.getFullYear()
    const messageMonth = messageDate.getMonth()
    const messageDay = messageDate.getDate()
  
    const isToday = 
      currentDateComponents.year === messageYear &&
      currentDateComponents.month === messageMonth &&
      currentDateComponents.day === messageDay
  
    if (isToday) {
      return new Date(timestamp).toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } else {
      const day = messageDay.toString().padStart(2, '0')
      const month = (messageMonth + 1).toString().padStart(2, '0')
      return `${day}.${month}`
    }
  }

  /* Функция для обрезки списка чатов в архиве */
  function truncateArchiveChatList(chatTitles: string[], maxLength = 50): string {
    if (chatTitles.length === 0) return ''
    
    let result = chatTitles.join(', ')
    if (result.length <= maxLength) return result
    
    result = result.substring(0, maxLength)
    const lastCommaIndex = result.lastIndexOf(',')
    if (lastCommaIndex > 0) {
      result = result.substring(0, lastCommaIndex)
    }
    
    if (chatTitles.length > 1) {
      result += '...'
    }
    
    return result
  }

  /* Функции для обработки swipe-жестов */
  
  function handleSwipeStart(chatId: string, clientX: number) {
    setTouchStartX(clientX)
    setSwipeState({
      chatId,
      translateX: 0,
      isSwipeActive: true
    })
  }

  function handleSwipeMove(chatId: string, clientX: number) {
    if (swipeState.chatId !== chatId || !swipeState.isSwipeActive || touchStartX === null) return
    
    const deltaX = touchStartX - clientX // Свайп влево
    const maxSwipe = 80 // Максимальное расстояние свайпа
    const animationThreshold = 50 // Порог для начала анимации лотье
    
    if (deltaX > 0 && deltaX <= maxSwipe) {
      setSwipeState(prev => ({
        ...prev,
        translateX: deltaX
      }))
      
      // Запускаем анимацию лотье когда дотянул почти полностью
      if (deltaX >= animationThreshold && !lotteryAnimation.isAnimating) {
        setLotteryAnimation({
          chatId,
          isAnimating: true
        })
      } else if (deltaX < animationThreshold && lotteryAnimation.isAnimating) {
        setLotteryAnimation({
          chatId: null,
          isAnimating: false
        })
      }
    }
  }

  function handleSwipeEnd(chatId: string, clientX: number) {
    if (swipeState.chatId !== chatId || !swipeState.isSwipeActive || touchStartX === null) return
    
    const deltaX = touchStartX - clientX // Свайп влево
    const threshold = 60 // Порог для активации действия
    
    if (deltaX >= threshold) {
      // Выполняем действие - отмечаем как лотье
      void markAsLottery(chatId)
    }
    
    // Запускаем плавный возврат
    setIsReturning(true)
    
    // Сбрасываем состояние свайпа через небольшую задержку для плавности
    setTimeout(() => {
      setTouchStartX(null)
      setSwipeState({
        chatId: null,
        translateX: 0,
        isSwipeActive: false
      })
      setLotteryAnimation({
        chatId: null,
        isAnimating: false
      })
      setIsReturning(false)
    }, 300) // 300ms для плавного возврата
  }

  async function markAsLottery(chatId: string) {
    try {
      // TODO: Добавить API для лотье
      console.log('Marking chat as lottery:', chatId)
      
      // Пока просто показываем уведомление
      console.log('Чат добавлен в лотье!')
    } catch (error) {
      console.error('Failed to mark as lottery:', error)
    }
  }

  async function markAllMessagesAsRead(chatId: string) {
    try {
      const telegramInitData = window?.Telegram?.WebApp?.initData || ''
      const response = await markAllMessagesRead(telegramInitData, chatId)
      
      // Обновляем unreadCount в списке чатов
      setThemeList(prev => prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, unreadCount: response.unreadCount }
          : chat
      ))
      
      // Обновляем store
      chatStore.updateItem({ 
        ...themeList.find(chat => chat.id === chatId)!, 
        unreadCount: response.unreadCount 
      })
    } catch (error) {
      console.error('Failed to mark messages as read:', error)
    }
  }

  // WebSocket обработчики для обновления списка чатов в реальном времени
  const handleUserOnlineStatusChange = (event: any) => {
    setThemeList(prev => prev.map(chat => 
      chat.id === event.chatId 
        ? { ...chat, isOnline: event.isOnline, lastSeen: event.lastSeen }
        : chat
    ))
  }
  const handlePresenceSnapshot = (event: any) => {
    const { chatId, presences } = event
    setThemeList(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat
      const peerPresence = presences.find((p: any) => p.userId !== window?.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString())
      return peerPresence ? { ...chat, isOnline: peerPresence.isOnline } : chat
    }))
  }

  const handleChatCreated = (event: any) => {
    setThemeList(prev => [event.chat, ...prev])
    chatStore.prependItem(event.chat)
  }

  const handleChatDeleted = (event: any) => {
    setThemeList(prev => prev.filter(chat => chat.id !== event.chatId))
    chatStore.removeItem(event.chatId)
  }

  const handleChatUpdated = (event: any) => {
    setThemeList(prev => prev.map(chat => 
      chat.id === event.chat.id ? event.chat : chat
    ))
    chatStore.updateItem(event.chat)
  }

  const handleNewMessage = (event: any) => {
    setThemeList(prev => prev.map(chat => 
      chat.id === event.chatId 
        ? { 
            ...chat, 
            message: {
              last: event.message.text,
              time: event.message.createdAt
            },
            unreadCount: chat.unreadCount + 1
          }
        : chat
    ))
  }

  // Подписка на WebSocket события
  useChatWebSocket({
    onUserOnlineStatusChange: handleUserOnlineStatusChange,
    onChatCreated: handleChatCreated,
    onChatDeleted: handleChatDeleted,
    onChatUpdated: handleChatUpdated,
    onNewMessage: handleNewMessage
  })

  // Отдельная подписка на snapshots из WS (канал chats)
  useEffect(() => {
    const off = wsClient.on((msg) => {
      if (msg.ch === 'chats' && msg.t === 'presenceSnapshot' && msg.data) {
        handlePresenceSnapshot(msg.data)
      }
    })
    return off
  }, [])

  // Подписка на канал chats при загрузке страницы
  useEffect(() => {
    const telegramInitData = window?.Telegram?.WebApp?.initData || ''
    if (telegramInitData) {
      // Подписываемся на канал chats
      wsClient.send({ ch: 'chats', t: 'subscribe', data: {} })
      console.log('[CHAT LIST] Subscribed to chats channel')
      
      return () => {
        // Отписываемся при размонтировании
        wsClient.send({ ch: 'chats', t: 'unsubscribe', data: {} })
        console.log('[CHAT LIST] Unsubscribed from chats channel')
      }
    }
  }, [])

  // Состояния для отображения UI
  const showEmptyState = themeList.length === 0 && !isLoading && !isInitialLoading
  const showErrorState = errorState && themeList.length === 0

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Заголовок */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--color-fg)] flex items-center gap-2">
            <RiMessage3Line size={24} className="text-[var(--color-accent)]" />
            Сообщения
          </h1>
          <button 
            onClick={() => void refreshThemeList()}
            className="p-2 rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors"
            disabled={isLoading}
          >
            <RiRefreshLine 
              size={20} 
              className={`text-[var(--color-fg)] ${isLoading ? 'animate-spin' : ''}`} 
            />
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="py-4 pb-20">
        {/* Состояние пустого списка */}
        {showEmptyState && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
              <RiMessage3Line size={32} className="text-[var(--color-accent)]" />
            </div>
            <div className="text-lg font-medium text-[var(--color-fg)] mb-2">
              Пока нет сообщений
            </div>
            <div className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] mb-6">
              Начните смотреть анкеты, чтобы появились мэтчи
            </div>
            <div className="flex items-center justify-center gap-3">
              <button 
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[color-mix(in_oklab,var(--color-accent)90%,black)] transition-colors flex items-center gap-2"
                onClick={() => void refreshThemeList()}
              >
                <RiRefreshLine size={16} />
                Обновить
              </button>
              <NavLink 
                to="/explore" 
                className="px-4 py-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] text-[var(--color-fg)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)90%,var(--color-accent)10%)] transition-colors flex items-center gap-2"
              >
                <RiHeartLine size={16} />
                Листать анкеты
              </NavLink>
            </div>
          </div>
        )}

        {/* Состояние ошибки */}
        {showErrorState && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <RiMessage3Line size={32} className="text-red-500" />
            </div>
            <div className="text-lg font-medium text-[var(--color-fg)] mb-2">
              Ошибка загрузки
            </div>
            <div className="text-sm text-red-500 mb-6">
              {errorState}
            </div>
            <div className="flex items-center justify-center gap-3">
              <button 
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[color-mix(in_oklab,var(--color-accent)90%,black)] transition-colors"
                onClick={() => void loadMoreThemes()}
              >
                Повторить
              </button>
              <button 
                className="px-4 py-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] text-[var(--color-fg)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)90%,var(--color-accent)10%)] transition-colors"
                onClick={() => void refreshThemeList()}
              >
                Обновить
              </button>
            </div>
          </div>
        )}

        {/* Компонент архива */}
        {archiveData && archiveData.messageCount > 0 && (
          <div className="mb-4">
            <NavLink
              to="/archive"
              className="flex items-center gap-3 p-3 rounded-lg bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] hover:bg-[color-mix(in_oklab,var(--color-bg)90%,var(--color-accent)10%)] transition-colors"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
                <div className="w-full h-full bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[var(--color-accent)]">
                    <path d="M21 8C21 7.45 20.55 7 20 7H4C3.45 7 3 7.45 3 8V10C3 10.55 3.45 11 4 11H20C20.55 11 21 10.55 21 10V8Z" fill="currentColor"/>
                    <path d="M4 13H20V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V13Z" fill="currentColor"/>
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-base">Архив</div>
                <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] truncate">
                  {archiveData.messageCount} сообщений
                </p>
              </div>
              <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">
                {truncateArchiveChatList(archiveData.chatTitles)}
              </div>
            </NavLink>
          </div>
        )}

          {/* Список чатов */}
          {themeList.map((chat, index) => {
            const isSwipeActive = swipeState.chatId === chat.id && swipeState.isSwipeActive
            const translateX = isSwipeActive ? swipeState.translateX : 0
            const isLastChat = index === themeList.length - 1
            
            return (
              <div key={chat.id}>
                <div
                  className="relative overflow-hidden"
                >
              {/* Цветной блок для swipe-действия (под карточкой) */}
              <div 
                className="absolute inset-0 bg-[var(--color-accent)] flex items-center justify-start pl-4"
                style={{ 
                  transform: `translateX(${Math.min(0, 80 - translateX)}px)`,
                  opacity: translateX > 20 ? Math.min(1, (translateX - 20) / 40) : 0
                }}
              >
                <div className="relative w-full h-full">
                  {lotteryAnimation.chatId === chat.id && lotteryAnimation.isAnimating && (
                    <div 
                      className="absolute"
                      style={{ 
                        right: '25px', // pr-4 = 16px
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}
                    >
                      <Lottie 
                        animationData={chatAnim} 
                        autoplay 
                        loop={false}
                        style={{ width: 28, height: 28 }} 
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Основной контент чата с фоном */}
              <div
                className="flex items-center gap-3 py-3 bg-[var(--color-bg)] hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-all duration-300 ease-out cursor-pointer relative z-10"
                style={{ transform: `translateX(-${translateX}px)` }}
                onClick={() => {
                  // TODO: Добавить функциональность открытия чата
                  console.log('Chat clicked:', chat.id)
                }}
                onTouchStart={(e) => {
                  const touch = e.touches[0]
                  if (touch) handleSwipeStart(chat.id, touch.clientX)
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0]
                  if (touch) handleSwipeMove(chat.id, touch.clientX)
                }}
                onTouchEnd={(e) => {
                  const touch = e.changedTouches[0]
                  if (touch) handleSwipeEnd(chat.id, touch.clientX)
                }}
              >
            {/* Аватар пользователя */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center relative ml-4">
              {chat.avatarUrl ? (
                <img 
                  src={chat.avatarUrl} 
                  alt={chat.title ?? 'Аватар пользователя'} 
                  className="w-full h-full object-cover rounded-full" 
                />
              ) : (
                <div className="w-full h-full bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center rounded-full">
                  <span className="text-sm font-medium text-[var(--color-accent)]">
                    {chat.title?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              {/* Индикатор онлайн статуса - показываем только если пользователь онлайн */}
              {chat.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[var(--color-bg)] rounded-full"></div>
              )}
            </div>

            {/* Информация о чате */}
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-center justify-between mb-1">
                <div className={`font-medium text-base truncate ${chat.unreadCount > 0 ? 'font-bold' : ''}`}>
                  {chat.title || 'Без названия'}
                </div>
                <div className="flex items-center gap-2">
                  {chat.unreadCount > 0 && (
                    <div className="bg-[var(--color-accent)] text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-2 font-medium">
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </div>
                  )}
                  {chat.message.time && (
                    <p className="text-xs text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] whitespace-nowrap">
                      {formatChatTimestamp(chat.message.time)}
                    </p>
                  )}
                </div>
              </div>
              <p className={`text-sm truncate ${chat.unreadCount > 0 ? 'text-[var(--color-fg)] font-medium' : 'text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]'}`}>
                {localStorage.getItem(`chat_${chat.id}_Draft`) ? (
                  <>
                    <span className="text-red-500">Черновик:</span>{' '}
                    {localStorage.getItem(`chat_${chat.id}_Draft`)}
                  </>
                ) : (
                  chat.message.last || 'Отправьте первое сообщение в чат'
                )}
              </p>
            </div>
              </div>
            </div>
            
            {/* Разделительная линия между чатами */}
            {!isLastChat && (
              <div className="ml-16 border-b border-[var(--color-border)] opacity-10"></div>
            )}
          </div>
          )
        })}

        {/* Индикатор загрузки */}
        {(isLoading || isInitialLoading) && (
          <div className="text-center py-4">
            <div className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] flex items-center justify-center gap-2">
              <RiRefreshLine size={16} className="animate-spin" />
              Загрузка…
            </div>
          </div>
        )}

        {/* Кнопка загрузки еще */}
        {paginationCursor && !isLoading && !isInitialLoading && (
          <div className="text-center py-4">
            <button 
              onClick={() => void loadMoreThemes()}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] text-[var(--color-fg)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)90%,var(--color-accent)10%)] transition-colors"
            >
              Загрузить еще
            </button>
          </div>
        )}
      </div>
    </div>
  )
}