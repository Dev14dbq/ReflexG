import { useEffect, useState } from 'react'

interface PhotoPreviewModalProps {
  file: File | null
  onConfirm: () => void
  onCancel: () => void
}

export const PhotoPreviewModal = ({ file, onConfirm, onCancel }: PhotoPreviewModalProps) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (file) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [file])

  const handleCancel = () => {
    setIsVisible(false)
    setTimeout(() => onCancel(), 150) // Ждем завершения анимации
  }

  const handleConfirm = () => {
    setIsVisible(false)
    setTimeout(() => onConfirm(), 150) // Ждем завершения анимации
  }

  if (!file) return null

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 transition-opacity duration-150 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`w-full h-full flex flex-col items-center justify-center transition-all duration-150 ${isVisible ? 'transform scale-100 opacity-100' : 'transform scale-95 opacity-0'}`}>
        <img 
          src={URL.createObjectURL(file)} 
          alt="Предварительный просмотр" 
          className="w-full max-w-sm aspect-[9/16] object-cover rounded-lg mb-6"
        />
        <div className="flex gap-3 w-full max-w-sm">
          <button 
            className="btn flex-1" 
            onClick={handleCancel}
          >
            Отмена
          </button>
          <button 
            className="btn btn-primary flex-1" 
            onClick={handleConfirm}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}
