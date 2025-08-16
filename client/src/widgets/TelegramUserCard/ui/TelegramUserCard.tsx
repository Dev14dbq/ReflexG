import type { JSX } from 'react'
import { useMemo } from 'react'
import { getTelegramPlatform } from '@/shared/lib/telegram'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import cls from './TelegramUserCard.module.scss'

export function TelegramUserCard(): JSX.Element | null {
  const { ready, isWebApp, user } = useTelegramAuth()
  useMemo(() => {
    // eslint-disable-next-line no-console
    console.log('[TelegramUserCard] isWebApp:', isWebApp, 'platform:', getTelegramPlatform(), 'user:', user)
  }, [isWebApp, user])

  if (!isWebApp) {
    return (
      <div className={cls.card}>
        <div className={cls.avatar} />
        <div>
          <div className={cls.name}>Открой через Telegram</div>
          <div className={cls.muted}>
            Этот блок виден только в Telegram WebApp
            <br />
            platform: {String(getTelegramPlatform() ?? 'unknown')}
          </div>
        </div>
      </div>
    )
  }

  if (!ready) {
    return null
  }

  if (!user) {
    return (
      <div className={cls.card}>
        <div className={cls.avatar} />
        <div>
          <div className={cls.name}>Telegram WebApp</div>
          <div className={cls.muted}>Пользователь не передан</div>
        </div>
      </div>
    )
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `ID ${user.id}`

  return (
    <div className={cls.card}>
      <div className={cls.avatar}>
        {user.photo_url ? (
          <img src={user.photo_url} alt={displayName} width={56} height={56} />
        ) : null}
      </div>
      <div>
        <div className={cls.name}>{displayName}</div>
        <div className={cls.muted}>
          {user.username ? `@${user.username}` : `id: ${user.id}`}
          {user.is_premium ? ' • Premium' : ''}
          <br />
          platform: {String(getTelegramPlatform() ?? 'unknown')}
        </div>
      </div>
    </div>
  )
}

export default TelegramUserCard


