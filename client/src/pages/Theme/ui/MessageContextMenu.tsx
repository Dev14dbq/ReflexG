import React, { useRef, useEffect } from 'react';
import { FiEdit3, FiTrash2, FiCopy, FiCornerUpLeft } from 'react-icons/fi';
import { IoPin, IoPinOutline } from 'react-icons/io5';
import styles from './MessageContextMenu.module.scss';

interface Message {
  id: string;
  senderId: string;
  text: string;
  photoUrl: string | null;
  createdAt: string;
  replyId: string | null;
  isPinned: boolean;
  isEdit: boolean;
}

interface Props {
  message: Message;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: (msgId: string) => void;
  onEdit: (msg: Message) => void;
  onPin: (msgId: string, pinned: boolean) => void;
  onCopy?: (msg: Message) => void;
  onReply?: (msg: Message) => void;
  isPinned?: boolean;
  isOwnMessage?: boolean;
}

const MessageContextMenu: React.FC<Props> = ({
  message,
  position,
  onClose,
  onDelete,
  onEdit,
  onPin,
  onCopy,
  onReply,
  isPinned = false,
  isOwnMessage = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Обработчик клика за пределы меню для закрытия
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Функции для управления
  const menuActions = {
    delete: () => { onDelete(message.id); onClose(); },
    edit: () => { onEdit(message); onClose(); },
    togglePin: () => { onPin(message.id, !isPinned); onClose(); },
    copy: () => { onCopy?.(message); onClose(); },
    reply: () => { onReply?.(message); onClose(); }
  };

  // Стили для позиционирования меню с учетом границ экрана
  const getMenuPosition = () => {
    const menuWidth = 250; // примерная ширина меню
    const menuHeight = 200; // примерная высота меню
    const padding = 10;
    
    let x = position.x - 120;
    let y = position.y - 140;
    
    // Проверяем, не выходит ли меню за правую границу
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }
    
    // Проверяем, не выходит ли меню за нижнюю границу
    if (y + menuHeight > window.innerHeight) {
      y = position.y - menuHeight - padding;
    }
    
    // Проверяем, не выходит ли меню за левую границу
    if (x < padding) {
      x = padding;
    }
    
    // Проверяем, не выходит ли меню за верхнюю границу
    if (y < padding) {
      y = padding;
    }
    
    return { x, y };
  };

  // Определение пунктов меню
  const menuItems = [
    // Копировать текст
    ...(message.text ? [{
      key: 'copy',
      icon: <FiCopy />,
      label: 'Копировать',
      onClick: menuActions.copy,
      className: styles.menuItem
    }] : []),

    // Ответить
    ...(onReply ? [{
      key: 'reply',
      icon: <FiCornerUpLeft />,
      label: 'Ответить',
      onClick: menuActions.reply,
      className: styles.menuItem
    }] : []),

    // Редактировать (только для своих сообщений)
    ...(isOwnMessage && message.text ? [{
      key: 'edit',
      icon: <FiEdit3 />,
      label: 'Изменить',
      onClick: menuActions.edit,
      className: styles.menuItem
    }] : []),

    // Закрепить/Открепить
    {
      key: 'pin',
      icon: isPinned ? <IoPin /> : <IoPinOutline />,
      label: isPinned ? 'Открепить' : 'Закрепить',
      onClick: menuActions.togglePin,
      className: styles.menuItem
    },

    // Удалить (только для своих сообщений)
    ...(isOwnMessage ? [{
      key: 'delete',
      icon: <FiTrash2 data-icon="trash-2" />,
      label: 'Удалить',
      onClick: menuActions.delete,
      className: styles.menuItem
    }] : [])
  ];

  const menuPosition = getMenuPosition();
  const menuStyles: React.CSSProperties = {
    position: 'fixed',
    top: menuPosition.y,
    left: menuPosition.x,
    zIndex: 1000,
  };

  return (
    <>
      {/* Overlay для закрытия меню */}
      <div className={styles.overlay} onClick={onClose} />
      
      {/* Меню */}
      <div ref={menuRef} style={menuStyles} className={styles.contextMenu}>
        {menuItems.map((item) => (
          <button
            key={item.key}
            className={item.className}
            onClick={item.onClick}
          >
            <div className={styles.icon}>
              {item.icon}
            </div>
            <span className={styles.label}>{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
};

export default MessageContextMenu;