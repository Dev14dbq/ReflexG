import { useEffect, useRef, type JSX } from 'react'
import { toast } from 'sonner'

import styles from './MessageContextMenu.module.scss'

export interface MessageContextMenuProps {
  isVisible: boolean
  position: { x: number; y: number }
  messageId: string
  messageText: string
  isOwnMessage: boolean
  onClose: () => void
  onReply: (messageId: string) => void
  onForward: (messageId: string) => void
  onEdit: (messageId: string, text: string) => void
  onDelete: (messageId: string) => void
}

export default function MessageContextMenu({
  isVisible,
  position,
  messageId,
  messageText,
  isOwnMessage,
  onClose,
  onReply,
  onForward,
  onEdit,
  onDelete
}: MessageContextMenuProps): JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null)

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isVisible, onClose])

  // Закрытие меню при нажатии Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isVisible) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isVisible, onClose])

  // Копирование текста сообщения
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText)
      toast.success('Сообщение скопировано')
      onClose()
    } catch (error) {
      toast.error('Не удалось скопировать сообщение')
    }
  }

  // Ответ на сообщение
  const handleReply = () => {
    onReply(messageId)
    onClose()
  }

  // Редактирование сообщения
  const handleEdit = () => {
    onEdit(messageId, messageText)
    onClose()
  }

  // Удаление сообщения
  const handleDelete = () => {
    onDelete(messageId)
    onClose()
  }

  if (!isVisible) return null

  // Корректировка позиции, чтобы меню не выходило за границы экрана
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200), // 200px - примерная ширина меню
    y: Math.min(position.y, window.innerHeight - 250) // 250px - примерная высота меню
  }

  const item = [{
    name: 'Ответить',
    icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="9 11 12 14 22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="2"/>
    </svg>),
    onClick: (handleReply)
  },{
    name: 'Скопировать',
    icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
    </svg>),
    onClick: (handleCopy)
  },{
    name: 'Редактировать',
    icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2"/>
    </svg>),
    onClick: (handleEdit),
    perm: (isOwnMessage)
  },{
    name: 'Удалить',
    icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>),
    onClick: (handleDelete),
    perm: (isOwnMessage)
  }]

  return (
    <div 
      ref={menuRef}
      className={styles.contextMenu}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`
      }}
    >
      {item.map((data, index) => {
        if (typeof data.perm !== 'undefined') {
          if (!data.perm) return null;
        }

        return (
          <div key={index} className={styles.menuItem} onClick={data.onClick}>
            {data.icon}
            <span>{data.name}</span>
          </div>
        );
      })}
    </div>
  )
}
