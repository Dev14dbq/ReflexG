import type { JSX } from 'react'
import { useState, useEffect } from 'react'

interface DesktopProfileLayoutProps {
  children: JSX.Element
}

export default function DesktopProfileLayout({ children }: DesktopProfileLayoutProps): JSX.Element {
  return (
    <div className="h-full bg-[var(--color-bg)]">
      {children}
    </div>
  )
}
