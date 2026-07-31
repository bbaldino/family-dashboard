import { Link, useLocation } from 'react-router-dom'
import { Pause, Play } from 'lucide-react'
import { ROUTE_PATHS } from '@/shell/routes'
import type { ScreenKey } from '@/shell/types'
import { useMusic } from '@/data/music'
import { DoubleRule } from '@/themes/broadsheet/ui/DoubleRule'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'

const NAV_ITEMS: { key: ScreenKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'media', label: 'Media' },
  { key: 'cameras', label: 'Cameras' },
  { key: 'health', label: 'Health' },
]

const inactiveLinkStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.18em',
  color: 'var(--ink-muted)',
  fontWeight: 400,
  borderBottom: '2px solid transparent',
  paddingBottom: 2,
} as const

const activeLinkStyle = {
  ...inactiveLinkStyle,
  color: 'var(--ink)',
  fontWeight: 600,
  borderBottom: '2px solid var(--rust)',
} as const

/** Whether `path` is the current screen — exact match at the root, prefix
 *  match elsewhere so a sub-route (e.g. `/media/album/:uri`) still lights
 *  up its parent's nav entry. Mock: `broadsheet-v2.jsx:634` marks "Home"
 *  active with an ink/bold/rust-underline treatment the other entries
 *  don't get. */
function isActivePath(pathname: string, path: string): boolean {
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
}

/** Thin vertical divider between nav entries — Hairline is horizontal-only. */
function EntryDivider() {
  return <span style={{ width: 1, height: 12, background: 'var(--rule)' }} />
}

/** `m:ss`, floored — for the elapsed/total readout beside the progress bar. */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * The footer's left slot, per the design mock (`broadsheet-v2.jsx:614-631`).
 * `MusicProvider` is mounted by `BroadsheetLayout`, so this is safe to call
 * on every screen, not just Home. When nothing is queued or playing — a
 * cold cache, or the integration simply isn't configured — this prints a
 * written line instead of leaving the slot blank; the footer is fixed
 * chrome on every screen, so an empty gap there would show constantly, not
 * just on a bad poll.
 *
 * The mock's play/pause circle is a button; this one is a static status
 * glyph — the footer has no transport controls to wire it to, and an
 * icon that looks pressable but does nothing is worse than not drawing it
 * (the same reasoning the design brief gives for the read-only chore
 * checkbox). Progress bar and elapsed/total use `TrackInfo.elapsed`/
 * `duration`, which the real feed already reports in seconds — no new data.
 */
function NowPlaying() {
  const { state } = useMusic()
  const currentItem = state.activeQueue?.currentItem ?? null
  const label = currentItem?.name ?? state.activeQueue?.displayName ?? null
  const isPlaying = state.activeQueue?.state === 'playing'
  const hasProgress = currentItem?.duration != null && currentItem.duration > 0 && currentItem?.elapsed != null
  const progressPct = hasProgress ? Math.min(100, Math.max(0, (currentItem!.elapsed! / currentItem!.duration!) * 100)) : 0

  return (
    <div className="flex items-center gap-3 min-w-0">
      {label && (
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 34, height: 34, borderRadius: 34, background: 'var(--ink)', color: 'var(--paper)' }}
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
        </span>
      )}
      <div className="min-w-0">
        <Kicker color="var(--ink-muted)">Now playing</Kicker>
        <div className="truncate" style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>
          {label ? (
            <>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
              {currentItem?.artist && (
                <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-muted)' }}> — {currentItem.artist}</span>
              )}
            </>
          ) : (
            <span style={{ fontStyle: 'italic', color: 'var(--ink-muted)' }}>Quiet in the kitchen.</span>
          )}
        </div>
        {hasProgress && (
          <div className="flex items-center gap-2 mt-0.5">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)' }}>
              {formatDuration(currentItem!.elapsed!)}
            </span>
            <div style={{ width: 160, height: 2, background: 'var(--rule)', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${progressPct}%`, background: 'var(--rust)' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)' }}>
              {formatDuration(currentItem!.duration!)}
            </span>
            {state.activeQueue?.displayName && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', letterSpacing: '0.18em' }}>
                · {state.activeQueue.displayName.toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The theme's footer chrome, pinned to the bottom of the canvas by
 * `BroadsheetLayout`: now-playing on the left, nav on the right, per the
 * design mock. Every screen the shell knows about gets a nav link, not just
 * the ones broadsheet has built — the four not yet shipped land on the
 * shell's `ScreenNotAvailable`, which is the intended Phase 4 state.
 */
export function Footer() {
  const location = useLocation()

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex flex-col"
      style={{ height: 64, background: 'var(--paper)' }}
    >
      {/* The rule spans the full canvas, edge to edge — the page's horizontal
       *  padding starts below it. Insetting the rule to match the content
       *  leaves it visibly shorter than the weather strip's own full-bleed
       *  rules directly above. */}
      <DoubleRule />
      <div
        className="flex-1 min-h-0 px-14 grid items-center"
        style={{ gridTemplateColumns: '1.6fr 1fr', gap: 24 }}
      >
        <NowPlaying />
        <nav className="flex items-center justify-end gap-4">
          {NAV_ITEMS.map((item, i) => {
            const path = '/' + ROUTE_PATHS[item.key]
            const active = isActivePath(location.pathname, path)
            return (
              <div key={item.key} className="flex items-center gap-4">
                {i > 0 && <EntryDivider />}
                <Link to={path} className="uppercase" style={active ? activeLinkStyle : inactiveLinkStyle}>
                  {item.label}
                </Link>
              </div>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
