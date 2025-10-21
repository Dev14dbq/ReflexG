import type { JSX } from 'react'
import { useRef, useState, useEffect } from 'react'
import { RiSendPlane2Line, RiAttachment2, RiEmojiStickerLine } from 'react-icons/ri'

interface ChatComposerProps {
  onSend?: (text: string) => void
  onAttach?: () => void
  onStickers?: () => void
  disabled?: boolean
}

export default function ChatComposer({ onSend, onAttach, onStickers, disabled }: ChatComposerProps): JSX.Element {
  const [text, setText] = useState('')
  const areaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    const max = 120 // px
    el.style.height = Math.min(max, el.scrollHeight) + 'px'
  }, [text])

  function handleSend(): void {
    const value = text.trim()
    if (!value) return
    onSend?.(value)
    setText('')
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10 px-3 py-2 border-t border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] bg-[var(--color-bg)]"
      style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-md mx-auto flex items-center gap-2">
        <button
          aria-label="Прикрепить"
          className="w-10 h-10 flex items-center justify-center text-[var(--color-accent)] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-default"
          onClick={() => onAttach?.()}
          disabled={disabled}
          type="button"
        >
          <RiAttachment2 size={22} />
        </button>

        <button
          aria-label="Стикеры"
          className="w-10 h-10 flex items-center justify-center text-[var(--color-accent)] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-default"
          onClick={() => onStickers?.()}
          disabled={disabled}
          type="button"
        >
          <RiEmojiStickerLine size={22} />
        </button>

        <div className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] flex items-center min-h-[40px]">
          <textarea
            ref={areaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            placeholder="Сообщение..."
            className="w-full bg-transparent outline-none focus:outline-none focus:ring-0 focus:shadow-none appearance-none resize-none overflow-auto text-[var(--color-fg)] placeholder:text-[color-mix(in_oklab,var(--color-fg)60%,transparent)]"
            style={{ maxHeight: 120 }}
            disabled={disabled}
          />
        </div>

        <button
          aria-label="Отправить"
          className="w-10 h-10 flex items-center justify-center text-[var(--color-accent)] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-default"
          onClick={handleSend}
          disabled={!text.trim() || disabled}
        >
          <RiSendPlane2Line size={22} />
        </button>
      </div>
    </div>
  )
}


