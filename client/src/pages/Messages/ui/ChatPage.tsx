import type { JSX, CSSProperties } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import { fetchChatMessages, type ChatMessageItem, type ChatInfo } from '@/shared/api/messages'
import { wsClient } from '@/shared/lib/ws'
import { z } from 'zod'
import styles from './ChatPage.module.scss'

export default function ChatPage(): JSX.Element {
  const { chatId } = useParams<{ chatId: string }>()
  const navigate = useNavigate()
  const { user } = useTelegramAuth()
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null)
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [messageText, setMessageText] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Подключаем WS
  useEffect(() => {
    const initData = window?.Telegram?.WebApp?.initData || ''
    if (initData) wsClient.connect(initData)
  }, [])



  // Получаем сообщения (HTTP) для первичной загрузки; шапку получаем по WS
  useEffect(() => {
    if (!chatId) return

    const loadChatData = async () => {
      try {
        setLoading(true)
        setError(null)
        const initData = window?.Telegram?.WebApp?.initData || ''

        // Сообщения чата
        const messagesResp = await fetchChatMessages(initData, chatId)
        setMessages(messagesResp.items)
      } catch (error) {
        console.error('Ошибка загрузки чата:', error)
        setError(error instanceof Error ? error.message : 'Ошибка загрузки чата')
      } finally {
        setLoading(false)
      }
    }

    void loadChatData()
  }, [chatId])

  // Подписка на чат через WS + обработка событий chat_info / presence / message
  useEffect(() => {
    if (!chatId) return

    const ChatInfoWs = z.object({
      id: z.string(),
      title: z.string(),
      avatarUrl: z.string().nullable(),
      isOnline: z.boolean(),
    })
    const PresenceWs = z.object({ chatId: z.string(), userId: z.string(), isOnline: z.boolean() })
    const MessageWs = z.object({
      id: z.string(),
      chatId: z.string(),
      senderId: z.string(),
      text: z.string().optional().nullable(),
      photoUrl: z.string().nullable().optional(),
      createdAt: z.string(),
    })

    const unsubscribe = wsClient.on((msg) => {
      if (msg.ch !== 'messages') return
      if (msg.t === 'chat_info') {
        const parsed = ChatInfoWs.safeParse(msg.data)
        if (parsed.success && parsed.data.id === chatId) {
          setChatInfo(prev => ({ ...prev, ...parsed.data }))
        }
      } else if (msg.t === 'presence') {
        const parsed = PresenceWs.safeParse(msg.data)
        if (parsed.success && parsed.data.chatId === chatId) {
          setChatInfo(prev => prev ? { ...prev, isOnline: parsed.data.isOnline } : prev)
        }
      } else if (msg.t === 'message') {
        const parsed = MessageWs.safeParse(msg.data)
        if (parsed.success && parsed.data.chatId === chatId) {
          const it: ChatMessageItem = {
            id: parsed.data.id,
            senderId: parsed.data.senderId,
            text: parsed.data.text ?? '',
            photoUrl: parsed.data.photoUrl ?? null,
            createdAt: parsed.data.createdAt,
          }
          setMessages(prev => [...prev, it])
        }
      }
    })

    // Отправляем subscribe (автоматически уйдет после установления соединения)
    wsClient.send({ ch: 'messages', t: 'subscribe', data: { chatId } })

    return () => {
      unsubscribe()
      wsClient.send({ ch: 'messages', t: 'unsubscribe', data: { chatId } })
    }
  }, [chatId])

  const patternUrl = `${import.meta.env.BASE_URL || '/'}pattern.svg`
  type CSSVars = { 
    ['--pattern-url']?: string; 
    ['--pattern-color']?: string; 
    ['--pattern-size']?: string 
  }
  
  const style: CSSProperties & CSSVars = {
    ['--pattern-url']: `url('${patternUrl}')`,
    ['--pattern-color']: 'var(--color-accent)',
    ['--pattern-size']: '340px auto'
  }

  const handleBack = () => {
    navigate('/messages')
  }

  const handleMore = () => {
    // TODO: Добавить меню действий
    console.log('More actions')
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    const text = messageText.trim()
    if (!text || !chatId) return
    
    // Отправляем через WebSocket
    wsClient.send({
      ch: 'messages',
      t: 'send',
      data: {
        chatId,
        text
      }
    })
    
    setMessageText('')
  }

  // Функция для группировки сообщений
  const groupMessages = (messages: ChatMessageItem[]) => {
    const groups: ChatMessageItem[][] = []
    let currentGroup: ChatMessageItem[] = []
    
    messages.forEach((message, index) => {
      if (index === 0) {
        currentGroup = [message]
      } else {
        const prevMessage = messages[index - 1]
        if (prevMessage) {
          const timeDiff = Math.abs(
            new Date(message.createdAt).getTime() - 
            new Date(prevMessage.createdAt).getTime()
          )
          const isSameSender = message.senderId === prevMessage.senderId
          const isWithinTimeLimit = timeDiff < 2 * 60 * 1000 // 2 минуты в миллисекундах
          
          if (isSameSender && isWithinTimeLimit) {
            currentGroup.push(message)
          } else {
            if (currentGroup.length > 0) {
              groups.push(currentGroup)
            }
            currentGroup = [message]
          }
        } else {
          currentGroup = [message]
        }
      }
    })
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }
    
    return groups
  }

  // Группировка по датам для разделителей типа Сегодня / Вчера / 18 августа
  const getDateKey = (dateString: string): string => {
    const d = new Date(dateString)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatDateLabel = (dateInput: string | Date): string => {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    const now = new Date()

    const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
    const diffMs = startOfDay(now).getTime() - startOfDay(d).getTime()
    const oneDay = 24 * 60 * 60 * 1000

    if (diffMs === 0) return 'Сегодня'
    if (diffMs === oneDay) return 'Вчера'

    const label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    return label
  }

  type DateGroup = { dateKey: string, label: string, items: ChatMessageItem[] }
  const groupMessagesByDate = (items: ChatMessageItem[]): DateGroup[] => {
    const result: DateGroup[] = []
    let currentKey: string | null = null
    let currentGroup: ChatMessageItem[] = []

    for (const msg of items) {
      const key = getDateKey(msg.createdAt)
      if (currentKey === null) {
        currentKey = key
        currentGroup = [msg]
      } else if (key === currentKey) {
        currentGroup.push(msg)
      } else {
        const ck = currentKey as string
        const [yearStr, monthStr, dayStr] = ck.split('-') as [string, string, string]
        const yearNum = Number(yearStr)
        const monthNum = Number(monthStr || '1')
        const dayNum = Number(dayStr || '1')
        const label = formatDateLabel(new Date(yearNum, monthNum - 1, dayNum))
        result.push({ dateKey: ck, label, items: currentGroup })
        currentKey = key
        currentGroup = [msg]
      }
    }

    if (currentKey !== null && currentGroup.length > 0) {
      const ck = currentKey
      const [yearStr, monthStr, dayStr] = ck.split('-') as [string, string, string]
      const yearNum = Number(yearStr)
      const monthNum = Number(monthStr || '1')
      const dayNum = Number(dayStr || '1')
      const label = formatDateLabel(new Date(yearNum, monthNum - 1, dayNum))
      result.push({ dateKey: ck, label, items: currentGroup })
    }

    return result
  }

  const handleRetry = () => {
    if (chatId) {
      setLoading(true)
      setError(null)
      // Перезагружаем данные
      const loadChatData = async () => {
        try {
          const initData = window?.Telegram?.WebApp?.initData || ''
          const messagesResp = await fetchChatMessages(initData, chatId)
          setMessages(messagesResp.items)
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Ошибка загрузки чата')
        } finally {
          setLoading(false)
        }
      }
      void loadChatData()
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={handleBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              <div className={styles.avatarPlaceholder} />
            </div>
            <div className={styles.userName}>Загрузка...</div>
          </div>
          <button className={styles.moreButton} onClick={handleMore}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="1" fill="currentColor"/>
              <circle cx="19" cy="12" r="1" fill="currentColor"/>
              <circle cx="5" cy="12" r="1" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div className={styles.patternFull} style={style} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={handleBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              <div className={styles.avatarPlaceholder} />
            </div>
            <div className={styles.userName}>Ошибка</div>
          </div>
          <button className={styles.moreButton} onClick={handleMore}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="1" fill="currentColor"/>
              <circle cx="19" cy="12" r="1" fill="currentColor"/>
              <circle cx="5" cy="12" r="1" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div className={styles.chatContent}>
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V13M12 17H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.errorTitle}>Ошибка загрузки</div>
            <div className={styles.errorMessage}>{error}</div>
            <button className={styles.retryButton} onClick={handleRetry}>
              Попробовать снова
            </button>
          </div>
        </div>
        <div className={styles.patternFull} style={style} />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={handleBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {chatInfo?.avatarUrl ? (
              <img src={chatInfo.avatarUrl} alt={chatInfo.title} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
          <div className={styles.userName}>
            {chatInfo?.title || 'Неизвестный пользователь'}
            {chatInfo?.isOnline && <span className={styles.onlineIndicator} />}
          </div>
        </div>
        <button className={styles.moreButton} onClick={handleMore}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="1" fill="currentColor"/>
            <circle cx="19" cy="12" r="1" fill="currentColor"/>
            <circle cx="5" cy="12" r="1" fill="currentColor"/>
          </svg>
        </button>
      </div>
      
      {/* Показываем сообщения или заглушку */}
      <div className={styles.chatContent}>
        {messages.length === 0 ? (
          <div className={styles.emptyChat}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.emptyTitle}>Начните разговор</div>
            <div className={styles.emptySubtitle}>Отправьте первое сообщение, чтобы начать общение</div>
          </div>
        ) : (
          <div className={styles.messagesList}>
            {groupMessagesByDate(messages).map((dateGroup) => (
              <div key={dateGroup.dateKey} className={styles.dateGroup}>
                <div className={styles.dateDivider}>{dateGroup.label}</div>
                {groupMessages(dateGroup.items).map((group, groupIndex) => (
                  <div key={groupIndex} className={styles.messageGroup}>
                    {group.map((message, messageIndex) => {
                      const isOwn = message.senderId === user?.id?.toString();
                      const isFirst = messageIndex === 0;
                      const isLast = messageIndex === group.length - 1;
                      const isMiddle = !isFirst && !isLast;
                      const isSingle = group.length === 1; // Одиночное сообщение
                      
                      return (
                        <div 
                          key={message.id} 
                          className={`${styles.message} ${isOwn ? styles.ownMessage : styles.otherMessage} ${
                            isSingle ? styles.messageSingle :
                            isFirst ? styles.messageFirst : 
                            isLast ? styles.messageLast : 
                            styles.messageMiddle
                          }`}
                        >
                          <div className={styles.messageContent}>
                            {message.photoUrl && (
                              <img src={message.photoUrl} alt="Фото" className={styles.messagePhoto} />
                            )}
                            {message.text ? (
                              <div className={styles.messageTextContainer}>
                                <span className={styles.messageText}>
                                  <span className={styles.messageTextInner}>{message.text}</span>
                                  <span className={styles.messageTime}>
                                    {new Date(message.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <div className={styles.messageTimeOnly}>
                                <span className={styles.messageTime}>
                                  {new Date(message.createdAt).toLocaleTimeString('ru-RU', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer fixed at bottom */}
      <div className={styles.composer}>
        <div className={styles.composerInner}>
          <div className={styles.inputWrapper}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              placeholder="Сообщение"
              value={messageText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />
          </div>
          <button className={styles.sendButton} aria-label="Отправить" onClick={handleSend} disabled={!messageText.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.patternFull} style={style} />
    </div>
  )
}
