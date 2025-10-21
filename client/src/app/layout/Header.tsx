import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { HEADER_HEIGHT_PX } from '@/app/layout/constants'

export default function Header({ title = 'Okeano' }: { title?: string }): JSX.Element {
  const navigate = useNavigate()
  const [isRippling, setIsRippling] = useState(false)
  
  const handleClick = () => {
    if (title === 'Okeano') {
      // Запускаем ripple эффект
      setIsRippling(true)
      
      // Переходим на страницу
      navigate('/about-position')
      
      // Сбрасываем состояние после завершения анимации
      setTimeout(() => {
        setIsRippling(false)
      }, 600)
    }
  }
  
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center"
      style={{
        height: `${HEADER_HEIGHT_PX}px`,
        paddingTop: '40px',
        background: 'var(--color-bg)',
        borderBottom: '1px solid color-mix(in oklab, var(--color-accent) 20%, transparent)'
      }}
    >
      <div 
        className={`relative inline-block cursor-pointer p-[10px] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors ${isRippling ? 'ripple-effect' : ''}`}
        onClick={handleClick}
      >
        <h1 className="text-xl font-bold text-[var(--color-fg)] inline-block relative">
          {title}
          <img
            src="/bow.png"
            alt=""
            width={12}
            loading="eager"
            decoding="async"
            className="absolute"
            style={{
              right: '-0.15rem',
              top: '0.4rem',
              transform: 'rotate(18deg)'
            }}
          />
        </h1>
      </div>
    </header>
  )
}
