import { useEffect, useState, type JSX } from 'react'
import { RiShieldLine, RiUserLine, RiCloseLine } from 'react-icons/ri'
import { toast } from 'sonner'

interface BlacklistUser {
  id: string
  username: string | null
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
}

export default function BlacklistPage(): JSX.Element {
  const [users, setUsers] = useState<BlacklistUser[]>([])
  const [loading, setLoading] = useState(true)
  const [unblocking, setUnblocking] = useState<string | null>(null)

  // Загрузка черного списка
  useEffect(() => {
    loadBlacklist()
  }, [])

  const loadBlacklist = async () => {
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const response = await fetch(`/api/privacy/settings?initData=${encodeURIComponent(initData)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        const blacklistUsers: BlacklistUser[] = (data.blacklist || []).map((user: any) => ({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl
        }))
        setUsers(blacklistUsers)
      } else {
        toast.error('Ошибка загрузки черного списка')
      }
    } catch (error) {
      toast.error('Ошибка загрузки черного списка')
    } finally {
      setLoading(false)
    }
  }

  const unblockUser = async (userId: string) => {
    setUnblocking(userId)
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const response = await fetch('/api/privacy/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          initData, 
          action: 'removeFromBlacklist',
          userId 
        })
      })
      
      if (response.ok) {
        setUsers(prev => prev.filter(user => user.id !== userId))
        toast.success('Пользователь разблокирован')
      } else {
        const errorData = await response.json()
        console.error('Blacklist API error:', errorData)
        toast.error('Ошибка разблокировки')
      }
    } catch (error) {
      console.error('Blacklist API error:', error)
      toast.error('Ошибка разблокировки')
    } finally {
      setUnblocking(null)
    }
  }

  const clearAll = async () => {
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const response = await fetch('/api/privacy/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          initData, 
          action: 'clearBlacklist'
        })
      })
      
      if (response.ok) {
        setUsers([])
        toast.success('Черный список очищен')
      } else {
        const errorData = await response.json()
        console.error('Blacklist clear API error:', errorData)
        toast.error('Ошибка очистки')
      }
    } catch (error) {
      console.error('Blacklist clear API error:', error)
      toast.error('Ошибка очистки')
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto h-full bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-[var(--color-fg)]">Загрузка...</div>
      </div>
    )
  }

  return (
      <div className="max-w-md mx-auto h-full bg-[var(--color-bg)] overflow-y-auto">
        <div className="px-4 py-6">
 
          {/* Список пользователей */}
        {users.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] flex items-center justify-center mx-auto mb-4">
              <RiShieldLine size={24} className="text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">Черный список пуст</h3>
            <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
              Здесь будут отображаться заблокированные пользователи
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Пользователь'
              return (
                <div key={user.id} className="flex items-center gap-3 p-4 bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-lg">
                  <div className="w-12 h-12 rounded-full border border-[var(--color-accent)] overflow-hidden flex items-center justify-center flex-shrink-0">
                    {user.photoUrl ? (
                      <img src={user.photoUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <RiUserLine size={20} className="text-[var(--color-accent)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-[var(--color-fg)] truncate">
                      {displayName}
                    </h3>
                    {user.username && (
                      <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)] truncate">
                        @{user.username}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => unblockUser(user.id)}
                    disabled={unblocking === user.id}
                    className="flex items-center gap-2 px-3 py-2 border border-[var(--color-accent)] text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {unblocking === user.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ...
                      </>
                    ) : (
                      <>
                        Разблокировать
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
