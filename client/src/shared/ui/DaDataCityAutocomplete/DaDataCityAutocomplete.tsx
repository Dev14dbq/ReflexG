import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { searchCities, type CitySearchItem } from '@/shared/lib/citySearch'

export interface DaDataCityItem {
  id: string
  name: string
  country: string
  region?: string
  lat: number
  lon: number
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (city: DaDataCityItem) => void
  placeholder?: string
}

export default function DaDataCityAutocomplete({ value, onChange, onSelect, placeholder }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<DaDataCityItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)
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
      setError(null)
      setIsFallback(false)
      return
    }
    
    if (q.length < 2) {
      setItems([])
      setLoading(false)
      setError(null)
      setIsFallback(false)
      return
    }

    setLoading(true)
    setError(null)
    setIsFallback(false)
    
    t = window.setTimeout(async () => {
      try {
        // Сначала пробуем DaData API
        const response = await fetch('/api/dadata/suggest/city', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q, limit: 12 })
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        
        if (!cancelled) {
          if (data.ok && Array.isArray(data.items)) {
            setItems(data.items)
            setError(null)
            setIsFallback(false)
            return
          } else {
            throw new Error('Invalid response format')
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('DaData search failed, falling back to local search:', err)
          
          // Fallback на локальный поиск
          try {
            const fallbackItems = await searchCities(q, 12)
            const convertedItems: DaDataCityItem[] = fallbackItems.map(item => ({
              id: item.id,
              name: item.name,
              country: item.country,
              lat: item.lat,
              lon: item.lon
            }))
            
            setItems(convertedItems)
            setError(null)
            setIsFallback(true)
          } catch (fallbackErr) {
            console.error('Fallback search also failed:', fallbackErr)
            setItems([])
            setError('Ошибка поиска')
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 300) // Увеличиваем задержку для DaData API

    return () => { 
      cancelled = true
      if (t) window.clearTimeout(t) 
    }
  }, [value])

  const handleSelect = (city: DaDataCityItem) => {
    onSelect(city)
    setOpen(false)
  }

  // Функция для проверки, нужно ли скрывать регион
  const shouldHideRegion = (city: DaDataCityItem): boolean => {
    if (!city.region) return true
    const cityName = city.name.toLowerCase().trim().replace(/\s+/g, ' ')
    const regionName = city.region.toLowerCase().trim().replace(/\s+/g, ' ')
    
    // Если название города совпадает с названием региона, скрываем регион
    return cityName === regionName
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="input"
        value={value}
        onChange={e => { 
          onChange(e.target.value)
          setOpen(true)
          setError(null)
        }}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
      />
      
      {open && (items.length > 0 || loading || error) ? (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-accent max-h-64 overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
          {loading ? (
            <div className="p-3 text-sm text-muted">Поиск…</div>
          ) : error ? (
            <div className="p-3 text-sm text-red-500">{error}</div>
          ) : (
            <>
              {isFallback && (
                <div className="px-3 py-2 text-xs text-muted border-b border-accent">
                  Поиск через локальную базу (DaData недоступен)
                </div>
              )}
              {items.map(city => (
                <button 
                  key={city.id} 
                  className="w-full text-left px-3 py-2 hover:underline-accent hover:underline" 
                  onClick={() => handleSelect(city)}
                >
                  <div className="font-medium">{city.name}</div>
                  {city.region && !shouldHideRegion(city) && (
                    <div className="text-xs text-muted">{city.region}</div>
                  )}
                  <div className="text-xs text-muted">{city.country}</div>
                </button>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
