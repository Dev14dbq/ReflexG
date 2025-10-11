import { useEffect, useRef, useState, type JSX } from 'react'
import { NavLink } from 'react-router-dom'

import { fetchChats, type ChatListItem, fetchArchiveData } from '@/shared/api/chat'
import { chatStore } from '@/shared/lib/chatStore'

export default function ThemeListPage(): JSX.Element {
  // Состояние списка тем
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
  
  // Рефы для бесконечной прокрутки и отслеживания дубликатов
  const infiniteScrollRef = useRef<HTMLDivElement | null>(null)
  const loadedChatIdsRef = useRef<Set<string>>(new Set(chatStore.getState().items.map(item => item.id)))

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
          await Promise.all([
            loadMoreThemes(),
            loadArchiveData()
          ])
        } finally {
          setIsInitialLoading(false)
        }
      })()
    } else {
      // Загружаем данные архива даже если кэш актуален
      loadArchiveData()
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

  /* Функция для обрезки списка чатов в архиве */
  function truncateArchiveChatList(chatTitles: string[], maxLength = 50): string {
    if (chatTitles.length === 0) return ''
    
    let result = chatTitles.join(', ')
    if (result.length <= maxLength) return result
    
    // Обрезаем до максимальной длины
    result = result.substring(0, maxLength)
    
    // Находим последнюю запятую и обрезаем там
    const lastCommaIndex = result.lastIndexOf(',')
    if (lastCommaIndex > 0) {
      result = result.substring(0, lastCommaIndex)
    }
    
    // Добавляем многоточие если есть еще чаты
    if (chatTitles.length > 1) {
      result += '...'
    }
    
    return result
  }

  // Состояния для отображения UI
  const showEmptyState = themeList.length === 0 && !isLoading && !isInitialLoading
  const showErrorState = errorState && themeList.length === 0

  return (
    <div className="max-w-md mx-auto overflow-hidden">
      {/* Основной контент */}
      <div className="p-4">
        {/* Состояние пустого списка тем */}
        {showEmptyState && (
          <div className="text-center py-16">
            <div className="text-sm text-muted">
              У вас пока что нет тем. Начните смотреть анкеты, чтобы появились мэтчи.
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button className="btn" onClick={() => void refreshThemeList()}>
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
              <button className="btn" onClick={() => void loadMoreThemes()}>
                Повторить
              </button>
              <button className="btn" onClick={() => void refreshThemeList()}>
                Обновить
              </button>
              <NavLink to="/explore" className="btn btn-primary inline-flex">
                Листать анкеты
              </NavLink>
            </div>
          </div>
        )}

        {/* Компонент архива */}
        {archiveData && archiveData.messageCount > 0 && (
          <div className="flex items-center gap-3 py-2 overflow-hidden">
            {/* Иконка архива */}
            <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
              <div className="w-full h-full bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[var(--color-accent)]">
                  <path d="M21 8C21 7.45 20.55 7 20 7H4C3.45 7 3 7.45 3 8V10C3 10.55 3.45 11 4 11H20C20.55 11 21 10.55 21 10V8Z" fill="currentColor"/>
                  <path d="M4 13H20V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V13Z" fill="currentColor"/>
                </svg>
              </div>
            </div>

            {/* Информация об архиве */}
            <div className="flex items-center justify-between w-[80%] overflow-hidden"> 
              <div className="flex-1 pr-2 overflow-hidden">
                <div className="font-medium flex justify-between items-center">
                  <div className="truncate flex-1 mr-2">Архив</div>
                </div>

                <p className="text-sm text-muted truncate">
                  <span className="inline-block truncate w-full">
                    <span>{archiveData.messageCount} сообщений в архиве</span>
                    {archiveData.chatTitles.length > 0 && (
                      <>
                        <br />
                        <span className="truncate">{truncateArchiveChatList(archiveData.chatTitles)}</span>
                      </>
                    )}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Список тем */}
        {themeList.map(chat => (
          <NavLink
            to={`/theme/${encodeURIComponent(chat.id)}`}
            key={chat.id}
            className="flex items-center gap-3 py-2 overflow-hidden"
          >
            {/* Аватар пользователя */}
            <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
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
            <div className="flex items-center justify-between w-[80%] overflow-hidden"> 
              <div className="flex-1 pr-2 overflow-hidden">
                <div className={`font-medium flex justify-between items-center ${chat.unreadCount > 0 ? 'font-bold' : ''}`}>
                  <div className="truncate flex-1 mr-2">{chat.title}</div>
                  
                  <div className="flex items-center gap-2">
                    {chat.unreadCount > 0 && (
                      <div className="bg-[var(--color-accent)] text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-2 font-medium">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </div>
                    )}
                    
                    {chat.message.time && (
                      <p className="text-sm text-muted ml-1" style={{ marginLeft: '5px' }}>
                        {formatChatTimestamp(chat.message.time)}
                      </p>
                    )}
                  </div>
                </div>

                <p className={`text-sm truncate ${chat.unreadCount > 0 ? 'text-[var(--color-fg)] font-medium' : 'text-muted'}`}>
                  {
                    localStorage.getItem(`chat_${chat.id}_Draft`) ? (
                      <span className="inline-block truncate w-full">
                        <span className="text-red-500">Черновик:</span>{' '}
                        <span className="truncate">{localStorage.getItem(`chat_${chat.id}_Draft`)}</span>
                      </span>
                    ) : (
                      chat.message.last ?
                        truncateStringBasedOnScreenSize(chat.message.last)
                        : 'Отправьте первое сообщение в чат'
                    )
                  }
                </p>
              </div>
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
