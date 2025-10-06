import type { JSX, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface BottomSheetProps {
  isOpen: boolean
  title?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export default function BottomSheet({ isOpen, title, onClose, children, footer }: BottomSheetProps): JSX.Element | null {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // Двойной requestAnimationFrame для гарантии рендера
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
    } else {
      // Сначала запускаем анимацию исчезновения
      setIsAnimating(false)
      // Затем ждем завершения анимации и скрываем элемент
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 300) // 300ms - длительность анимации
      
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isVisible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isVisible, onClose])

  if (!isVisible) return null

  return createPortal(
    <div className="fixed inset-0 z-50" style={{ zIndex: 999999 }}>
      {/* backdrop */}
      <div 
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        style={{ 
          zIndex: 1,
          opacity: isAnimating ? 1 : 0,
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      ></div>

      {/* sheet */}
      <div className="absolute inset-x-0 bottom-0" style={{ zIndex: 2 }}>
        <div 
          className="mx-auto max-w-md rounded-t-[30px] border border-[color-mix(in_oklab,var(--color-accent)15%,transparent)] bg-[var(--color-bg)] shadow-xl"
          style={{
            transform: isAnimating ? 'translateY(0)' : 'translateY(100%)',
            opacity: isAnimating ? 1 : 0,
            transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* handle */}
          <div className="flex items-center justify-center py-2">
            <div className="h-1.5 w-12 rounded-full bg-[color-mix(in_oklab,var(--color-fg)30%,transparent)]"></div>
          </div>
          {title ? (
            <div className="px-4 pb-2">
              <div className="text-sm font-semibold text-[color-mix(in_oklab,var(--color-fg)80%,var(--color-muted)20%)]">{title}</div>
            </div>
          ) : null}
          <div 
            className="px-4 py-2 max-h-[65vh] overflow-y-auto"
            style={{
              opacity: isAnimating ? 1 : 0,
              transition: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {children}
          </div>
          {footer ? (
            <div 
              className="px-4 py-3 pb-6 border-t border-[color-mix(in_oklab,var(--color-accent)15%,transparent)] bg-[color-mix(in_oklab,var(--color-bg)97%,var(--color-accent)3%)]"
              style={{
                opacity: isAnimating ? 1 : 0,
                transition: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}


