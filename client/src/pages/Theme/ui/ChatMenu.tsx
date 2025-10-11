import React, { useEffect, useState } from 'react';
import { FiSearch, FiVolumeX, FiTrash2, FiUserX } from 'react-icons/fi';
import styles from './ChatMenu.module.scss';

interface ChatMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch?: () => void;
  onMute?: () => void;
  onDeleteChat?: () => void;
  onBlockUser?: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

export default function ChatMenu({ 
  isOpen, 
  onClose, 
  onSearch, 
  onMute, 
  onDeleteChat, 
  onBlockUser,
  buttonRef
}: ChatMenuProps) {
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top + window.scrollY - 100,
        right: window.innerWidth - rect.right - window.scrollX
      });
      setIsClosing(false);
    }
  }, [isOpen, buttonRef]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200); // Длительность анимации
  };

  const menuItems = [
    {
      id: 'search',
      label: 'Поиск',
      icon: <FiSearch size={20} />,
      onClick: onSearch || (() => console.log('Поиск пока не реализован')),
      disabled: false
    },
    {
      id: 'mute',
      label: 'Заглушить',
      icon: <FiVolumeX size={20} />,
      onClick: onMute || (() => console.log('Заглушение пока не реализовано')),
      disabled: false
    },
    {
      id: 'delete',
      label: 'Удалить чат',
      icon: <FiTrash2 size={20} />,
      onClick: onDeleteChat || (() => console.log('Удаление чата пока не реализовано')),
      disabled: false
    },
    {
      id: 'block',
      label: 'Заблокировать',
      icon: <FiUserX size={20} />,
      onClick: onBlockUser || (() => console.log('Блокировка пока не реализована')),
      disabled: false
    }
  ];

  return (
    <>
      {/* Overlay для закрытия меню */}
      <div className={styles.overlay} onClick={handleClose} />
      
      {/* Меню */}
      <div 
        className={`${styles.menu} ${isClosing ? styles.closing : ''}`}
        style={{
          top: `${position.top}px`,
          right: `${position.right}px`
        }}
      >
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.menuItem} ${item.disabled ? styles.disabled : ''}`}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                handleClose();
              }
            }}
            disabled={item.disabled}
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
}
