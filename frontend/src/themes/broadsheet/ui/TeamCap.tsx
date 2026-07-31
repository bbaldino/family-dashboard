const FALLBACK_PRIMARY = '#191512'
const FALLBACK_SECONDARY = '#f6f1e7'

/**
 * Team colour disc with the abbreviation. Real feed colours are nullable, so
 * both fall back to ink-on-paper rather than rendering an invisible cap.
 */
export function TeamCap({
  short,
  primary,
  secondary,
  size = 36,
}: {
  short: string
  primary?: string | null
  secondary?: string | null
  size?: number
}) {
  return (
    <div
      className="rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: primary ?? FALLBACK_PRIMARY,
        color: secondary ?? FALLBACK_SECONDARY,
        fontFamily: 'var(--font-mono)',
        fontSize: size * 0.3,
        letterSpacing: '0.05em',
      }}
    >
      {short}
    </div>
  )
}
