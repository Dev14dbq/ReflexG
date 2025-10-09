import type { JSX } from 'react'

export default function Header({ title = 'Okeano' }: { title?: string }): JSX.Element {
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
      <h1 className="text-xl font-bold text-[var(--color-fg)]">{title}</h1>
    </header>
  )
}
