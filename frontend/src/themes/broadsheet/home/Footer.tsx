import { Link } from 'react-router-dom'
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

const linkStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.18em',
  color: 'var(--ink-muted)',
} as const

/** Thin vertical divider between nav entries — Hairline is horizontal-only. */
function EntryDivider() {
  return <span style={{ width: 1, height: 12, background: 'var(--rule)' }} />
}

/**
 * The footer's left slot, per the design mock (`broadsheet-v2.jsx:614`).
 * `MusicProvider` is mounted by `BroadsheetLayout`, so this is safe to call
 * on every screen, not just Home. When nothing is queued or playing — a
 * cold cache, or the integration simply isn't configured — this prints a
 * written line instead of leaving the slot blank; the footer is fixed
 * chrome on every screen, so an empty gap there would show constantly, not
 * just on a bad poll.
 */
function NowPlaying() {
  const { state } = useMusic()
  const currentItem = state.activeQueue?.currentItem ?? null
  const label = currentItem?.name ?? state.activeQueue?.displayName ?? null

  return (
    <div className="min-w-0">
      <Kicker>Now playing</Kicker>
      <div
        className="truncate"
        style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink)' }}
      >
        {label ? (
          <>
            {label}
            {currentItem?.artist && <span style={{ color: 'var(--ink-muted)' }}> — {currentItem.artist}</span>}
          </>
        ) : (
          <span style={{ color: 'var(--ink-muted)' }}>Quiet in the kitchen.</span>
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
  return (
    <div
      className="absolute bottom-0 left-0 right-0 px-14 flex flex-col"
      style={{ height: 64, background: 'var(--paper)' }}
    >
      <DoubleRule />
      <div className="flex-1 min-h-0 grid items-center" style={{ gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
        <NowPlaying />
        <nav className="flex items-center justify-end gap-4">
          {NAV_ITEMS.map((item, i) => (
            <div key={item.key} className="flex items-center gap-4">
              {i > 0 && <EntryDivider />}
              <Link to={'/' + ROUTE_PATHS[item.key]} className="uppercase" style={linkStyle}>
                {item.label}
              </Link>
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}
