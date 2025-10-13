import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Игнорируем шорткаты если пользователь печатает в поле ввода
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return
      }

      // Ctrl/Cmd + K для глобального поиска
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        // TODO: Открыть модальное окно поиска
        console.log('Global search triggered')
        return
      }

      // Цифровые клавиши для навигации по основным разделам
      if (event.key >= '1' && event.key <= '7' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        
        const shortcuts: { [key: string]: string } = {
          '1': '/theme',
          '2': '/likes', 
          '3': '/explore',
          '4': '/likes-history',
          '5': '/profile',
          '6': '/notifications',
          '7': '/help'
        }

        const targetPath = shortcuts[event.key]
        if (targetPath) {
          navigate(targetPath)
        }
      }

      // Escape для возврата на главную
      if (event.key === 'Escape') {
        event.preventDefault()
        navigate('/theme')
      }

      // Ctrl/Cmd + , для настроек
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault()
        navigate('/chat-settings')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [navigate])
}
