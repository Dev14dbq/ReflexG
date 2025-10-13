import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiSearchLine, RiSettings3Line, RiMenuFoldLine, RiMenuUnfoldLine, RiNotification3Line } from 'react-icons/ri'

interface DesktopTopBarProps {
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
}

export default function DesktopTopBar({ onToggleSidebar, sidebarCollapsed }: DesktopTopBarProps): JSX.Element {
  const navigate = useNavigate()

  const handleLogoClick = () => {
    navigate('/about-position')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement global search
    console.log('Global search triggered')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-bg)] border-b border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] shadow-sm">
      <div className="h-16 px-4 flex items-center justify-between">
        {/* Левая часть */}
        <div className="flex items-center gap-4">
          {/* Кнопка сворачивания сайдбара */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors"
              title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
              {sidebarCollapsed ? (
                <RiMenuUnfoldLine size={20} className="text-[var(--color-fg)]" />
              ) : (
                <RiMenuFoldLine size={20} className="text-[var(--color-fg)]" />
              )}
            </button>
          )}

          {/* Логотип */}
          <button 
            onClick={handleLogoClick}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors"
          >
            <h1 className="text-xl font-bold text-[var(--color-fg)]">
              Okeano
              <img
                src="/bow.png"
                alt=""
                className="inline w-3 h-auto ml-1"
                style={{ transform: 'rotate(18deg)' }}
              />
            </h1>
          </button>
        </div>

        {/* Центральная часть - поиск */}
        <div className="flex-1 max-w-md mx-8">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative">
              <RiSearchLine 
                size={20} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color-mix(in_oklab,var(--color-fg)50%,transparent)]" 
              />
              <input
                type="text"
                placeholder="Поиск по сообщениям, анкетам..."
                className="w-full pl-10 pr-4 py-2 bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-lg text-[var(--color-fg)] placeholder-[color-mix(in_oklab,var(--color-fg)50%,transparent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
              />
            </div>
          </form>
        </div>

            {/* Правая часть */}
            <div className="flex items-center gap-2">
              {/* Уведомления */}
              <button
                onClick={() => navigate('/notifications')}
                className="p-2 rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors relative"
                title="Уведомления"
              >
                <RiNotification3Line size={20} className="text-[var(--color-fg)]" />
                {/* Бейдж уведомлений */}
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-accent)] text-white text-xs rounded-full flex items-center justify-center">
                  3
                </span>
              </button>
              
              {/* Настройки */}
              <button
                onClick={() => navigate('/chat-settings')}
                className="p-2 rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors"
                title="Настройки"
              >
                <RiSettings3Line size={20} className="text-[var(--color-fg)]" />
              </button>
            </div>
      </div>
    </header>
  )
}
