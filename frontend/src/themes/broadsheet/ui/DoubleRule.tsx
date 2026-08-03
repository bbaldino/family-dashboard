/** 3px double rule — separates major sections (masthead, glance strip). */
export function DoubleRule({ className = '' }: { className?: string }) {
  return (
    <div
      className={`w-full ${className}`}
      style={{
        height: 3,
        borderTop: '1px solid var(--rule)',
        borderBottom: '1px solid var(--rule)',
      }}
    />
  )
}
