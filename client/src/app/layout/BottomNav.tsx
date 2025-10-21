import type { JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { RiChat3Line, RiHeart2Line, RiSearchLine, RiUser3Line } from 'react-icons/ri'
import { BOTTOM_NAV_HEIGHT_PX } from '@/app/layout/constants'

function className(active: boolean): string {
  return `flex flex-col items-center justify-center px-3 py-2 transition-all duration-200 ease-out hover:scale-105 ${active ? 'text-[var(--color-accent)] scale-105' : 'text-[color-mix(in oklab,var(--color-fg)70%,transparent)]'}`
}

export default function BottomNav(): JSX.Element {
  return (
    <nav className="fixed bottom-0 left-0 right-0" style={{ background: 'var(--color-bg)', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', height: `${BOTTOM_NAV_HEIGHT_PX}px`, zIndex: 40 }}>
      <div className="max-w-md mx-auto grid grid-cols-4">
        <NavLink to="/chat" className={({ isActive }) => className(isActive)}>
          <RiChat3Line size={25} className="transition-transform duration-200 ease-out" />
        </NavLink>
        <NavLink to="/likes" className={({ isActive }) => className(isActive)}>
          <RiHeart2Line size={25} className="transition-transform duration-200 ease-out" />
        </NavLink>
        <NavLink to="/explore" className={({ isActive }) => className(isActive)}>
          <RiSearchLine size={25} className="transition-transform duration-200 ease-out" />
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => className(isActive)}>
          <RiUser3Line size={25} className="transition-transform duration-200 ease-out" />
        </NavLink>
      </div>
    </nav>
  )
}


