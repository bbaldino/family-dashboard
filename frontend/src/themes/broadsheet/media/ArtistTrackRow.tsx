import type { ArtistTrack } from '@/data/music'
import { Cover } from './Cover'
import { TrackActionsTrigger } from './TrackActionsTrigger'
import type { TrackActionsMenuGroup } from './TrackActionsMenu'
import { CARD_BG } from './colors'

/** `m:ss`, floored — matches `AlbumTrackRow.tsx`'s own copy; see that file's
 *  comment on why this theme doesn't share one across screens. */
function formatDuration(seconds: number | null): string {
  if (seconds == null) return ''
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

/**
 * One row of the Profile's "Most played" list — mock `music-pages.jsx:240-248`:
 * a 44px cover, title over album (in place of the running order's `feat.`
 * line — a top-tracks list has no album context of its own to omit), and
 * the same menu trigger/highlight treatment `AlbumTrackRow.tsx` uses (see
 * that file's own comment on the `zIndex: 30`/scrim staging).
 */
export function ArtistTrackRow({
  track,
  isFirstInColumn,
  isPlaying,
  isMenuOpen,
  onToggleMenu,
  groups,
}: {
  track: ArtistTrack
  isFirstInColumn: boolean
  isPlaying: boolean
  isMenuOpen: boolean
  onToggleMenu: () => void
  groups: TrackActionsMenuGroup[]
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '44px 1fr auto 20px',
        gap: 12,
        alignItems: 'center',
        padding: '10px 0',
        borderTop: isFirstInColumn ? 'none' : '1px dotted var(--rule)',
        background: isMenuOpen ? CARD_BG : isPlaying ? 'rgba(180,58,26,0.05)' : 'transparent',
        position: isMenuOpen ? 'relative' : 'static',
        zIndex: isMenuOpen ? 30 : 'auto',
        boxShadow: isMenuOpen ? 'inset 3px 0 0 var(--rust)' : 'none',
        paddingLeft: isMenuOpen ? 8 : 0,
      }}
    >
      <Cover imageUrl={track.image_url} name={track.name} size={44} />
      <div className="min-w-0">
        <div className="truncate" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, lineHeight: 1.2, color: isPlaying ? 'var(--rust)' : 'var(--ink)' }}>
          {track.name}
        </div>
        {track.album && (
          <div className="truncate" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 1 }}>
            {track.album}
          </div>
        )}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>{formatDuration(track.duration)}</span>
      <TrackActionsTrigger isOpen={isMenuOpen} onToggle={onToggleMenu} kicker="Track" title={track.name} groups={groups} />
    </div>
  )
}
