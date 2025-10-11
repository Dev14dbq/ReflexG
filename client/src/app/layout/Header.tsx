import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Header({ title = 'Okeano' }: { title?: string }): JSX.Element {
  const navigate = useNavigate()
  
  const handleClick = () => {
    if (title === 'Okeano') {
      navigate('/about-position')
    }
  }
  
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center"
      style={{
        height: '100px',
        paddingTop: '40px',
        background: 'var(--color-bg)',
        borderBottom: '1px solid color-mix(in oklab, var(--color-accent) 20%, transparent)'
      }}
    >
      <div 
        className="relative inline-block cursor-pointer p-[10px] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors"
        onClick={handleClick}
      >
        <h1 className="text-xl font-bold text-[var(--color-fg)] inline-block relative">
          {title}
          <img
            src="/bow.png"
            alt=""
            className="absolute w-[0.6rem] h-auto"
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
