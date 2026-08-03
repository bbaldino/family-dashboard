import type { ReactNode } from 'react'

/**
 * Small uppercase mono label that sits above a headline or column — a
 * section's byline. Mock default is bold rust (`broadsheet-v2.jsx:47-49`);
 * pass `color` to mute it (the mock does this explicitly for secondary
 * kickers like "The week ahead" and "Coming up" — `color={C.sub}`).
 */
export function Kicker({
  children,
  className = '',
  color = 'var(--rust)',
}: {
  children: ReactNode
  className?: string
  color?: string
}) {
  return (
    <div
      className={`uppercase ${className}`}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.26em',
        fontWeight: 700,
        color,
      }}
    >
      {children}
    </div>
  )
}
