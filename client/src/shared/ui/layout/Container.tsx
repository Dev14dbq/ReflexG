import type { PropsWithChildren, JSX } from 'react'

export function Container({ children }: PropsWithChildren): JSX.Element {
  return (
    <div style={{ margin: '0 auto', maxWidth: 1200, padding: '0 16px' }}>
      {children}
    </div>
  )
}

export default Container


