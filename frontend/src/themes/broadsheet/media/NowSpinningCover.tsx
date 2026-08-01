import { Cover } from './Cover'

/** The vinyl-record disc overlapping the cover's right edge — a decorative
 *  illustration, not a theme surface, so its colours are literal (matching
 *  the mock's own literal values, `media.jsx:178-188`) rather than derived
 *  from the paper/ink palette. */
function LpDisc() {
  return (
    <div
      style={{
        position: 'absolute',
        right: -10,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 160,
        height: 160,
        borderRadius: 160,
        background: 'radial-gradient(circle, #2a1814 0%, #2a1814 30%, #ad3a1a 32%, #2a1814 34%, #2a1814 100%)',
        border: '2px solid var(--ink)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
        opacity: 0.92,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 12,
          borderRadius: '50%',
          background: 'repeating-radial-gradient(circle, rgba(255,255,255,0.04) 0 2px, transparent 2px 4px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 20,
          height: 20,
          borderRadius: 20,
          background: '#1a0e0a',
          border: '1.5px solid #5a2a1a',
        }}
      />
    </div>
  )
}

/** The Now Spinning rail's 280px cover with the LP disc overlapping its
 *  right edge (`media.jsx:175-189`). Split from `Cover` because the disc is
 *  a rail-only flourish — no shelf card gets one. */
export function NowSpinningCover({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <Cover imageUrl={imageUrl} name={name} size={280} />
      <LpDisc />
    </div>
  )
}
