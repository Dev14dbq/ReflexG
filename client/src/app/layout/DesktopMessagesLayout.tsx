import type { JSX } from 'react'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { NavLink } from 'react-router-dom'

import { fetchChats, type ChatListItem, fetchArchiveData } from '@/shared/api/chat'
import { chatStore } from '@/shared/lib/chatStore'
import ThemePage from '@/pages/Theme/ui/ThemePage'
import DesktopThemePage from '@/pages/Theme/ui/DesktopThemePage'

export default function DesktopMessagesLayout(): JSX.Element {
  const { chatId } = useParams<{ chatId?: string }>()
  const navigate = useNavigate()
  
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

  // Если нет выбранного чата, но есть чаты в списке, выбираем первый
  useEffect(() => {
    if (!chatId && themeList.length > 0 && themeList[0]) {
      navigate(`/theme/${encodeURIComponent(themeList[0].id)}`, { replace: true })
    }
  }, [chatId, themeList, navigate])

  // Состояния для отображения UI
  const showEmptyState = themeList.length === 0 && !isLoading && !isInitialLoading
  const showErrorState = errorState && themeList.length === 0

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
      
      if (paginationCursor) {
        setThemeList(prev => [...prev, ...response.items])
        chatStore.appendItems(response.items, response.nextCursor)
      } else {
        setThemeList(response.items)
        chatStore.setItems(response.items, response.nextCursor)
      }
      
      setPaginationCursor(response.nextCursor)
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

  // Если чат не выбран, показываем только список
  return (
    <div className="h-full flex">
      {/* Левая панель - список чатов */}
      <div className="w-80 border-r border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] bg-[var(--color-bg)]">
        <div className="h-full overflow-y-auto">
          <div className="p-4">
            {/* Заголовок */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-fg)]">Сообщения</h2>
            </div>

            {/* Состояние пустого списка */}
            {showEmptyState && (
              <div className="text-center py-16">
                <div className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">
                  У вас пока что нет тем. Начните смотреть анкеты, чтобы появились мэтчи.
                </div>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button 
                    className="px-3 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[color-mix(in_oklab,var(--color-accent)90%,black)] transition-colors"
                    onClick={() => void refreshThemeList()}
                  >
                    Обновить
                  </button>
                  <NavLink 
                    to="/explore" 
                    className="px-3 py-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] text-[var(--color-fg)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)90%,var(--color-accent)10%)] transition-colors"
                  >
                    Листать анкеты
                  </NavLink>
                </div>
              </div>
            )}

            {/* Состояние ошибки */}
            {showErrorState && (
              <div className="text-center py-16">
                <div className="text-sm text-red-500 mb-4">
                  Ошибка загрузки: {errorState}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button 
                    className="px-3 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[color-mix(in_oklab,var(--color-accent)90%,black)] transition-colors"
                    onClick={() => void loadMoreThemes()}
                  >
                    Повторить
                  </button>
                  <button 
                    className="px-3 py-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] text-[var(--color-fg)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)90%,var(--color-accent)10%)] transition-colors"
                    onClick={() => void refreshThemeList()}
                  >
                    Обновить
                  </button>
                </div>
              </div>
            )}

            {/* Компонент архива */}
            {archiveData && archiveData.messageCount > 0 && (
              <div className="flex items-center gap-3 py-2 overflow-hidden mb-2">
                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
                  <div className="w-full h-full bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[var(--color-accent)]">
                      <path d="M21 8C21 7.45 20.55 7 20 7H4C3.45 7 3 7.45 3 8V10C3 10.55 3.45 11 4 11H20C20.55 11 21 10.55 21 10V8Z" fill="currentColor"/>
                      <path d="M4 13H20V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V13Z" fill="currentColor"/>
                    </svg>
                  </div>
                </div>
                <div className="flex-1 pr-2 overflow-hidden">
                  <div className="font-medium text-sm">Архив</div>
                  <p className="text-xs text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] truncate">
                    {archiveData.messageCount} сообщений
                  </p>
                </div>
              </div>
            )}

            {/* Список чатов */}
            {themeList.map(chat => (
              <NavLink
                to={`/theme/${encodeURIComponent(chat.id)}`}
                key={chat.id}
                className={`flex items-center gap-3 py-2 px-2 rounded-lg transition-colors ${
                  chatId === chat.id 
                    ? 'bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)]' 
                    : 'hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)]'
                }`}
              >
                {/* Аватар пользователя */}
                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
                  {chat.avatarUrl ? (
                    <img 
                      src={chat.avatarUrl} 
                      alt={chat.title ?? 'Аватар пользователя'} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">No</div>
                  )}
                </div>

                {/* Информация о чате */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className={`font-medium text-sm truncate ${chat.unreadCount > 0 ? 'font-bold' : ''}`}>
                      {chat.title}
                    </div>
                    <div className="flex items-center gap-1">
                      {chat.unreadCount > 0 && (
                        <div className="bg-[var(--color-accent)] text-white text-xs rounded-full min-w-[18px] h-4 flex items-center justify-center px-1 font-medium">
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </div>
                      )}
                      {chat.message.time && (
                        <p className="text-xs text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">
                          {formatChatTimestamp(chat.message.time)}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className={`text-xs truncate ${chat.unreadCount > 0 ? 'text-[var(--color-fg)] font-medium' : 'text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]'}`}>
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
              </NavLink>
            ))}

            {/* Индикатор загрузки */}
            {(isLoading || isInitialLoading) && (
              <div className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)] mt-2">Загрузка…</div>
            )}
          </div>
        </div>
      </div>

      {/* Правая панель - чат или пустое состояние */}
      <div className="flex-1">
        {chatId ? (
          <DesktopThemePage />
        ) : (
          <div className="h-full flex justify-center items-center">
            <div className="text-center">
              <div className="text-lg font-medium text-[var(--color-fg)] mb-2">
                Выберите чат для начала общения
              </div>
              <div className="text-sm text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]">
                Все ваши сообщения будут отображаться здесь
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
