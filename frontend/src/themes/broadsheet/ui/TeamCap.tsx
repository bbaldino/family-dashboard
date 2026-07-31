const FALLBACK_PRIMARY = '#191512'
const FALLBACK_SECONDARY = '#f6f1e7'

/** ESPN's team colours arrive without a leading '#'; be forgiving either way. */
function toHex(color: string | null | undefined): string | null {
  if (!color) return null
  return color.startsWith('#') ? color : `#${color}`
}

/**
 * Team colour disc with the abbreviation. Real feed colours are nullable (and
 * arrive without a leading '#'), so this owns both the '#' normalisation and
 * the ink-on-paper fallback rather than rendering an invisible cap — callers
 * just pass the raw feed value through.
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
        background: toHex(primary) ?? FALLBACK_PRIMARY,
        color: toHex(secondary) ?? FALLBACK_SECONDARY,
        fontFamily: 'var(--font-mono)',
        fontSize: size * 0.3,
        letterSpacing: '0.05em',
      }}
    >
      {short}
    </div>
  )
}
