import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ProfileCard, { type ProfileCardData, ProfileCardSchema } from '@/entities/ProfileCard/ui/ProfileCard'
import { requireEnvUrl } from '@/shared/config/env'

export default function ProfileViewPage(): JSX.Element {
  const { userId, chatId } = useParams<{ userId?: string; chatId?: string }>()
  const [data, setData] = useState<ProfileCardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const initData = window?.Telegram?.WebApp?.initData || ''

    async function load(): Promise<void> {
      try {
        const base = requireEnvUrl('API_URL')
        const path = userId ? 'profile/view' : 'profile/view-by-chat'
        const url = `${base.replace(/\/$/, '')}/${path}?initData=${encodeURIComponent(initData)}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}${chatId ? `&chatId=${encodeURIComponent(chatId)}` : ''}`
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json()
        const parsed = ProfileCardSchema.parse(json.profile)
        if (!cancelled) setData(parsed)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Ошибка загрузки профиля')
      }
    }

    load().catch(() => {})
    return () => { cancelled = true }
  }, [userId, chatId])

  return (
    <div className="p-4 max-w-md mx-auto">
      {error ? <div className="text-sm text-red-500 mb-2">{error}</div> : null}
      {data ? (
        <ProfileCard 
          data={data}
          onLike={() => {}}
          onDislike={() => {}}
          showActions={false}
        />
      ) : (
        <div className="text-sm text-muted">Загрузка…</div>
      )}
    </div>
  )
}
