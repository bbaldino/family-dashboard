import type { ReactNode } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { TrackInfo } from '@/data/music'
import { Cover } from './Cover'
import { INK2 } from './colors'

/** `m:ss`, floored — matches `NowSpinning.tsx`'s own `formatDuration` (not
 *  shared: see that file's own comment on why per-screen copies of this
 *  are the theme's convention). */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

const captionStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 14,
  color: 'var(--ink-muted)',
  lineHeight: 1.45,
  margin: 0,
}

const captionAlbumStyle = {
  fontStyle: 'normal' as const,
  fontWeight: 600,
  color: 'var(--ink)',
}

/**
 * The caption under the plate — mock: "{album}, {year} — {artist} on
 * {label}. Track {n} of {m}." Two clauses from that sentence don't survive
 * contact with the real payload (see the design brief's "What the data
 * supports"): there's no `label` worth showing (present on essentially no
 * real track) and no total track count anywhere in the feed, so both "on
 * {label}" and "of {m}" are gone, not rendered empty. Every remaining piece
 * — album, year, artist, track number — is individually optional, so this
 * builds the sentence up piece by piece rather than assuming any one of
 * them is there.
 */
function Caption({ track }: { track: TrackInfo }) {
  const hasAlbum = Boolean(track.album)
  const parts: ReactNode[] = []
  if (hasAlbum) {
    parts.push(
      <span key="album" style={captionAlbumStyle}>
        {track.album}
      </span>,
    )
    if (track.year) parts.push(`, ${track.year}`)
    parts.push(' — ')
  }
  parts.push(track.artist)
  parts.push(track.trackNumber ? `. Track ${track.trackNumber}.` : '.')

  return <p style={captionStyle}>{parts}</p>
}

/**
 * The centre column — the sleeve as a featured plate (mock
 * `nowplaying.jsx:124-183`): a 400px bordered plate, a caption, a progress
 * bar, and transport.
 *
 * The plate always fills with `Cover` at `size={384}` inside an 8px
 * `border-box` border, so the bordered element is 400px total, matching the
 * mock's own 400×400 footprint — the same gradient fallback (and, when
 * there's a real image, the same `<img>`) every other cover in this theme
 * uses, per the design brief ("use broadsheet's existing gradient fallback,
 * not the mock's diagonal-hatch placeholder").
 *
 * **No scrubber handle.** There's no seek endpoint and none is planned (see
 * the design brief), so this renders a plain filled bar — no draggable
 * handle, matching `NowSpinning`'s own progress bar one screen back. An
 * affordance that doesn't respond to a drag is worse than none.
 */
export function CentreSpreadPlate({
  track,
  isPlaying,
  onPause,
  onResume,
  onNext,
  onPrevious,
}: {
  track: TrackInfo
  isPlaying: boolean
  onPause: () => void
  onResume: () => void
  onNext: () => void
  onPrevious: () => void
}) {
  const elapsed = track.elapsed ?? 0
  const duration = track.duration ?? 0
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : 0
  const remaining = duration > 0 ? Math.max(0, duration - elapsed) : 0

  return (
    <div className="min-h-0 overflow-hidden flex flex-col items-center" style={{ padding: '18px 28px' }}>
      <div
        style={{
          width: 400,
          height: 400,
          flexShrink: 0,
          position: 'relative',
          // Literal, not a theme token — the plate's near-black backing is a
          // decorative print-frame colour, the same reasoning `NowSpinning`'s
          // `LpDisc` gives for its own literal vinyl colours.
          border: '8px solid var(--ink)',
          background: '#100e0c',
          boxShadow: '0 10px 40px rgba(0,0,0,0.22)',
        }}
      >
        <Cover imageUrl={track.imageUrl} name={track.name} size={384} />
        <div
          style={{
            position: 'absolute',
            top: -8,
            left: -8,
            background: 'var(--rust)',
            color: 'var(--paper)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.2em',
            fontWeight: 700,
            padding: '3px 8px',
          }}
        >
          PLATE I
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: 'center', maxWidth: 460 }}>
        <Caption track={track} />
      </div>

      <div style={{ width: '100%', maxWidth: 560, marginTop: 18 }}>
        <div data-testid="centre-spread-progress-track" style={{ height: 3, background: 'var(--rule)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${progressPct}%`, background: 'var(--rust)' }} />
        </div>
        <div
          className="flex justify-between"
          style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)', letterSpacing: '0.08em' }}
        >
          <span style={{ color: 'var(--ink)' }}>{formatDuration(elapsed)}</span>
          <span>−{formatDuration(remaining)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center" style={{ gap: 34, marginTop: 16 }}>
        <button type="button" onClick={onPrevious} style={{ all: 'unset', cursor: 'pointer', color: INK2, display: 'flex' }} aria-label="Previous track">
          <SkipBack size={26} />
        </button>
        <button
          type="button"
          onClick={() => (isPlaying ? onPause() : onResume())}
          style={{
            all: 'unset',
            cursor: 'pointer',
            width: 72,
            height: 72,
            borderRadius: 72,
            background: 'var(--rust)',
            color: 'var(--paper)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // rgba(180,58,26) is --rust (#b43a1a) — a literal so the glow
            // stays translucent, matching `NowSpinning`'s own play button.
            boxShadow: '0 3px 18px rgba(180,58,26,0.32)',
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={28} /> : <Play size={28} />}
        </button>
        <button type="button" onClick={onNext} style={{ all: 'unset', cursor: 'pointer', color: INK2, display: 'flex' }} aria-label="Next track">
          <SkipForward size={26} />
        </button>
      </div>
    </div>
  )
}
