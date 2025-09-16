import type { JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { RiDashboardLine, RiShieldCheckLine, RiUserLine } from 'react-icons/ri'

function cn(active: boolean): string {
  return `flex flex-col items-center justify-center gap-1 px-3 py-2 transition-all duration-200 ease-out hover:scale-105 ${active ? 'text-[var(--color-accent)] scale-105' : 'text-[color-mix(in oklab,var(--color-fg)70%,transparent)]'}`
}

export default function AdminBottomNav(): JSX.Element {
  return (
    <nav className="fixed bottom-0 left-0 right-0" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-md mx-auto grid grid-cols-3">
        <NavLink to="/admin" className={({ isActive }) => cn(isActive)}>
          <RiDashboardLine size={22} className="transition-transform duration-200 ease-out" />
          <span className="text-xs">Обзор</span>
        </NavLink>
        <NavLink to="/admin/moderation" className={({ isActive }) => cn(isActive)}>
          <RiShieldCheckLine size={22} className="transition-transform duration-200 ease-out" />
          <span className="text-xs">Модерация</span>
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => cn(isActive)}>
          <RiUserLine size={22} className="transition-transform duration-200 ease-out" />
          <span className="text-xs">Пользователи</span>
        </NavLink>
      </div>
    </nav>
  )
}
