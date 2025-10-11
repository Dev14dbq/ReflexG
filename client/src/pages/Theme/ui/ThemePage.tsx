import { FiPaperclip, FiMoreVertical, FiArrowLeft, FiX, FiChevronDown } from "react-icons/fi";
import { useEffect, useRef, useState, type JSX } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IoSend } from "react-icons/io5";
import { toast } from 'sonner'
import { z } from 'zod'

import { fetchChatMessages, type ChatMessageItem, ChatInfo, markMessagesAsRead } from '@/shared/api/chat'
import { fetchThemeSettings, type settingsThemeResponse } from '@/shared/api/settings'
import { groupMessagesByDateAndTime } from '@/shared/lib/messageGrouping'
import { chatStore } from '@/shared/lib/chatStore'
import MessageContextMenu from '@/pages/Theme/ui/MessageContextMenu'
import ChatMenu from '@/pages/Theme/ui/ChatMenu'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import { wsClient } from '@/shared/lib/ws'

import styles from './ThemePage.module.scss'

export default function ThemePage(): JSX.Element {
  const { chatId } = useParams<{ chatId: string }>()
  
  // Состояние темы
  const [themeMessages, setThemeMessages] = useState<ChatMessageItem[]>([])
  const [themeMessagesPinned, setThemeMessagesPinned] = useState<ChatMessageItem[]>([])
  const [themeInfo, setThemeInfo] = useState<ChatInfo | null>(null)
  const [wallpaper, setWallpaper] = useState<string>('love-tg')
  const [inputMessage, setInputMessage] = useState<string>('')
  const [errorState, setErrorState] = useState<string | null>(null)
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set())
  const [showPinnedMessages, setShowPinnedMessages] = useState<boolean>(true)
  const [isChatMenuOpen, setIsChatMenuOpen] = useState<boolean>(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  // Контекстовое меню
  const [contextMenuData, setContextMenuData] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    message?: ChatMessageItem;
  }>({ visible: false, position: { x: 0, y: 0 } });
  
  const handleContextMenu = (event: React.MouseEvent, message: ChatMessageItem) => {
    event.preventDefault();
    setContextMenuData({
      visible: true,
      position: { x: event.clientX, y: event.clientY },
      message,
    });
  };

  const handleCloseMenu = () => {
    setContextMenuData({ visible: false, position: { x: 0, y: 0 } });
  };

  // Обработчики для контекстного меню
  const handleDeleteMessage = (messageId: string) => {
    wsClient.send({
      ch: 'messages',
      t: 'delete',
      data: { messageId }
    });
  };

  const handleEditMessage = (message: ChatMessageItem) => {
    // Показываем промпт для редактирования
    const newText = prompt('Редактировать сообщение:', message.text);
    if (newText !== null && newText.trim() !== message.text) {
      wsClient.send({
        ch: 'messages',
        t: 'edit',
        data: { 
          messageId: message.id,
          text: newText.trim()
        }
      });
    }
  };

  const handlePinMessage = (messageId: string, pinned: boolean) => {
    // Отправляем запрос на закрепление/открепление через WebSocket
    wsClient.send({
      ch: 'messages',
      t: 'pin',
      data: { messageId }
    });
    
    toast.success(`Сообщение ${pinned ? 'закреплено' : 'откреплено'}`);
  };

  const handleCopyMessage = (message: ChatMessageItem) => {
    if (message.text) {
      // Современный способ копирования
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(message.text).then(() => {
          toast.success('Текст скопирован в буфер обмена');
        }).catch(() => {
          // Fallback для старых браузеров
          fallbackCopyTextToClipboard(message.text);
        });
      } else {
        // Fallback для старых браузеров или небезопасного контекста
        fallbackCopyTextToClipboard(message.text);
      }
    }
  };

  // Fallback функция для копирования в старых браузерах
  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        toast.success('Текст скопирован в буфер обмена');
      } else {
        toast.error('Не удалось скопировать текст');
      }
    } catch (err) {
      toast.error('Не удалось скопировать текст');
    }
    
    document.body.removeChild(textArea);
  };

  const handleReplyToMessage = (message: ChatMessageItem) => {
    // Показываем промпт для ответа
    const replyText = prompt(`Ответить на сообщение "${message.text}":`, '');
    if (replyText !== null && replyText.trim()) {
      wsClient.send({
        ch: 'messages',
        t: 'reply',
        data: { 
          messageId: message.id,
          text: replyText.trim()
        }
      });
      toast.success('Ответ отправлен');
    }
  };

  const handlePinnedMessageClick = (messageId: string) => {
    // Находим элемент сообщения в чате и прокручиваем к нему
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      // Подсвечиваем сообщение на короткое время
      const highlightClass = styles.messageHighlight;
      if (highlightClass) {
        messageElement.classList.add(highlightClass);
        setTimeout(() => {
          messageElement.classList.remove(highlightClass);
        }, 2000);
      }
    }
  };

  // Рефы
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null)

  // Хуки навигации и авторизации
  const { user } = useTelegramAuth()

  /* Загрузка настроек темы (обои) */
  useEffect(() => {
    const loadThemeSettings = async () => {
      const telegramInitData = window?.Telegram?.WebApp?.initData
      if(!telegramInitData) return

      const themeSettings:settingsThemeResponse = await fetchThemeSettings(telegramInitData)
      
      if (themeSettings) {
        setWallpaper(themeSettings.settings.topic!)
      }
    }

    loadThemeSettings()
  }, [])

  const wallpaperStyle = {
    ['--pattern-color']: 'var(--color-accent)',
    ['--pattern-size']: '340px auto'
  }

  /* Загрузка истории сообщений при открытии темы */
  useEffect(() => {
    if (!chatId) return

    const loadMessageHistory = async () => {
      try {
        const telegramInitData = window?.Telegram?.WebApp?.initData
        if (!telegramInitData) return

        const messagesResponse = await fetchChatMessages(telegramInitData, chatId)
        setThemeMessages(messagesResponse.items)
        
        // Помечаем сообщения как прочитанные
        try {
          await markMessagesAsRead(telegramInitData, chatId)
          // Обновляем статус в chatStore
          chatStore.updateChatItem(chatId, { 
            unreadCount: 0, 
            isRead: true 
          })
        } catch (error) {
          console.error('Failed to mark messages as read:', error)
        }
      } catch (error: any) {
        console.error('[Error] Chat history:', error)
        setErrorState(`Возникла проблема при загрузки сообщений. Подробнее см. в консоли! (При необходимости обратитесь в поддержку)`)
      }
    }

    loadMessageHistory()
  }, [chatId])

  /* Загрузка черновика при входе в тему */
  useEffect(() => {
    if (!chatId) return

    const savedDraft = localStorage.getItem(`chat_${chatId}_Draft`)
    if (savedDraft) {
      setInputMessage(savedDraft)
    }
  }, [chatId])

  /* Подписка на WebSocket события темы */
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
      replyId: z.string().optional().nullable(),
      isPinned: z.boolean().optional(),
      isEdit: z.boolean().optional(),
    })

    /* Обработчик WebSocket сообщений */
    const handleWebSocketMessage = (msg: any) => {
      if (msg.ch !== 'messages') return
      
      if (msg.t === 'chat_info') {
        const parsedChatInfo = chatInfoSchema.safeParse(msg.data)
        if (parsedChatInfo.success && parsedChatInfo.data.id === chatId) {
          setThemeInfo(prev => ({ ...prev, ...parsedChatInfo.data }))
        }
      } 
      else if (msg.t === 'presence') {
        const parsedPresence = presenceSchema.safeParse(msg.data)
        if (parsedPresence.success && parsedPresence.data.chatId === chatId) {
          setThemeInfo(prev => prev ? { ...prev, isOnline: parsedPresence.data.isOnline } : prev)
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
            replyId: parsedMessage.data.replyId ?? null,
            isPinned: parsedMessage.data.isPinned ?? false,
            isEdit: parsedMessage.data.isEdit ?? false,
          }
          setThemeMessages(prev => [...prev, newMessage])
        }
      }
      else if (msg.t === 'message_edited') {
        const parsedMessage = messageSchema.safeParse(msg.data)
        if (parsedMessage.success && parsedMessage.data.chatId === chatId) {
          setThemeMessages(prev => prev.map(msg => 
            msg.id === parsedMessage.data.id 
              ? { ...msg, text: parsedMessage.data.text ?? '', isEdit: true }
              : msg
          ))
        }
      }
      else if (msg.t === 'message_deleted') {
        if (msg.data?.chatId === chatId && msg.data?.id) {
          setThemeMessages(prev => prev.filter(message => message.id !== msg.data.id))
        }
      }
      else if (msg.t === 'message_pinned') {
        const parsedMessage = messageSchema.safeParse(msg.data)
        if (parsedMessage.success && parsedMessage.data.chatId === chatId) {
          setThemeMessages(prev => prev.map(msg => 
            msg.id === parsedMessage.data.id 
              ? { ...msg, isPinned: parsedMessage.data.isPinned ?? false }
              : msg
          ))
          // Обновляем состояние закрепленных сообщений
          setPinnedMessages(prev => {
            const newSet = new Set(prev);
            if (parsedMessage.data.isPinned) {
              newSet.add(parsedMessage.data.id);
            } else {
              newSet.delete(parsedMessage.data.id);
            }
            return newSet;
          });
        }
      }
    }

    // Подписываемся на события темы
    const unsubscribe = wsClient.on(handleWebSocketMessage)
    wsClient.send({ ch: 'messages', t: 'subscribe', data: { chatId } })

    // Отписываемся при размонтировании
    return () => {
      unsubscribe()
      wsClient.send({ ch: 'messages', t: 'unsubscribe', data: { chatId } })
    }
  }, [chatId])

  const handleMoreActions = () => {
    setIsChatMenuOpen(true)
  }

  const handleSearch = () => {
    console.log('Поиск по чату пока не реализован')
  }

  const handleMute = () => {
    console.log('Заглушение чата пока не реализовано')
  }

  const handleDeleteChat = () => {
    console.log('Удаление чата пока не реализовано')
  }

  const handleBlockUser = () => {
    console.log('Блокировка пользователя пока не реализована')
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

  /* Отправка сообщения в тему */
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

  /* Обработка ошибок */
  if (errorState && errorState !== 'Показано') {
    console.error('[ThemePage]:', errorState)
    toast.error('Произошла ошибка при загрузке темы. Попробуйте позже!')
    setErrorState('Показано') // Предотвращаем повторное показывание ошибки
  }

  const navigate = useNavigate();

  const goBack = () => {
    navigate(-1);
  };

  useEffect(() => {
    setThemeMessagesPinned(themeMessages.filter(message => message.isPinned).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
  }, [themeMessages])

  return (
    <div className={styles.container}>
      {/* Заголовок темы */}
      <div className={styles.header}>
        <button onClick={goBack} className={styles.backButton}>
          <FiArrowLeft style={{ width: "20", height: "20" }}/>
        </button>

        {/* Информация о собеседнике */}
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {themeInfo?.avatarUrl ? (
              <img src={themeInfo.avatarUrl} alt={themeInfo.title} />
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
              {themeInfo?.title 
                ? <h1 className="text-[15px]">{themeInfo.title}</h1>
                : <h1 className="text-[12px]">Неизвестный пользователь</h1>
              }
            </div>

            <div className="text-[11px] text-gray-300">
              {themeInfo ? (themeInfo.isOnline
                ? <p style={{ color: "var(--color-accent)" }}>В сети</p>
                : <p>Был(-а) недавно</p>
              ) : <p>Был(-а) давно</p>}
            </div>
          </div>
        </div>

        {/* Кнопка меню действий */}
        <button ref={moreButtonRef} className={styles.moreButton} onClick={handleMoreActions}>
          <FiMoreVertical style={{ width: "23", height: "23" }}/>
        </button>
      </div>

      {/* Секция закрепленных сообщений */}
      {themeMessagesPinned.length > 0 && (
        <div className={styles.pinnedMessagesSection}>
          <div className={styles.pinnedMessagesHeader}>
            <div className={styles.pinnedIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 4V2C16 1.45 15.55 1 15 1H9C8.45 1 8 1.45 8 2V4H4C3.45 4 3 4.45 3 5S3.45 6 4 6H5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V6H20C20.55 6 21 5.55 21 5S20.55 4 20 4H16ZM10 3H14V4H10V3ZM17 19H7V6H17V19Z" fill="currentColor"/>
                <path d="M9 8V17H11V8H9ZM13 8V17H15V8H13Z" fill="currentColor"/>
              </svg>
            </div>
            <span className={styles.pinnedLabel}>
              {themeMessagesPinned.length === 1 
                ? 'Закрепленное сообщение'
                : `Закрепленные сообщения (${themeMessagesPinned.length})`
              }
            </span>
            <button 
              className={styles.pinnedToggle}
              onClick={() => setShowPinnedMessages(!showPinnedMessages)}
            >
              <FiChevronDown 
                style={{ 
                  width: "16", 
                  height: "16",
                  transform: showPinnedMessages ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              />
            </button>
          </div>
          
          {showPinnedMessages && (
            <div className={styles.pinnedMessagesList}>
              {themeMessagesPinned.slice(0, 3).map((message, index) => (
                <div key={message.id} className={styles.pinnedMessageItem}>
                  <div 
                    className={styles.pinnedMessageContent}
                    onClick={() => handlePinnedMessageClick(message.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={styles.pinnedMessageText}>
                      {message.text ? (
                        message.text.length > 50 
                          ? `${message.text.substring(0, 50)}...` 
                          : message.text
                      ) : (
                        message.photoUrl ? '📷 Фото' : 'Сообщение'
                      )}
                    </span>
                    <span className={styles.pinnedMessageTime}>
                      {new Date(message.createdAt).toLocaleTimeString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <button 
                    className={styles.pinnedMessageClose}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePinMessage(message.id, true);
                    }}
                    title="Открепить сообщение"
                  >
                    <FiX style={{ width: "14", height: "14" }}/>
                  </button>
                </div>
              ))}
              {themeMessagesPinned.length > 3 && (
                <div className={styles.pinnedMore}>
                  <span>+{themeMessagesPinned.length - 3} еще</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Сообщение пользователей */}
      <div className={`${styles.chatContent} ${themeMessagesPinned.length > 0 ? styles.withPinned : ''}`}>
        {/* Сообщение при пустой истории переписки */}
        {themeMessages.length === 0 && (
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
        {themeMessages.length > 0 && (
          <div className={styles.messagesList}>
            {groupMessagesByDateAndTime(themeMessages).map((dateGroup) => (
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
                          data-message-id={message.id}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            handleContextMenu(e, message)
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
              aria-label="Прикрепить фото" 
              onClick={handleSendMessage}
            >
              <FiPaperclip style={{ color: "var(--color-accent)", width: "23", height: "23" }}/>
            </button>

            <textarea
              ref={messageInputRef}
              className={styles.textarea}
              placeholder="Сообщение"
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              disabled={Boolean(errorState) && themeMessages.length === 0}
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
            <IoSend style={{ fill: "var(--color-accent)", width: "25", height: "25" }}/>
          </button>
        </div>
      </div>

      {/* Обои темы (Можно изменить в настройках) */}
      <div 
        className={styles.patternFull} 
        style={{ 
          ...wallpaperStyle, 
          WebkitMaskImage: `url('/Chat/Wallpaper/${wallpaper}.svg')` 
        }} 
      />

      {/* Контекстное меню сообщений */}
      {contextMenuData.visible && contextMenuData.message && (
        <MessageContextMenu
          message={contextMenuData.message}
          position={contextMenuData.position}
          onClose={handleCloseMenu}
          onDelete={handleDeleteMessage}
          onEdit={handleEditMessage}
          onPin={handlePinMessage}
          onCopy={handleCopyMessage}
          onReply={handleReplyToMessage}
          isPinned={pinnedMessages.has(contextMenuData.message.id)}
          isOwnMessage={contextMenuData.message.senderId === user?.id?.toString()}
        />
      )}

      {/* Меню действий чата */}
      <ChatMenu
        isOpen={isChatMenuOpen}
        onClose={() => setIsChatMenuOpen(false)}
        onSearch={handleSearch}
        onMute={handleMute}
        onDeleteChat={handleDeleteChat}
        onBlockUser={handleBlockUser}
        buttonRef={moreButtonRef}
      />
    </div>
  )
}
