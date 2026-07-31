import { Link } from 'react-router-dom'
import { ROUTE_PATHS } from '@/shell/routes'
import type { ScreenKey } from '@/shell/types'
import { Hairline } from '@/themes/broadsheet/ui/Hairline'

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
 * The theme's footer navigation, pinned to the bottom of the canvas by
 * `BroadsheetLayout`. Every screen the shell knows about gets a link, not
 * just the ones broadsheet has built — the four not yet shipped land on
 * the shell's `ScreenNotAvailable`, which is the intended Phase 4 state.
 */
export function Footer() {
  return (
    <div className="absolute bottom-0 left-0 right-0 px-14" style={{ height: 56, background: 'var(--paper)' }}>
      <Hairline />
      <nav className="h-full flex items-center justify-end gap-4">
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
  )
}
