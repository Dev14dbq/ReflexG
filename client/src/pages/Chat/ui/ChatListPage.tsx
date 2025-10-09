import { useEffect, useRef, useState, type JSX } from 'react'
import { NavLink } from 'react-router-dom'

import { fetchChats, type ChatListItem } from '@/shared/api/chat'
import { chatStore } from '@/shared/lib/chatStore'

export default function ChatListPage(): JSX.Element {
  // Состояние списка чатов
  const [chatList, setChatList] = useState<ChatListItem[]>(chatStore.getState().items)
  const [paginationCursor, setPaginationCursor] = useState<string | undefined>(chatStore.getState().cursor)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [errorState, setErrorState] = useState<string | null>(null)
  
  // Рефы для бесконечной прокрутки и отслеживания дубликатов
  const infiniteScrollRef = useRef<HTMLDivElement | null>(null)
  const loadedChatIdsRef = useRef<Set<string>>(new Set(chatStore.getState().items.map(item => item.id)))

  /* Загрузка дополнительных чатов (пагинация) */
  async function loadMoreChats(): Promise<void> {
    if (isLoading) return
    setIsLoading(true)

    try {
      const telegramInitData = window?.Telegram?.WebApp?.initData || ''
      const response = await fetchChats(telegramInitData, paginationCursor, 20)
      
      // Фильтруем дубликаты
      const uniqueChats = response.items.filter(chat => !loadedChatIdsRef.current.has(chat.id))
      uniqueChats.forEach(chat => loadedChatIdsRef.current.add(chat.id))
      
      if (paginationCursor) {
        // Добавляем к существующим чатам
        setChatList(prev => [...prev, ...uniqueChats])
        chatStore.appendItems(uniqueChats, response.nextCursor)
      } else {
        // Заменяем все чаты (первая загрузка)
        setChatList(uniqueChats)
        chatStore.setItems(uniqueChats, response.nextCursor)
      }
      
      setPaginationCursor(response.nextCursor)
    } catch (error) {
      setErrorState(error instanceof Error ? error.message : 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }

  /* Обновление списка чатов (очистка кэша и перезагрузка) */
  async function refreshChatList(): Promise<void> {
    // Очищаем кэш и перезагружаем данные
    chatStore.clear()
    setChatList([])
    setPaginationCursor(undefined)
    loadedChatIdsRef.current.clear()
    setErrorState(null)
    await loadMoreChats()
  }

  /* Подписка на изменения в store и первичная загрузка */
  useEffect(() => {
    const unsubscribe = chatStore.subscribe((state) => {
      setChatList(state.items)
      setPaginationCursor(state.cursor)
    })
    
    // Загружаем данные только если кэш пуст или устарел
    const cachedState = chatStore.getState()
    if (cachedState.items.length === 0 || chatStore.isStale()) {
      ;(async () => {
        setIsInitialLoading(true)
        try {
          await loadMoreChats()
        } finally {
          setIsInitialLoading(false)
        }
      })()
    }
    
    return unsubscribe
  }, [])

  /* Обновление данных при фокусе на странице */
  useEffect(() => {
    let lastFocusTime = 0
    
    const handleFocus = () => {
      const now = Date.now()
      // Обновляем данные только если прошло больше 30 секунд с последнего фокуса
      if (now - lastFocusTime > 30000) {
        // Принудительно обновляем данные при фокусе на странице
        void refreshChatList()
        lastFocusTime = now
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  /* Настройка бесконечной прокрутки */
  useEffect(() => {
    const sentinelElement = infiniteScrollRef.current
    if (!sentinelElement) return
    
    const intersectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && paginationCursor && !isLoading) {
          void loadMoreChats()
        }
      })
    })
    
    intersectionObserver.observe(sentinelElement)
    return () => intersectionObserver.disconnect()
  }, [paginationCursor, isLoading])

  /* Форматирование даты или времени для отображения */
  function formatChatTimestamp(timestamp: string): string {
    const messageDate = new Date(timestamp)
    const currentDate = new Date()
  
    // Компоненты текущей даты
    const currentDateComponents = {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth(),
      day: currentDate.getDate()
    }
  
    const messageYear = messageDate.getFullYear()
    const messageMonth = messageDate.getMonth()
    const messageDay = messageDate.getDate()
  
    // Проверяем, является ли дата сегодняшней
    const isToday = 
      currentDateComponents.year === messageYear &&
      currentDateComponents.month === messageMonth &&
      currentDateComponents.day === messageDay
  
    if (isToday) {
      return messageDate.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } else {
      const day = messageDay.toString().padStart(2, '0')
      const month = (messageMonth + 1).toString().padStart(2, '0')
      return `${day}.${month}`
    }
  }

  // Состояния для отображения UI
  const showEmptyState = chatList.length === 0 && !isLoading && !isInitialLoading
  const showErrorState = errorState && chatList.length === 0

  return (
    <div className="max-w-md mx-auto">
      {/* Основной контент */}
      <div className="p-4">
        {/* Состояние пустого списка чатов */}
        {showEmptyState && (
          <div className="text-center py-16">
            <div className="text-sm text-muted">
              У вас пока что нет чатов. Начните смотреть анкеты, чтобы появились мэтчи.
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button className="btn" onClick={() => void refreshChatList()}>
                Обновить
              </button>
              <NavLink to="/explore" className="btn btn-primary inline-flex">
                Листать анкеты
              </NavLink>
            </div>
          </div>
        )}

        {/* Состояние ошибки */}
        {showErrorState && (
          <div className="text-center py-16">
            <div className="text-sm text-muted">
              Ошибка загрузки: {errorState}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button className="btn" onClick={() => void loadMoreChats()}>
                Повторить
              </button>
              <button className="btn" onClick={() => void refreshChatList()}>
                Обновить
              </button>
              <NavLink to="/explore" className="btn btn-primary inline-flex">
                Листать анкеты
              </NavLink>
            </div>
          </div>
        )}

        {/* Список чатов */}
        {chatList.map(chat => (
          <NavLink
            to={`/chat/${encodeURIComponent(chat.id)}`}
            key={chat.id}
            className="flex items-center gap-3 py-2"
          >
            {/* Аватар пользователя */}
            <div className="w-12 h-12 rounded-full border border-accent overflow-hidden flex items-center justify-center">
              {chat.avatarUrl ? (
                <img 
                  src={chat.avatarUrl} 
                  alt={chat.title ?? 'Аватар пользователя'} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="text-sm text-muted">No</div>
              )}
            </div>

            {/* Информация о чате */}
            <div className="flex items-center justify-between w-[80%]"> 
              {/* Левая часть: имя и последнее сообщение */}
              <div className="flex-1 pr-2">
                <div className="font-medium truncate">{chat.title}</div>
                <p className="text-sm text-muted truncate">
                  {
                    localStorage.getItem(`chat_${chat.id}_Draft`) ? (
                      <>
                        <span className="text-red-500">Черновик:</span>{' '}
                        {localStorage.getItem(`chat_${chat.id}_Draft`)}
                      </>
                    ) : (
                      chat.message.last ?? 'Отправьте первое сообщение в чат'
                    )
                  }
                </p>
              </div>
              
              {/* Правая часть: время последнего сообщения */}
              {chat.message.time && (
                <div className="flex-shrink-0 ml-2">
                  <p className="text-sm text-muted">
                    {formatChatTimestamp(chat.message.time)}
                  </p>
                </div>
              )}
            </div>
          </NavLink>
        ))}

        {/* Индикатор ошибки */}
        {errorState && (
          <div className="text-sm text-red-500 mt-2">{errorState}</div>
        )}

        {/* Элемент для бесконечной прокрутки */}
        <div ref={infiniteScrollRef} className="h-6" />
        
        {/* Индикатор загрузки */}
        {(isLoading || isInitialLoading) && (
          <div className="text-sm text-muted">Загрузка…</div>
        )}
      </div>
    </div>
  )
}
