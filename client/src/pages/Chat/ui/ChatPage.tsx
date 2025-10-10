import { useEffect, useRef, useState, type JSX } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { fetchChatMessages, type ChatMessageItem, ChatInfo } from '@/shared/api/chat'
import { fetchChatSettings, type settingsChatResponse } from '@/shared/api/settings'
import { MessageContextMenu } from '@/pages/Chat/ui/MessageContextMenu'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import { wsClient } from '@/shared/lib/ws'

import styles from './ChatPage.module.scss'
import { groupMessagesByDateAndTime } from '@/shared/lib/messageGrouping'

export default function ChatPage(): JSX.Element {
  const { chatId } = useParams<{ chatId: string }>()
  
  // Состояние чата
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([])
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null)
  const [wallpaper, setWallpaper] = useState<string>('love-tg')
  const [inputMessage, setInputMessage] = useState<string>('')
  const [errorState, setErrorState] = useState<string | null>(null)
  
  // Состояние контекстного меню
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    position: { x: number; y: number }
    messageId: string
    messageText: string
    isOwnMessage: boolean
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    messageId: '',
    messageText: '',
    isOwnMessage: false
  })
  
  // Рефы
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null)

  // Хуки навигации и авторизации
  const { user } = useTelegramAuth()

  /* Загрузка настроек чата (обои) */
  useEffect(() => {
    const loadChatSettings = async () => {
      const telegramInitData = window?.Telegram?.WebApp?.initData
      if(!telegramInitData) return

      const chatSettings:settingsChatResponse = await fetchChatSettings(telegramInitData)
      
      if (chatSettings) {
        setWallpaper(chatSettings.settings.topic!)
      }
    }

    loadChatSettings()
  }, [])

  const wallpaperStyle = {
    ['--pattern-color']: 'var(--color-accent)',
    ['--pattern-size']: '340px auto'
  }

  /* Загрузка истории сообщений при открытии чата */
  useEffect(() => {
    if (!chatId) return

    const loadMessageHistory = async () => {
      try {
        const telegramInitData = window?.Telegram?.WebApp?.initData
        if (!telegramInitData) return

        const messagesResponse = await fetchChatMessages(telegramInitData, chatId)
        setChatMessages(messagesResponse.items)
      } catch (error: any) {
        console.error('[Error] Chat history:', error)
        setErrorState(`Возникла проблема при загрузки сообщений. Подробнее см. в консоли! (При необходимости обратитесь в поддержку)`)
      }
    }

    loadMessageHistory()
  }, [chatId])

  /* Загрузка черновика при входе в чат */
  useEffect(() => {
    if (!chatId) return

    const savedDraft = localStorage.getItem(`chat_${chatId}_Draft`)
    if (savedDraft) {
      setInputMessage(savedDraft)
    }
  }, [chatId])

  /* Подписка на WebSocket события чата */
  useEffect(() => {
    if (!chatId) return

    // Схемы валидации WebSocket сообщений
    const chatInfoSchema = z.object({
      id: z.string(),
      title: z.string(),
      avatarUrl: z.string().nullable(),
      isOnline: z.boolean(),
    })
    
    const presenceSchema = z.object({ 
      chatId: z.string(), 
      userId: z.string(), 
      isOnline: z.boolean() 
    })
    
    const messageSchema = z.object({
      id: z.string(),
      chatId: z.string(),
      senderId: z.string(),
      text: z.string().optional().nullable(),
      photoUrl: z.string().nullable().optional(),
      createdAt: z.string(),
    })

    /* Обработчик WebSocket сообщений */
    const handleWebSocketMessage = (msg: any) => {
      if (msg.ch !== 'messages') return
      
      if (msg.t === 'chat_info') {
        const parsedChatInfo = chatInfoSchema.safeParse(msg.data)
        if (parsedChatInfo.success && parsedChatInfo.data.id === chatId) {
          setChatInfo(prev => ({ ...prev, ...parsedChatInfo.data }))
        }
      } 
      else if (msg.t === 'presence') {
        const parsedPresence = presenceSchema.safeParse(msg.data)
        if (parsedPresence.success && parsedPresence.data.chatId === chatId) {
          setChatInfo(prev => prev ? { ...prev, isOnline: parsedPresence.data.isOnline } : prev)
        }
      } 
      else if (msg.t === 'message') {
        const parsedMessage = messageSchema.safeParse(msg.data)
        if (parsedMessage.success && parsedMessage.data.chatId === chatId) {
          const newMessage: ChatMessageItem = {
            id: parsedMessage.data.id,
            senderId: parsedMessage.data.senderId,
            text: parsedMessage.data.text ?? '',
            photoUrl: parsedMessage.data.photoUrl ?? null,
            createdAt: parsedMessage.data.createdAt,
          }
          setChatMessages(prev => [...prev, newMessage])
        }
      }
    }

    // Подписываемся на события чата
    const unsubscribe = wsClient.on(handleWebSocketMessage)
    wsClient.send({ ch: 'messages', t: 'subscribe', data: { chatId } })

    // Отписываемся при размонтировании
    return () => {
      unsubscribe()
      wsClient.send({ ch: 'messages', t: 'unsubscribe', data: { chatId } })
    }
  }, [chatId])

  const handleMoreActions = () => {
    // TODO: Добавить меню действий (удаление чата, настройки и т.д.)
    console.log('Открыть меню действий')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    localStorage.setItem(`chat_${chatId}_Draft`, e.target.value)
    setInputMessage(e.target.value)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  /* Отправка сообщения в чат */
  const handleSendMessage = () => {
    const messageText = inputMessage.trim()
    if (!messageText || !chatId) return
    
    wsClient.send({
      ch: 'messages',
      t: 'send',
      data: {
        chatId,
        text: messageText
      }
    })
    
    // Очищаем черновик после отправки сообщения
    localStorage.removeItem(`chat_${chatId}_Draft`)
    setInputMessage('')
  }

  /* Удаление сообщений из чата */
  const handleDeleteMessages = (messageIds: object) => {
    if (!messageIds) return
    
    wsClient.send({
      ch: 'messages',
      t: 'delete',
      data: { messageIds }
    })
  }

  /* Редактирование сообщения */
  const handleEditMessage = (messageId: string, newText: string) => {
    if (!messageId || !newText) return
      
    wsClient.send({
      ch: 'messages',
      t: 'edit',
      data: {
        messageId,
        newMessage: newText
      }
    })
  }

  /* Обработчики контекстного меню */
  const handleContextMenu = (event: TouchEvent | MouseEvent, message: ChatMessageItem) => {
    event.preventDefault()
    
    const position = {
      x: 'touches' in event && event.touches[0] ? event.touches[0].clientX : (event as MouseEvent).clientX,
      y: 'touches' in event && event.touches[0] ? event.touches[0].clientY : (event as MouseEvent).clientY
    }
    
    setContextMenu({
      isVisible: true,
      position,
      messageId: message.id,
      messageText: message.text,
      isOwnMessage: message.senderId === user?.id?.toString()
    })
  }

  const handleCloseContextMenu = () => {
    setContextMenu(prev => ({ ...prev, isVisible: false }))
  }

  const handleReplyToMessage = (messageId: string) => {
    // TODO: Реализовать ответ на сообщение
    console.log('Ответить на сообщение:', messageId)
    toast.info('Функция ответа на сообщение будет добавлена позже')
  }

  const handleForwardMessage = (messageId: string) => {
    // TODO: Реализовать пересылку сообщения
    console.log('Переслать сообщение:', messageId)
    toast.info('Функция пересылки сообщения будет добавлена позже')
  }

  const handleEditContextMessage = (messageId: string, text: string) => {
    handleEditMessage(messageId, text)
  }

  const handleDeleteContextMessage = (messageId: string) => {
    handleDeleteMessages({ [messageId]: true })
  }

  /* Обработка ошибок */
  if (errorState && errorState !== 'Показано') {
    console.error('[ChatPage]:', errorState)
    toast.error('Произошла ошибка при загрузке чата. Попробуйте позже!')
    setErrorState('Показано') // Предотвращаем повторное показывание ошибки
  }

  const navigate = useNavigate();

  const goBack = () => {
    navigate(-1); // идёт назад на одну страницу
  };

  return (
    <div className={styles.container}>
      {/* Заголовок чата */}
      <div className={styles.header}>
        <button onClick={goBack} className={styles.backButton}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button >

        {/* Информация о собеседнике */}
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {chatInfo?.avatarUrl ? (
              <img src={chatInfo.avatarUrl} alt={chatInfo.title} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                <svg width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>

          <div>
            <div className={styles.userName}>
              {chatInfo?.title 
                ? <h1 className="text-[15px]">{chatInfo.title}</h1>
                : <h1 className="text-[12px]">Неизвестный пользователь</h1>
              }
            </div>

            <div className="text-[11px] text-gray-300">
              {chatInfo ? (chatInfo.isOnline
                ? <p style={{ color: "var(--color-accent)" }}>В сети</p>
                : <p>Был(-а) недавно</p>
              ) : <p>Был(-а) давно</p>}
            </div>
          </div>
        </div>

        {/* Кнопка меню действий */}
        <button className={styles.moreButton} onClick={handleMoreActions}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24px"
            height="24px"
            viewBox="0 0 24 24"
            style={{ stroke: "var(--color-fg)" }}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6C12.5523 6 13 5.55228 13 5Z"/>
            <path d="M13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12Z"/>
            <path d="M13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19Z"/>
          </svg>
        </button>
      </div>
      
      {/* Область сообщений */}
      <div className={styles.chatContent}>
        {/* Состояние пустого чата */}
        {chatMessages.length === 0 && (
          <div className={styles.emptyChat}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className={styles.emptyTitle}>Начните разговор</h1>
            <p className={styles.emptySubtitle}>Отправьте сообщение или нажмите на приветствие ниже.</p>
          </div>
        )}
        
        {/* История сообщений */}
        {chatMessages.length > 0 && (
          <div className={styles.messagesList}>
            {groupMessagesByDateAndTime(chatMessages).map((dateGroup) => (
              <div key={dateGroup.dateKey} className={styles.dateGroup}>
                <span className={styles.dateDivider}>{dateGroup.label}</span>

                {dateGroup.groups.map((messageGroup, groupIndex) => (
                  <div key={groupIndex} className={styles.messageGroup}>
                    {messageGroup.map((message, messageIndex) => {
                      const isOwnMessage = message.senderId === user?.id?.toString()
                      const isFirstInGroup = messageIndex === 0
                      const isLastInGroup = messageIndex === messageGroup.length - 1
                      const isSingleMessage = messageGroup.length === 1
                      
                      // Определяем CSS классы для стилизации сообщения
                      const messageClasses = [
                        styles.message,
                        isOwnMessage ? styles.ownMessage : styles.otherMessage,
                        isSingleMessage ? styles.messageSingle :
                        isFirstInGroup ? styles.messageFirst : 
                        isLastInGroup ? styles.messageLast : 
                        styles.messageMiddle
                      ].join(' ')
                      
                      return (
                        <div 
                          key={message.id} 
                          className={messageClasses}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            handleContextMenu(e.nativeEvent, message)
                          }}
                          onTouchStart={(e) => {
                            const touch = e.touches[0]
                            if (touch) {
                              const startTime = Date.now()
                              const startX = touch.clientX
                              const startY = touch.clientY
                              
                              const handleTouchMove = (moveEvent: TouchEvent) => {
                                const moveTouch = moveEvent.touches[0]
                                if (moveTouch) {
                                  const distance = Math.sqrt(
                                    Math.pow(moveTouch.clientX - startX, 2) +
                                    Math.pow(moveTouch.clientY - startY, 2)
                                  )
                                  if (distance > 10) {
                                    document.removeEventListener('touchmove', handleTouchMove)
                                    document.removeEventListener('touchend', handleTouchEnd)
                                  }
                                }
                              }
                              
                              const handleTouchEnd = () => {
                                document.removeEventListener('touchmove', handleTouchMove)
                                document.removeEventListener('touchend', handleTouchEnd)
                              }
                              
                              const handleTouchEndWithCheck = () => {
                                const endTime = Date.now()
                                if (endTime - startTime >= 500) {
                                  handleContextMenu(e.nativeEvent, message)
                                }
                                handleTouchEnd()
                              }
                              
                              document.addEventListener('touchmove', handleTouchMove, { passive: true })
                              document.addEventListener('touchend', handleTouchEndWithCheck, { passive: true })
                            }
                          }}
                        >
                          <div className={styles.messageContent}>
                            {/* Фото в сообщении */}
                            {message.photoUrl && (
                              <img src={message.photoUrl} alt="Фото" className={styles.messagePhoto} />
                            )}
                            
                            {/* Текстовое сообщение с временем */}
                            {message.text && (
                              <div className={styles.messageTextContainer}>
                                <span className={styles.messageText}>
                                  {message.text}
                                </span>
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
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Поле ввода сообщения */}
      <div className={styles.composer}>
        <div className={styles.composerInner}>
          <div className={styles.inputWrapper}>
            <button 
              className={styles.chatButtons} 
              aria-label="Добавить фото" 
              onClick={handleSendMessage}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="20"
                width="20"
                viewBox="0 0 512 512">
                  <g>
                    <path
                      d="M454.821,253.582L273.256,435.14c-11.697,11.697-25.124,20.411-39.484,26.235   c-21.529,8.729-45.165,10.928-67.755,6.55c-22.597-4.378-44.054-15.25-61.597-32.784c-11.69-11.69-20.396-25.118-26.227-39.484   c-8.729-21.529-10.929-45.165-6.55-67.748c4.386-22.597,15.25-44.055,32.778-61.596l203.13-203.13   c7.141-7.134,15.299-12.43,24.035-15.969c13.1-5.318,27.516-6.656,41.263-3.994c13.769,2.677,26.798,9.27,37.498,19.963   c7.133,7.134,12.423,15.292,15.968,24.035c5.318,13.092,6.657,27.502,3.987,41.264c-2.67,13.762-9.262,26.783-19.955,37.498   L213.261,363.064c-2.534,2.528-5.375,4.364-8.436,5.61c-4.571,1.851-9.661,2.335-14.495,1.396   c-4.848-0.954-9.355-3.225-13.15-7.006c-2.534-2.534-4.364-5.368-5.603-8.429c-1.865-4.571-2.342-9.668-1.402-14.495   c0.947-4.841,3.225-9.355,7.005-13.149l175.521-175.528l-29.616-29.617l-175.528,175.52c-6.536,6.536-11.505,14.182-14.801,22.313   c-4.941,12.195-6.166,25.473-3.702,38.202c2.449,12.73,8.686,24.989,18.503,34.799c6.543,6.55,14.182,11.519,22.305,14.809   c12.202,4.948,25.473,6.165,38.21,3.702c12.722-2.449,24.989-8.678,34.806-18.511L439.97,195.602   c11.142-11.149,19.571-24.113,25.167-37.917c8.394-20.717,10.48-43.314,6.294-64.971c-4.179-21.643-14.73-42.432-31.46-59.155   c-11.149-11.142-24.114-19.571-37.918-25.166c-20.717-8.401-43.314-10.48-64.971-6.301c-21.643,4.186-42.431,14.737-59.155,31.468   L74.803,236.695c-15.713,15.691-27.552,33.931-35.426,53.352c-11.817,29.154-14.765,60.97-8.863,91.462   c5.888,30.478,20.717,59.696,44.29,83.254c15.698,15.713,33.931,27.552,53.36,35.426c29.146,11.811,60.97,14.758,91.455,8.863   c30.478-5.895,59.696-20.717,83.254-44.29l181.566-181.564L454.821,253.582z"
                      style={{ fill: "var(--color-accent)" }}
                    />
                  </g>
              </svg>
            </button>

            <textarea
              ref={messageInputRef}
              className={styles.textarea}
              placeholder="Сообщение"
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              disabled={Boolean(errorState) && chatMessages.length === 0}
              rows={1}
            />
          </div>

          <button 
            className={styles.chatButtons} 
            aria-label="Отправить" 
            onClick={handleSendMessage} 
            disabled={!inputMessage.trim()}
            style={{
              opacity: !inputMessage.trim() ? 0.5 : 1,
              pointerEvents: !inputMessage.trim() ? 'none' : 'auto'
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              version="1.0"
              width="27"
              height="30"
              viewBox="0 0 48 48"
              preserveAspectRatio="xMidYMid meet">
                <g transform="translate(0.000000,48.000000) scale(0.100000,-0.100000)">
                  <path
                    d="M47 413 c-12 -11 -8 -131 4 -139 6 -3 62 -11 125 -17 63 -6 114 -13 114 -17 0 -4 -51 -11 -114 -17 -63 -6 -119 -14 -125 -17 -14 -9 -15 -133 -1 -141 17 -10 385 157 385 175 0 10 -64 43 -185 97 -196 88 -193 87 -203 76z"
                    style={{ fill: "var(--color-accent)" }}
                  />
                </g>
            </svg>
          </button>
        </div>
      </div>

      {/* Фоновый узор */}
      <div 
        className={styles.patternFull} 
        style={{ 
          ...wallpaperStyle, 
          WebkitMaskImage: `url('/Chat/Wallpaper/${wallpaper}.svg')` 
        }} 
      />

      {/* Контекстное меню сообщений */}
      <MessageContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        messageId={contextMenu.messageId}
        messageText={contextMenu.messageText}
        isOwnMessage={contextMenu.isOwnMessage}
        onClose={handleCloseContextMenu}
        onReply={handleReplyToMessage}
        onForward={handleForwardMessage}
        onEdit={handleEditContextMessage}
        onDelete={handleDeleteContextMessage}
      />
    </div>
  )
}
