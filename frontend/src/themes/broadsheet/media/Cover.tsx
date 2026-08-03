import { gradientForName, initialsForName } from './album-art'

/**
 * One piece of cover art — a real image when `imageUrl` is present, the
 * mock's deterministic gradient fallback otherwise (`media.jsx:38-53`).
 * Real items carry an `imageUrl` served through the app's image proxy;
 * Music Assistant is unreachable from this machine and the music fixtures
 * set every image to `null` (see `album-art.ts`'s header comment), so the
 * gradient path is what actually renders while this screen is built and
 * verified — see this component's own tests for the branch the real-image
 * path takes.
 *
 * `alt=""`: every caller places the track/item name in adjacent text right
 * next to the cover, so a real `<img>`'s alt text would just repeat it —
 * decorative, not informative, per the usual `alt=""` guidance.
 */
export function Cover({
  imageUrl,
  name,
  size = 72,
}: {
  imageUrl: string | null
  name: string
  size?: number
}) {
  if (imageUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  const [a, b] = gradientForName(name)

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${a}, ${b})`,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
      }}
    >
      {/* Faux grooves, mock's texture overlay (`media.jsx:48`). */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 4px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          padding: '4px 6px',
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.7)',
          textTransform: 'uppercase',
        }}
      >
        {initialsForName(name)}
      </div>
    </div>
  )
}
