import { type JSX } from 'react'

export default function ThemeSettingsPage(): JSX.Element {
  return (
    <div className="max-w-md mx-auto h-full bg-[var(--color-bg)]">
      <div className="px-4 h-full flex items-center justify-center text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
        <span className="text-sm">Здесь появятся настройки темы</span>
      </div>
    </div>
  )
}


