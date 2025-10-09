import { type JSX } from 'react'

export default function PrivacyPage(): JSX.Element {
  return (
    <div className="max-w-md mx-auto h-full bg-[var(--color-bg)]">
      <div className="px-4 h-full flex items-center justify-center text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
        {/* Пустая страница-константа. Контент будет добавлен позже. */}
        <span className="text-sm">Здесь скоро появится политика конфиденциальности</span>
      </div>
    </div>
  )
}


