/** 1px rule — the workhorse separator. */
export function Hairline({ className = '' }: { className?: string }) {
  return <div className={`w-full ${className}`} style={{ height: 1, background: 'var(--rule)' }} />
}
