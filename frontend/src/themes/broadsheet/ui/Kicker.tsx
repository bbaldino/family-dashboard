import type { ReactNode } from 'react'

/** Small uppercase mono label that sits above a headline or column. */
export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`text-[11px] uppercase tracking-[0.18em] ${className}`}
      style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}
    >
      {children}
    </div>
  )
}
