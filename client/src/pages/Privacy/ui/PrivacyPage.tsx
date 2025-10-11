import { useEffect, useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiShieldLine, RiDeleteBinLine, RiArchiveLine, RiHeartLine, RiSettings3Line } from 'react-icons/ri'
import { toast } from 'sonner'

interface PrivacySettings {
  allowDataForTraining: boolean
  autoDeleteMessages: 'DAY' | 'WEEK' | 'MONTH' | 'HALF_YEAR'
  blacklistCount: number
  archiveCount: number
  likesHistoryCount: number
}

export default function PrivacyPage(): JSX.Element {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<PrivacySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAutoDeleteOptions, setShowAutoDeleteOptions] = useState(false)

  // Функция для форматирования периода автоудаления
  const formatAutoDeletePeriod = (period: string) => {
    switch (period) {
      case 'DAY': return '1д'
      case 'WEEK': return '1н'
      case 'MONTH': return '1м'
      case 'HALF_YEAR': return '6м'
      default: return '6м'
    }
  }

  // Варианты автоудаления
  const AUTO_DELETE_OPTIONS = [
    { value: 'DAY', label: '1 день' },
    { value: 'WEEK', label: '1 неделя' },
    { value: 'MONTH', label: '1 месяц' },
    { value: 'HALF_YEAR', label: '6 месяцев' }
  ] as const

  // Добавляем стили для чекбоксов и радио-кнопок
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .privacy-page input[type="checkbox"],
      .privacy-page input[type="radio"] {
        appearance: none !important;
        -webkit-appearance: none !important;
        -moz-appearance: none !important;
        width: 1.25rem !important;
        height: 1.25rem !important;
        border: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent) !important;
        background: var(--color-bg) !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        position: relative !important;
        margin: 0 !important;
        margin-right: 0.75rem !important;
        padding: 0 !important;
        flex-shrink: 0 !important;
      }
      
      .privacy-page input[type="checkbox"] {
        border-radius: 0.25rem !important;
      }
      
      .privacy-page input[type="radio"] {
        border-radius: 50% !important;
      }
      
      .privacy-page input[type="checkbox"]:hover,
      .privacy-page input[type="radio"]:hover {
        border-color: var(--color-accent) !important;
        background: color-mix(in oklab, var(--color-bg) 95%, var(--color-accent) 5%) !important;
      }
      
      .privacy-page input[type="checkbox"]:checked,
      .privacy-page input[type="radio"]:checked {
        border-color: var(--color-accent) !important;
        background: var(--color-accent) !important;
      }
      
      .privacy-page input[type="checkbox"]:checked::after {
        content: '✓' !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        color: white !important;
        font-size: 1rem !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        text-shadow: none !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      
      .privacy-page input[type="radio"]:checked::after {
        content: '' !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 0.5rem !important;
        height: 0.5rem !important;
        border-radius: 50% !important;
        background: white !important;
      }
      
      .privacy-page input[type="checkbox"]:focus,
      .privacy-page input[type="radio"]:focus {
        outline: 2px solid var(--color-accent) !important;
        outline-offset: 2px !important;
      }
      
      .privacy-page input[type="checkbox"]:disabled,
      .privacy-page input[type="radio"]:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }
      
      .privacy-page input[type="checkbox"]:disabled:hover,
      .privacy-page input[type="radio"]:disabled:hover {
        border-color: color-mix(in oklab, var(--color-accent) 40%, transparent) !important;
        background: var(--color-bg) !important;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [])


  // Загрузка настроек
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const response = await fetch(`/api/privacy/settings?initData=${encodeURIComponent(initData)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Privacy settings response:', data)
        
        // Преобразуем данные в нужный формат
        const settings: PrivacySettings = {
          allowDataForTraining: data.settings?.allowDataForTraining ?? true,
          autoDeleteMessages: data.settings?.autoDeleteMessages || 'HALF_YEAR',
          blacklistCount: data.blacklist?.length || 0,
          archiveCount: data.archive?.length || 0,
          likesHistoryCount: data.likesHistory?.length || 0
        }
        
        setSettings(settings)
      } else {
        const errorData = await response.json()
        console.error('Privacy settings error:', errorData)
        toast.error('Ошибка загрузки настроек')
      }
    } catch (error) {
      console.error('Privacy settings fetch error:', error)
      toast.error('Ошибка загрузки настроек')
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async (updates: Partial<PrivacySettings>) => {
    if (!settings) return
    
    setSaving(true)
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const response = await fetch('/api/privacy/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          initData, 
          autoDeleteMessages: updates.autoDeleteMessages,
          allowDataForTraining: updates.allowDataForTraining 
        })
      })
      
      if (response.ok) {
        setSettings({ ...settings, ...updates })
        toast.success('Настройки сохранены')
      } else {
        toast.error('Ошибка сохранения')
      }
    } catch (error) {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }


  if (loading) {
    return (
      <div className="max-w-md mx-auto h-full bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-[var(--color-fg)]">Загрузка...</div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="max-w-md mx-auto h-full bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-red-500">Ошибка загрузки настроек</div>
      </div>
    )
  }

  return (
    <div className="privacy-page max-w-md mx-auto h-full bg-[var(--color-bg)] overflow-y-auto">
      <div className="px-4 py-6 space-y-6">
        
        {/* Основные функции - кнопки */}
        <div className="bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-lg overflow-hidden">
          
          {/* Автоудаление сообщений */}
          <button 
            className="w-full p-4 flex items-center gap-3 hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors"
            onClick={() => setShowAutoDeleteOptions(!showAutoDeleteOptions)}
          >
            <div className="w-8 h-8 rounded-md bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
              <RiDeleteBinLine size={20} className="text-[var(--color-accent)]" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-lg font-semibold text-[var(--color-fg)]">Автоудаление сообщений</h3>
            </div>
            <div className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
              {settings?.autoDeleteMessages ? formatAutoDeletePeriod(settings.autoDeleteMessages) : '6м'}
            </div>
          </button>

          {/* Выпадающие опции автоудаления */}
          <div 
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showAutoDeleteOptions 
                ? 'max-h-96 opacity-100' 
                : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-4 pb-4 bg-[color-mix(in_oklab,var(--color-bg)98%,var(--color-accent)2%)] border-t border-[color-mix(in_oklab,var(--color-accent)10%,transparent)]">
              <div className="space-y-2 pt-4">
                {AUTO_DELETE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="autoDelete"
                      value={option.value}
                      checked={settings?.autoDeleteMessages === option.value}
                      onChange={() => updateSettings({ autoDeleteMessages: option.value })}
                      disabled={saving}
                      className=""
                    />
                    <span className="text-sm text-[var(--color-fg)] ml-3">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Разделитель */}
          <div className="border-t border-[color-mix(in_oklab,var(--color-accent)10%,transparent)]"></div>

          {/* Черный список */}
          <button 
            className="w-full p-4 flex items-center gap-3 hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors"
            onClick={() => navigate('/blacklist')}
          >
            <div className="w-8 h-8 rounded-md bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
              <RiShieldLine size={20} className="text-[var(--color-accent)]" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-lg font-semibold text-[var(--color-fg)]">Черный список</h3>
            </div>
            <div className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
              {settings?.blacklistCount || 0}
            </div>
          </button>

          {/* Разделитель */}
          <div className="border-t border-[color-mix(in_oklab,var(--color-accent)10%,transparent)]"></div>

          {/* Архив */}
          <button 
            className="w-full p-4 flex items-center gap-3 hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors"
            onClick={() => {
              toast.info('Архив в разработке', {
                description: 'Эта функция будет доступна в следующих обновлениях',
                duration: 3000
              })
            }}
          >
            <div className="w-8 h-8 rounded-md bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
              <RiArchiveLine size={20} className="text-[var(--color-accent)]" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-lg font-semibold text-[var(--color-fg)]">Архив</h3>
            </div>
            <div className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
              {settings?.archiveCount || 0}
            </div>
          </button>

          {/* Разделитель */}
          <div className="border-t border-[color-mix(in_oklab,var(--color-accent)10%,transparent)]"></div>

          {/* История лайков */}
          <button 
            className="w-full p-4 flex items-center gap-3 hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors"
            onClick={() => {}}
          >
            <div className="w-8 h-8 rounded-md bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
              <RiHeartLine size={20} className="text-[var(--color-accent)]" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-lg font-semibold text-[var(--color-fg)]">История лайков</h3>
            </div>
            <div className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
              {settings?.likesHistoryCount || 0}
            </div>
          </button>

        </div>

        {/* Использование данных - отдельный блок */}
        <div className="bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-md bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
              <RiSettings3Line size={20} className="text-[var(--color-accent)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-fg)]">Использование данных</h3>
          </div>
          
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowDataForTraining}
              onChange={(e) => updateSettings({ allowDataForTraining: e.target.checked })}
              disabled={saving}
              className=""
            />
            <div>
              <span className="text-sm text-[var(--color-fg)] font-medium">
              Помогает улучшать алгоритмы подбора и фильтрации контента
              </span>
            </div>
          </label>
        </div>

      </div>
    </div>
  )
}


