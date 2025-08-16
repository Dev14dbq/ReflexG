import type { JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { RiChat3Line, RiHeart2Line, RiSearchLine, RiUser3Line } from 'react-icons/ri'

function cn(active: boolean): string {
  return `flex flex-col items-center justify-center gap-1 px-3 py-2 ${active ? 'text-[var(--color-accent)]' : 'text-[color-mix(in oklab,var(--color-fg)70%,transparent)]'}`
}

export default function BottomNav(): JSX.Element {
  return (
    <nav className="fixed bottom-0 left-0 right-0" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-md mx-auto grid grid-cols-4">
        <NavLink to="/messages" className={({ isActive }) => cn(isActive)}>
          <RiChat3Line size={22} />
          <span className="text-xs">Сообщения</span>
        </NavLink>
        <NavLink to="/likes" className={({ isActive }) => cn(isActive)}>
          <RiHeart2Line size={22} />
          <span className="text-xs">Лайки</span>
        </NavLink>
        <NavLink to="/explore" className={({ isActive }) => cn(isActive)}>
          <RiSearchLine size={22} />
          <span className="text-xs">Анкеты</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => cn(isActive)}>
          <RiUser3Line size={22} />
          <span className="text-xs">Профиль</span>
        </NavLink>
      </div>
    </nav>
  )
}


