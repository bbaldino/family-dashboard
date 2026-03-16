import type { ReactNode } from 'react'
import { useEffect } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  height?: 'partial' | 'full'
}

export function BottomSheet({ isOpen, onClose, children, height = 'partial' }: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) { document.body.style.overflow = 'hidden' }
    else { document.body.style.overflow = '' }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null
  const heightClass = height === 'full' ? 'h-full' : 'h-[85vh]'

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-bg-overlay animate-[fadeIn_200ms_ease-out]" />
      <div
        className={`absolute bottom-0 left-0 right-0 ${heightClass} bg-bg-card rounded-t-[24px] shadow-lg animate-[slideUp_300ms_ease-out] overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-bg-card">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}
