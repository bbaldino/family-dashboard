import type { ReactNode } from 'react'

interface GridLayoutProps {
  children: ReactNode
}

export function GridLayout({ children }: GridLayoutProps) {
  return (
    <div
      className="flex-1 grid grid-cols-3 grid-rows-2 gap-[var(--spacing-grid-gap)] min-h-0"
      style={{ gridAutoFlow: 'dense' }}
    >
      {children}
    </div>
  )
}
