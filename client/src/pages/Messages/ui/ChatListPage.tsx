import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchChats, type ChatListItem } from '@/shared/api/messages'

export default function ChatListPage(): JSX.Element {
  const [items, setItems] = useState<ChatListItem[]>([])
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const idSetRef = useRef<Set<string>>(new Set())

  async function loadMore(): Promise<void> {
    if (loading) return
    setLoading(true)
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const resp = await fetchChats(initData, cursor, 20)
      const uniq = resp.items.filter(it => !idSetRef.current.has(it.id))
      uniq.forEach(it => idSetRef.current.add(it.id))
      setItems(prev => [...prev, ...uniq])
      setCursor(resp.nextCursor)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadMore() }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && cursor && !loading) void loadMore()
      })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [cursor, loading])

  const showEmpty = (items.length === 0 && !loading) || (error && items.length === 0)

  return (
    <div className="max-w-md mx-auto">
      <div className="sticky top-0 left-0 right-0 z-10 px-4 py-3" style={{ background: 'var(--color-bg)' }}>
        <div className="text-xl font-semibold">Reflex</div>
      </div>
      <div className="p-4">
      {showEmpty ? (
        <div className="text-center py-16">
          <div className="text-sm text-muted">
            {error ? `Ошибка загрузки: ${error}` : 'У вас пока что нет чатов. Начните смотреть анкеты, чтобы появились мэтчи.'}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            {error ? <button className="btn" onClick={() => void loadMore()}>Повторить</button> : null}
            <Link to="/explore" className="btn btn-primary inline-flex">Листать анкеты</Link>
          </div>
        </div>
      ) : null}
      {items.map(it => (
        <Link to={`/messages/${encodeURIComponent(it.id)}`} key={it.id} className="flex items-center gap-3 py-2">
          <div className="w-12 h-12 rounded-full border border-accent overflow-hidden flex items-center justify-center">
            {it.avatarUrl ? <img src={it.avatarUrl} alt={it.title} className="w-full h-full object-cover" /> : <div className="text-sm text-muted">No</div>}
          </div>
          <div className="flex-1">
            <div className="font-medium truncate">{it.title}</div>
            <div className="text-sm text-muted truncate">{it.lastMessage ?? ''}</div>
          </div>
        </Link>
      ))}
      {error ? <div className="text-sm text-red-500 mt-2">{error}</div> : null}
      <div ref={sentinelRef} className="h-6" />
      {loading ? <div className="text-sm text-muted">Загрузка…</div> : null}
      </div>
    </div>
  )
}


