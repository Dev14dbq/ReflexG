import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiHeartFill } from 'react-icons/ri';
import { toast } from 'sonner';
import { wsClient } from '@/shared/lib/ws';
import { fetchUnreadLikesCount } from '@/shared/api/likes';
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider';

export default function LikesNotification(): JSX.Element {
  const navigate = useNavigate();
  const { telegramInitData } = useTelegramAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);

  // Загружаем количество непрочитанных лайков при монтировании
  useEffect(() => {
    if (!telegramInitData) return;

    const loadUnreadCount = async () => {
      try {
        const response = await fetchUnreadLikesCount(telegramInitData);
        setUnreadCount(response.count);
      } catch (error) {
        console.error('Failed to fetch unread likes count:', error);
      }
    };

    loadUnreadCount();
  }, [telegramInitData]);

  // Подписываемся на WebSocket события о новых лайках
  useEffect(() => {
    if (!telegramInitData) return;

    const unsubscribe = wsClient.on((msg) => {
      if (msg.ch === 'likes' && msg.t === 'new_like') {
        const now = Date.now();
        // Предотвращаем спам уведомлений (не чаще чем раз в 5 секунд)
        if (now - lastNotificationTime < 5000) return;
        
        setLastNotificationTime(now);
        setUnreadCount(prev => prev + 1);
        
        // Показываем уведомление
        toast.success(
          'Новый лайк! 💖',
          {
            description: 'Кто-то поставил вам лайк',
            duration: 4000,
            action: {
              label: 'Посмотреть',
              onClick: () => navigate('/likes')
            }
          }
        );
      }
    });

    return unsubscribe;
  }, [telegramInitData, navigate, lastNotificationTime]);

  // Показываем уведомление о накопленных лайках при первом заходе
  useEffect(() => {
    if (unreadCount > 0 && lastNotificationTime === 0) {
      const now = Date.now();
      setLastNotificationTime(now);
      
      toast.info(
        `У вас ${unreadCount} новых лайков! 💖`,
        {
          description: 'Посмотрите, кто вас лайкнул',
          duration: 5000,
          action: {
            label: 'Посмотреть',
            onClick: () => navigate('/likes')
          }
        }
      );
    }
  }, [unreadCount, navigate, lastNotificationTime]);

  return <></>; // Компонент не рендерит ничего видимого
}
