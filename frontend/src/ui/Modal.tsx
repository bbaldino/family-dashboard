import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-bg-overlay animate-[fadeIn_200ms_ease-out]" />
      <div
        className="relative w-[min(480px,90vw)] max-h-[80vh] bg-bg-card rounded-[var(--radius-card)] shadow-lg animate-[fadeIn_200ms_ease-out] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border sticky top-0 bg-bg-card z-10">
          {title && (
            <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--radius-button)] text-text-muted hover:text-text-secondary hover:bg-bg-card-hover transition-colors ml-auto"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
