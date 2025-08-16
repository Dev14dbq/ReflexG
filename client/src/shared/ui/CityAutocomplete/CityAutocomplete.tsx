import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { searchCities, type CitySearchItem } from '@/shared/lib/citySearch'

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (city: CitySearchItem) => void
  placeholder?: string
}

export default function CityAutocomplete({ value, onChange, onSelect, placeholder }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CitySearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    let t: number | undefined
    const q = value.trim()
    if (!q) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    t = window.setTimeout(async () => {
      try {
        const res = await searchCities(q, 12)
        if (!cancelled) setItems(res)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; if (t) window.clearTimeout(t) }
  }, [value])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="input"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
      />
      {open && (items.length > 0 || loading) ? (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-accent" style={{ background: 'var(--color-bg)' }}>
          {loading ? (
            <div className="p-3 text-sm text-muted">Поиск…</div>
          ) : (
            items.map(c => (
              <button key={c.id} className="w-full text-left px-3 py-2 hover:underline-accent hover:underline" onClick={() => { onSelect(c); setOpen(false) }}>
                {c.name} <span className="text-muted">{c.country}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}


