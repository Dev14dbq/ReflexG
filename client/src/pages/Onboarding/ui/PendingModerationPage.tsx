import type { JSX } from 'react'

function openTelegramChannel(url: string): void {
  try {
    if (window?.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url)
      return
    }
  } catch {}
  window.open(url, '_blank', 'noopener')
}

export default function PendingModerationPage(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* фон с рябью */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.08) 2px, transparent 0),
            radial-gradient(circle at 70% 60%, rgba(255,255,255,0.06) 3px, transparent 0),
            radial-gradient(circle at 40% 80%, rgba(255,255,255,0.1) 2px, transparent 0)
          `,
          backgroundSize: '60px 60px',
          filter: 'blur(6px) contrast(120%)',
          zIndex: 0,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 10% 20%, rgba(255,255,255,0.15) 2px, transparent 0),
            radial-gradient(circle at 80% 40%, rgba(255,255,255,0.1) 3px, transparent 0),
            radial-gradient(circle at 50% 70%, rgba(255,255,255,0.12) 2px, transparent 0)
          `,
          backgroundSize: '50px 50px',
          zIndex: 1,
        }}
      />

      <div
        className="flex-1 flex items-center justify-center px-4 relative"
        style={{ transform: 'translateY(-8%)', zIndex: 2 }}
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
