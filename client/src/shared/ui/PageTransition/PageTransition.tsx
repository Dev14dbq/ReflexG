import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import './PageTransition.css'

interface PageTransitionProps {
  children: ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [displayLocation, setDisplayLocation] = useState(location)

  useEffect(() => {
    if (location !== displayLocation) {
      setIsTransitioning(true)
      
      // Небольшая задержка для плавности анимации
      const timer = setTimeout(() => {
        setDisplayLocation(location)
        setIsTransitioning(false)
      }, 150) // Быстрая анимация - 150ms

      return () => clearTimeout(timer)
    }
  }, [location, displayLocation])

  return (
    <div className={`page-transition ${isTransitioning ? 'transitioning' : ''}`}>
      {children}
    </div>
  )
}
