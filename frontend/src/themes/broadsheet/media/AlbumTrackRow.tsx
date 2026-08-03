import type { ArtistTrack } from '@/data/music'
import { featuredArtistsLabel } from './featured-artists'
import { TrackActionsTrigger } from './TrackActionsTrigger'
import type { TrackActionsMenuGroup } from './TrackActionsMenu'
import { CARD_BG } from './colors'

/** `m:ss`, floored — matches every other screen's own copy of this
 *  (`NowSpinning.tsx`, `Footer.tsx`, `CentreSpreadRunningOrder.tsx`); see
 *  those files' own comments on why this theme doesn't share it. */
function formatDuration(seconds: number | null): string {
  if (seconds == null) return ''
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

/**
 * One row of the running order — mock `music-pages.jsx:96-115`. The number
 * column becomes a rust `▸` for the track currently playing; the menu
 * trigger's own row gets the deeper-paper background and the `inset 3px 0 0`
 * rust bar the mock uses to mark "this is the row the open menu belongs to"
 * (`music-pages.jsx:100-103`).
 *
 * `position: relative; zIndex: 30` only while the menu is open — matching
 * the mock exactly (`music-pages.jsx:101`) — is what lets `TrackActionsMenu`
 * (nested inside this row's own trigger cell, `zIndex: 40`) render above
 * `MenuScrim` (`Album.tsx`'s own root, `zIndex: 15`) without a portal: the
 * row's stacking context wins against the scrim's, and the menu wins within
 * the row's.
 */
export function AlbumTrackRow({
  track,
  index,
  isPlaying,
  isMenuOpen,
  onToggleMenu,
  groups,
}: {
  track: ArtistTrack
  index: number
  isPlaying: boolean
  isMenuOpen: boolean
  onToggleMenu: () => void
  groups: TrackActionsMenuGroup[]
}) {
  const feat = featuredArtistsLabel(track.artists)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '26px 1fr auto 22px',
        gap: 12,
        alignItems: 'baseline',
        padding: '9px 0',
        borderTop: '1px dotted var(--rule)',
        background: isMenuOpen ? CARD_BG : isPlaying ? 'rgba(180,58,26,0.05)' : 'transparent',
        position: isMenuOpen ? 'relative' : 'static',
        zIndex: isMenuOpen ? 30 : 'auto',
        boxShadow: isMenuOpen ? 'inset 3px 0 0 var(--rust)' : 'none',
        paddingLeft: isMenuOpen ? 8 : 0,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: isPlaying ? 'var(--rust)' : 'var(--ink-muted)',
          fontWeight: isPlaying ? 700 : 400,
        }}
      >
        {isPlaying ? '▸' : String(index + 1).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <div
          className="truncate"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.2,
            color: isPlaying ? 'var(--rust)' : 'var(--ink)',
          }}
        >
          {track.name}
        </div>
        {feat && (
          <div
            className="truncate"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--ink-muted)',
              marginTop: 1,
            }}
          >
            feat. {feat}
          </div>
        )}
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-muted)',
          letterSpacing: '0.04em',
        }}
      >
        {formatDuration(track.duration)}
      </span>
      <TrackActionsTrigger
        isOpen={isMenuOpen}
        onToggle={onToggleMenu}
        kicker={`Track ${String(index + 1).padStart(2, '0')}`}
        title={track.name}
        groups={groups}
      />
    </div>
  )
}
