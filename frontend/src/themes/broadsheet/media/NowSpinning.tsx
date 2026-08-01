import type { MouseEvent } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useMusic } from '@/data/music'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { NowSpinningCover } from './NowSpinningCover'
import { INK2 } from './colors'

/** `m:ss`, floored — matches `Footer.tsx`'s `formatDuration` (not shared:
 *  that one lives in the footer module for the same reason
 *  `masthead-styles.ts`'s header comment gives for not sharing across
 *  screens that don't otherwise depend on each other). */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

/**
 * The right rail — the mock's "Now Spinning" feature treatment
 * (`media.jsx:171-224`): a 280px cover with the LP disc overlay, track
 * title, artist/album, a progress bar, transport controls, and volume.
 *
 * Transport (play/pause/next/previous) and volume are wired to the real
 * `useMusic` actions per the design brief — they will fail against the
 * unreachable Music Assistant instance, which is expected; nothing here
 * stubs them out. The volume control is tap-to-set (there's no drag
 * gesture) — the mock draws a static bar with no slider affordance to
 * follow, so this is the simplest touchscreen-appropriate interpretation of
 * "wire it to the real action".
 *
 * Mirrors grid's `NowPlaying` guard (`src/themes/grid/screens/media/NowPlaying.tsx`,
 * read for reference only): no active queue, or an active queue with
 * nothing loaded, both get the same written fallback rather than an empty
 * 280px hole where the cover would be.
 */
export function NowSpinning() {
  const { state, isPlaying, pause, resume, next, previous, setVolume } = useMusic()
  const activeQueue = state.activeQueue
  const currentItem = activeQueue?.currentItem ?? null

  if (!currentItem) {
    return (
      <div className="flex flex-col" style={{ gap: 10 }}>
        <Kicker>Now spinning</Kicker>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 20,
            color: 'var(--ink-muted)',
            marginTop: 32,
          }}
        >
          Nothing on the platter.
        </div>
      </div>
    )
  }

  const elapsed = currentItem.elapsed ?? 0
  const duration = currentItem.duration ?? 0
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : 0
  const volume = activeQueue?.volumeLevel ?? 0

  const handleVolumeClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!activeQueue) return
    const rect = event.currentTarget.getBoundingClientRect()
    const fraction = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0
    const level = Math.round(Math.min(1, Math.max(0, fraction)) * 100)
    setVolume(activeQueue.queueId, level)
  }

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <Kicker>Now spinning</Kicker>
      <NowSpinningCover imageUrl={currentItem.imageUrl} name={currentItem.name} />

      <h2
        className="m-0 truncate"
        style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1, marginTop: 8 }}
      >
        {currentItem.name}
      </h2>
      <div
        className="truncate"
        style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink-muted)', marginTop: 2 }}
      >
        {currentItem.artist}
        {currentItem.album && (
          <>
            <span style={{ color: 'var(--rule)', margin: '0 4px' }}>·</span>
            {currentItem.album}
          </>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ height: 3, background: 'var(--rule)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${progressPct}%`, background: 'var(--rust)' }} />
        </div>
        <div
          className="flex justify-between"
          style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', letterSpacing: '0.08em' }}
        >
          <span>{formatDuration(elapsed)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center" style={{ gap: 24, marginTop: 12 }}>
        <button type="button" onClick={() => previous()} style={{ all: 'unset', cursor: 'pointer', color: INK2 }} aria-label="Previous track">
          <SkipBack size={20} />
        </button>
        <button
          type="button"
          onClick={() => (isPlaying ? pause() : resume())}
          style={{
            all: 'unset',
            cursor: 'pointer',
            width: 56,
            height: 56,
            borderRadius: 56,
            background: 'var(--rust)',
            color: 'var(--paper)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // rgba(180,58,26) is --rust (#b43a1a) — a literal so the glow
            // stays translucent, which color-mix against a token can't do.
            boxShadow: '0 2px 12px rgba(180,58,26,0.3)',
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button type="button" onClick={() => next()} style={{ all: 'unset', cursor: 'pointer', color: INK2 }} aria-label="Next track">
          <SkipForward size={20} />
        </button>
      </div>

      <div className="flex items-center" style={{ gap: 10, marginTop: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', letterSpacing: '0.15em' }}>VOL</span>
        <div
          role="slider"
          aria-label="Volume"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={volume}
          onClick={handleVolumeClick}
          style={{ flex: 1, height: 3, background: 'var(--rule)', position: 'relative', cursor: 'pointer' }}
        >
          <div style={{ position: 'absolute', inset: 0, width: `${volume}%`, background: 'var(--ink)' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink)', letterSpacing: '0.08em' }}>{volume}</span>
      </div>
    </div>
  )
}
