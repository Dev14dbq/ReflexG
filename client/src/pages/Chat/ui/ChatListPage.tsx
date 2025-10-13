import { useEffect, useRef, useState, type JSX } from 'react'
import { NavLink } from 'react-router-dom'

import { fetchChats, type ChatListItem } from '@/shared/api/chat'
import { chatStore } from '@/shared/lib/chatStore'

export default function ChatListPage(): JSX.Element {
  // Состояние списка тем
  const [themeList, setThemeList] = useState<ChatListItem[]>(chatStore.getState().items)
  const [paginationCursor, setPaginationCursor] = useState<string | undefined>(chatStore.getState().cursor)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [errorState, setErrorState] = useState<string | null>(null)
  
  // Рефы для бесконечной прокрутки и отслеживания дубликатов
  const infiniteScrollRef = useRef<HTMLDivElement | null>(null)
  const loadedChatIdsRef = useRef<Set<string>>(new Set(chatStore.getState().items.map(item => item.id)))

  /* Загрузка дополнительных тем (пагинация) */
  async function loadMoreThemes(): Promise<void> {
    if (isLoading) return
    setIsLoading(true)

    try {
      const telegramInitData = window?.Telegram?.WebApp?.initData || ''
      const response = await fetchChats(telegramInitData, paginationCursor, 20)
      
      // Фильтруем дубликаты
      const uniqueThemes = response.items.filter(chat => !loadedChatIdsRef.current.has(chat.id))
      uniqueThemes.forEach(chat => loadedChatIdsRef.current.add(chat.id))
      
      if (paginationCursor) {
        // Добавляем к существующим темам
        setThemeList(prev => [...prev, ...uniqueThemes])
        chatStore.appendItems(uniqueThemes, response.nextCursor)
      } else {
        // Заменяем все темы (первая загрузка)
        setThemeList(uniqueThemes)
        chatStore.setItems(uniqueThemes, response.nextCursor)
      }
      
      setPaginationCursor(response.nextCursor)
    } catch (error) {
      setErrorState(error instanceof Error ? error.message : 'Возникла ошибка при загрузки тем!')
    } finally {
      setIsLoading(false)
    }
  }

  /* Обновление списка тем (очистка кэша и перезагрузка) */
  async function refreshThemeList(): Promise<void> {
    // Очищаем кэш и перезагружаем данные
    chatStore.clear()
    setThemeList([])
    setPaginationCursor(undefined)
    loadedChatIdsRef.current.clear()
    setErrorState(null)
    await loadMoreThemes()
  }

  /* Подписка на изменения в store и первичная загрузка */
  useEffect(() => {
    const unsubscribe = chatStore.subscribe((state) => {
      setThemeList(state.items)
      setPaginationCursor(state.cursor)
    })
    
    // Загружаем данные только если кэш пуст или устарел
    const cachedState = chatStore.getState()
    if (cachedState.items.length === 0 || chatStore.isStale()) {
      (async () => {
        setIsInitialLoading(true)
        try {
          await loadMoreThemes()
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
        void refreshThemeList()
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
          void loadMoreThemes()
        }
      })
    })
    
    intersectionObserver.observe(sentinelElement)
    return () => intersectionObserver.disconnect()
  }, [paginationCursor, isLoading])

  function truncateStringBasedOnScreenSize(str:string) {
    const width = window.innerWidth;
  
    let maxLength;
    if (width >= 1200) {
      maxLength = 60;
    } else if (width >= 768) {
      maxLength = 40;
    } else {
      maxLength = 23;
    }
  
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '...';
    }
    return str;
  }

  /* Форматирование даты или времени для отображения */
  function formatChatTimestamp(timestamp:string): string {    
    timestamp = timestamp + 'Z'
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

  // Состояния для отображения UI
  const showEmptyState = themeList.length === 0 && !isLoading && !isInitialLoading
  const showErrorState = errorState && themeList.length === 0

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Основной контент */}
      <div className="px-4 py-4 pb-20">
        {/* Состояние пустого списка тем */}
        {showEmptyState && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] rounded-full flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-fg)] mb-2">Нет чатов</h2>
            <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] mb-6">
              У вас пока что нет чатов. Начните смотреть анкеты, чтобы появились мэтчи.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button 
                className="px-4 py-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] text-[var(--color-fg)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)90%,var(--color-accent)10%)] transition-colors" 
                onClick={() => void refreshThemeList()}
              >
                Обновить
              </button>
              <NavLink 
                to="/explore" 
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[color-mix(in_oklab,var(--color-accent)90%,black)] transition-colors inline-flex items-center gap-2"
              >
                Листать анкеты
              </NavLink>
            </div>
          </div>
        )}

        {/* Состояние ошибки */}
        {showErrorState && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-fg)] mb-2">Ошибка загрузки</h2>
            <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] mb-6">
              {errorState}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button 
                className="px-4 py-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] text-[var(--color-fg)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)90%,var(--color-accent)10%)] transition-colors" 
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
              <NavLink 
                to="/explore" 
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[color-mix(in_oklab,var(--color-accent)90%,black)] transition-colors inline-flex items-center gap-2"
              >
                Листать анкеты
              </NavLink>
            </div>
          </div>
        )}

        {/* Список тем */}
        <div className="space-y-2">
          {themeList.map(chat => (
            <NavLink
              to={`/chat/${encodeURIComponent(chat.id)}`}
              key={chat.id}
              className="block p-3 rounded-xl bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                {/* Аватар пользователя */}
                <div className="relative">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-[color-mix(in_oklab,var(--color-bg)92%,var(--color-accent)8%)] shadow-sm">
                    {chat.avatarUrl ? (
                      <img 
                        src={chat.avatarUrl} 
                        alt={chat.title ?? 'Аватар пользователя'} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="text-lg text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] font-medium">No</div>
                    )}
                  </div>
                  
                  {/* Индикатор онлайн статуса */}
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[var(--color-bg)] shadow-sm"></div>
                </div>

                {/* Информация о чате */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-[var(--color-fg)] text-base truncate">
                      {chat.title}
                    </h3>
                    
                    {chat.message.time && (
                      <span className="text-xs text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] ml-2 flex-shrink-0">
                        {formatChatTimestamp(chat.message.time)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,transparent)] truncate flex-1">
                      {
                        localStorage.getItem(`chat_${chat.id}_Draft`) ? (
                          <>
                            <span className="text-[var(--color-accent)] font-medium">Черновик:</span>{' '}
                            {localStorage.getItem(`chat_${chat.id}_Draft`)}
                          </>
                        ) : (
                          chat.message.last ?
                            truncateStringBasedOnScreenSize(chat.message.last)
                            : 'Отправьте первое сообщение в чат'
                        )
                      }
                    </p>
                    
                    {/* Индикатор непрочитанных сообщений */}
                    {chat.unreadCount > 0 && (
                      <div className="ml-2 bg-[var(--color-accent)] text-white text-xs rounded-full min-w-[18px] h-4 flex items-center justify-center px-1.5 font-medium">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </NavLink>
          ))}
        </div>

        {/* Индикатор ошибки */}
        {errorState && (
          <div className="text-sm text-red-500 mt-2">{errorState}</div>
        )}

        {/* Элемент для бесконечной прокрутки */}
        <div ref={infiniteScrollRef} className="h-6" />
        
        {/* Индикатор загрузки */}
        {(isLoading || isInitialLoading) && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">Загрузка чатов...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
