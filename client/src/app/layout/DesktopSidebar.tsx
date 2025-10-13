import type { JSX } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { 
  RiChat3Line, 
  RiHeart2Line, 
  RiSearchLine, 
  RiUser3Line, 
  RiQuestionLine,
  RiShieldUserLine,
  RiSettings3Line
} from 'react-icons/ri'

interface DesktopSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function DesktopSidebar({ collapsed, onToggle }: DesktopSidebarProps): JSX.Element {
  const location = useLocation()

  const navItems = [
    {
      path: '/theme',
      icon: RiChat3Line,
      label: 'Сообщения',
      badge: null
    },
    {
      path: '/likes',
      icon: RiHeart2Line,
      label: 'Лайки',
      badge: 5 // TODO: Get from state
    },
    {
      path: '/explore',
      icon: RiSearchLine,
      label: 'Анкеты',
      badge: null
    },
    {
      path: '/profile',
      icon: RiUser3Line,
      label: 'Профиль',
      badge: null
    },
    {
      path: '/help',
      icon: RiQuestionLine,
      label: 'Помощь',
      badge: null
    }
  ]

  const adminItems = [
    {
      path: '/admin',
      icon: RiShieldUserLine,
      label: 'Админ панель',
      badge: null
    }
  ]

  const settingsItems = [
    {
      path: '/chat-settings',
      icon: RiSettings3Line,
      label: 'Настройки',
      badge: null
    }
  ]

  const renderNavItem = (item: typeof navItems[0], isActive: boolean) => {
    const Icon = item.icon
    return (
      <NavLink
        to={item.path}
        className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive 
            ? 'bg-[var(--color-accent)] text-white' 
            : 'text-[color-mix(in_oklab,var(--color-fg)70%,transparent)] hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] hover:text-[var(--color-fg)]'
        }`}
        title={collapsed ? item.label : undefined}
      >
        <Icon size={20} className="flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="font-medium">{item.label}</span>
            {item.badge && (
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                isActive ? 'bg-white/20' : 'bg-[var(--color-accent)] text-white'
              }`}>
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </>
        )}
        {collapsed && item.badge && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-accent)] text-white text-xs rounded-full flex items-center justify-center">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
        
        {/* Тултип для свернутого состояния */}
        {collapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            {item.label}
            {item.badge && (
              <span className="ml-1 text-xs text-gray-300">
                ({item.badge > 99 ? '99+' : item.badge})
              </span>
            )}
          </div>
        )}
      </NavLink>
    )
  }

  return (
    <aside className={`fixed left-0 top-16 bottom-0 bg-[var(--color-bg)] border-r border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] transition-all duration-300 z-40 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="h-full flex flex-col">
        {/* Основная навигация */}
        <nav className={`flex-1 space-y-1 ${collapsed ? 'p-2' : 'p-4'}`}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === '/theme' && location.pathname.startsWith('/theme/'))
            return (
              <div key={item.path} className="relative">
                {renderNavItem(item, isActive)}
              </div>
            )
          })}
        </nav>

        {/* Разделитель */}
        <div className={collapsed ? 'px-2' : 'px-4'}>
          <div className="border-t border-[color-mix(in_oklab,var(--color-accent)10%,transparent)]"></div>
        </div>

        {/* Админские функции */}
        <nav className={`space-y-1 ${collapsed ? 'p-2' : 'p-4'}`}>
          {adminItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <div key={item.path} className="relative">
                {renderNavItem(item, isActive)}
              </div>
            )
          })}
        </nav>

        {/* Настройки */}
        <nav className={`space-y-1 ${collapsed ? 'p-2' : 'p-4'}`}>
          {settingsItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <div key={item.path} className="relative">
                {renderNavItem(item, isActive)}
              </div>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
