import type { JSX, PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'

import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'

function closeWebApp(): void {
  try {
    const anyWin = window as any
    anyWin?.Telegram?.WebApp?.close?.()
  } catch {}
}

export default function EntryGate({ children }: PropsWithChildren): JSX.Element {
  const { ready, statuses, error } = useTelegramAuth()
  const [minWaitDone, setMinWaitDone] = useState(false)
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setMinWaitDone(true), 1000)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (error) return
    if (ready && minWaitDone && visible && !exiting) {
      setExiting(true)
      const t = window.setTimeout(() => setVisible(false), 400)
      return () => window.clearTimeout(t)
    }
    return
  }, [ready, minWaitDone, error, visible, exiting])

  // Функция для извлечения содержимого из <span class="code-label"> тегов
  const extractCodeLabelContent = (errorMessage: string): string | null => {
    const match = errorMessage.match(/<span class="code-label">([^<]*)<\/span>/i)
    return match ? match[1]?.trim() || null : null
  }

  const rawMessage = error ? (typeof error === 'string' ? error : 'Не удалось выполнить инициализацию') : ''
  const codeLabelContent = extractCodeLabelContent(rawMessage)
  
  // Если найдено содержимое в code-label, показываем только его, иначе скрываем ошибку
  const message = codeLabelContent || (codeLabelContent === null ? rawMessage : '')
  const shouldShowError = codeLabelContent !== null || !rawMessage.includes('<span class="code-label">')
  
  const hint = error && shouldShowError
    ? (/401|unauthorized|invalid/i.test(rawMessage)
        ? 'Данные сессии устарели. Перезагрузите WebApp.'
        : /502|503|timeout|fetch/i.test(rawMessage)
          ? 'Технические неполадки. Попробуйте позже.'
          : undefined)
    : undefined

  return (
    <>
      {children}
      {visible ? (
        <div className={`entry-gate ${exiting ? 'exit' : ''}`} style={{ pointerEvents: exiting ? 'none' : 'auto' }}>
          {!error || !shouldShowError ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
              <div className="loader-ellipsis"><span className="dots"><span>.</span><span>.</span><span>.</span></span></div>
            </div>
          ) : (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
              <div className="text-2xl font-semibold">Ошибка запуска</div>
              <div className="mt-2 text-sm text-muted max-w-md">
                {message}
                {hint ? <><br />{hint}</> : null}
              </div>
              <div className="mt-4 flex gap-2">
                <button className="btn btn-primary" onClick={closeWebApp}>Закрыть приложение</button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </>
  )
}


