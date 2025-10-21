import type { JSX } from 'react'
import { RiArrowLeftLine } from 'react-icons/ri'

interface ChatHeaderProps {
  title?: string | null
  avatarUrl?: string | null
  isOnline?: boolean
  onBack: () => void
}

export default function ChatHeader({ title, avatarUrl, isOnline, onBack }: ChatHeaderProps): JSX.Element {
  return (
    <div className="px-4 h-14 border-b border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] bg-[var(--color-bg)] relative flex items-center">
      <button
        aria-label="Назад"
        className="p-2 rounded-lg hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] absolute left-2 top-1/2 -translate-y-1/2"
        onClick={onBack}
      >
        <RiArrowLeftLine size={20} className="text-[var(--color-fg)]" />
      </button>
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center gap-3 min-w-0 max-w-[70%]">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-[color-mix(in_oklab,var(--color-accent)12%,transparent)] flex items-center justify-center flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={title || 'Чат'} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-medium text-[var(--color-accent)]">
              {(title || '').charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate text-[var(--color-fg)]">{title || 'Чат'}</div>
          <div className={`text-xs truncate ${isOnline ? 'text-[var(--color-accent)]' : 'text-muted'}`}>
            {isOnline ? 'В сети' : 'Был недавно'}
          </div>
        </div>
      </div>
    </div>
  )
}


