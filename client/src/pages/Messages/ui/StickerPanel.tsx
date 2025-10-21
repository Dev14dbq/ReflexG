import type { JSX } from 'react'
import { useState, useEffect } from 'react'
import { RiAddLine, RiCloseLine } from 'react-icons/ri'
import { fetchAllUserStickers, importStickerPack, sendStickerMessage, type UserSticker } from '@/shared/api/chat'
import { cfImage } from '@/shared/lib/image'

interface StickerPanelProps {
  chatId: string
  onStickerSent?: () => void
  onClose?: () => void
}

export default function StickerPanel({ chatId, onStickerSent, onClose }: StickerPanelProps): JSX.Element {
  const [stickers, setStickers] = useState<UserSticker[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    loadStickers()
  }, [])

  async function loadStickers(): Promise<void> {
    try {
      console.log('Loading stickers...')
      const initData = window?.Telegram?.WebApp?.initData || ''
      const response = await fetchAllUserStickers(initData)
      console.log('Loaded stickers:', response.stickers.length)
      response.stickers.forEach(sticker => {
        console.log('- Sticker:', sticker.id, sticker.name, sticker.packName)
      })
      setStickers(response.stickers)
    } catch (error) {
      console.error('Failed to load stickers:', error)
      // Fallback to console log if Telegram WebApp API is not available
      alert('Ошибка загрузки стикеров')
    } finally {
      setLoading(false)
    }
  }

  async function handleStickerClick(sticker: UserSticker): Promise<void> {
    try {
      console.log('Sending sticker:', { stickerId: sticker.id, chatId, sticker })
      const initData = window?.Telegram?.WebApp?.initData || ''
      console.log('Init data:', initData ? 'present' : 'missing')
      
      const sentMessage = await sendStickerMessage(initData, chatId, sticker.id)
      console.log('Sticker sent successfully:', sentMessage)
      onStickerSent?.()
    } catch (error) {
      console.error('Failed to send sticker:', error)
      alert(`Ошибка отправки стикера: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    }
  }

  async function handleImport(): Promise<void> {
    if (!importUrl.trim()) return
    
    try {
      setImporting(true)
      const initData = window?.Telegram?.WebApp?.initData || ''
      await importStickerPack(initData, importUrl.trim())
      
      setImportUrl('')
      setShowImport(false)
      await loadStickers() // Reload stickers
      
      alert('Стикер-пак успешно добавлен!')
    } catch (error) {
      console.error('Failed to import sticker pack:', error)
      alert(`Ошибка импорта: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setImporting(false)
    }
  }

  // Group stickers by pack
  const stickersByPack = stickers.reduce((acc, sticker) => {
    const packName = sticker.packName
    if (!acc[packName]) acc[packName] = []
    acc[packName].push(sticker)
    return acc
  }, {} as Record<string, UserSticker[]>)

  const packNames = Object.keys(stickersByPack)

  if (loading) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[var(--color-bg)] border-t border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] p-4">
        <div className="max-w-md mx-auto text-center">
          <div className="text-[var(--color-fg)]">Загрузка стикеров...</div>
        </div>
      </div>
    )
  }

  if (showImport) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[var(--color-bg)] border-t border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setShowImport(false)}
              className="w-8 h-8 flex items-center justify-center text-[var(--color-accent)] hover:opacity-80"
            >
              <RiCloseLine size={20} />
            </button>
            <h3 className="text-[var(--color-fg)] font-medium">Добавить стикер-пак</h3>
          </div>
          
          <div className="space-y-3">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://t.me/addstickers/NAME"
              className="w-full px-3 py-2 rounded-xl bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] border border-[color-mix(in_oklab,var(--color-accent)20%,transparent)] text-[var(--color-fg)] placeholder:text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]"
            />
            
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={!importUrl.trim() || importing}
                className="flex-1 px-4 py-2 bg-[var(--color-accent)] text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-default"
              >
                {importing ? 'Добавление...' : 'Добавить'}
              </button>
              
              <button
                onClick={() => setShowImport(false)}
                className="px-4 py-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] text-[var(--color-fg)] rounded-xl hover:opacity-90"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (stickers.length === 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[var(--color-bg)] border-t border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] p-4">
        <div className="max-w-md mx-auto text-center">
          <div className="text-[var(--color-fg)] mb-3">У вас пока нет стикеров</div>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-xl hover:opacity-90"
          >
            Добавить стикер-пак
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-[var(--color-bg)] border-t border-[color-mix(in_oklab,var(--color-accent)10%,transparent)]">
      {/* Header with pack names */}
      <div className="px-4 py-2 border-b border-[color-mix(in_oklab,var(--color-accent)10%,transparent)]">
        <div className="max-w-md mx-auto flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setShowImport(true)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-[var(--color-accent)] hover:opacity-80"
          >
            <RiAddLine size={20} />
          </button>
          
          {packNames.map((packName) => (
            <button
              key={packName}
              className="flex-shrink-0 px-3 py-1 text-sm bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] text-[var(--color-fg)] rounded-lg hover:opacity-90"
            >
              {packName}
            </button>
          ))}
        </div>
      </div>

      {/* Stickers grid */}
      <div className="p-4 max-h-64 overflow-y-auto">
        <div className="max-w-md mx-auto">
          <div className="grid grid-cols-4 gap-2">
            {stickers.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => handleStickerClick(sticker)}
                className="aspect-square rounded-xl overflow-hidden hover:opacity-80 transition-opacity"
              >
                <img
                  src={cfImage(sticker.imageUrl, { variant: 'media', width: 128, quality: 85, format: 'auto' })}
                  alt={sticker.name || 'Стикер'}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
