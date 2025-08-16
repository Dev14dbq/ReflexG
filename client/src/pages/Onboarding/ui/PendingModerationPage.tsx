import type { JSX } from 'react'

function openTelegramChannel(url: string): void {
  try {
    const anyWin = window as any
    if (anyWin?.Telegram?.WebApp?.openTelegramLink) {
      anyWin.Telegram.WebApp.openTelegramLink(url)
      return
    }
  } catch {}
  window.open(url, '_blank', 'noopener')
}

export default function PendingModerationPage(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col bg-ripple">

      <div
        className="flex-1 flex items-center justify-center px-4 relative"
        style={{ transform: 'translateY(-8%)' }}
      >
        <div className="w-full max-w-md text-center">
          <div className="text-2xl font-semibold">Анкета на модерации</div>
          <div className="mt-2 text-sm text-muted">
            Мы проверяем вашу анкету. Мы проверим быстрее, если вы будете участником нашего телеграм-канала.
          </div>
        </div>
      </div>

      <div
        className="sticky bottom-0 left-0 right-0 px-4 pb-4 pt-2 relative"
        style={{ background: 'var(--color-bg)', zIndex: 3 }}
      >
        <div className="max-w-md mx-auto">
          <button
            onClick={() => openTelegramChannel('https://t.me/spectr_info')}
            className="w-full border-2 border-accent rounded-lg font-medium py-4 px-5 flex items-center gap-3"
            style={{ background: 'transparent', justifyContent: 'flex-start' }}
          >
            <img
              src="https://cdn.spectrmod.ru/Spectr.jpg"
              alt="Spectr Reflex"
              width={28}
              height={28}
              style={{ borderRadius: '100px' }}
            />
            <span className="text-lg">Spectr Reflex</span>
          </button>
        </div>
      </div>
    </div>
  )
}
