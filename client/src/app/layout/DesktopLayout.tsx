import type { JSX } from 'react'
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import DesktopSidebar from './DesktopSidebar'
import DesktopTopBar from './DesktopTopBar'
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts'

interface DesktopLayoutProps {
  children: JSX.Element
}

export default function DesktopLayout({ children }: DesktopLayoutProps): JSX.Element {
  const [isDesktop, setIsDesktop] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  
  // Подключаем клавиатурные шорткаты
  useKeyboardShortcuts()

  // Определяем размер экрана
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsDesktop(width >= 1024)
      
      // Автоматически сворачиваем сайдбар на средних экранах
      if (width >= 1024 && width < 1280) {
        setSidebarCollapsed(true)
      } else if (width >= 1280) {
        setSidebarCollapsed(false)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Автоматически сворачиваем сайдбар на средних экранах
  useEffect(() => {
    if (window.innerWidth >= 1024 && window.innerWidth < 1280) {
      setSidebarCollapsed(true)
    }
  }, [])

  if (!isDesktop) {
    return children
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Верхняя панель */}
      <DesktopTopBar 
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
      />
      
      <div className="flex h-screen pt-16"> {/* pt-16 для отступа под топ-бар */}
        {/* Левый сайдбар */}
        <DesktopSidebar 
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        
        {/* Основной контент */}
        <main className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}>
          <div className="h-full overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
