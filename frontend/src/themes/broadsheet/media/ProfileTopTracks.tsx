import type { ArtistTrack } from '@/integrations/music'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { ArtistTrackRow } from './ArtistTrackRow'
import type { TrackActionsMenuGroup } from './TrackActionsMenu'
import { MAX_TOP_TRACKS } from './profile-capacity'

/**
 * The Profile's left column — "Most played", two newspaper columns (mock
 * `music-pages.jsx:236-252`). The mock's own header line reads
 * `{n} tracks in library` off a separate library-wide total this project
 * doesn't have; `top_tracks.length` is what's actually known, so the header
 * describes what's actually shown instead of a number invented to match the
 * mock's wording.
 */
export function ProfileTopTracks({
  tracks,
  currentTrackUri,
  openMenuUri,
  onToggleMenu,
  buildGroups,
}: {
  tracks: ArtistTrack[]
  currentTrackUri: string | null
  openMenuUri: string | null
  onToggleMenu: (uri: string) => void
  buildGroups: (track: ArtistTrack) => TrackActionsMenuGroup[]
}) {
  const visible = tracks.slice(0, MAX_TOP_TRACKS)
  const hiddenCount = tracks.length - visible.length
  const half = Math.ceil(visible.length / 2)
  const columns = [visible.slice(0, half), visible.slice(half)]

  return (
    <section
      className="min-h-0"
      style={{ padding: '18px 28px 18px 56px', borderRight: '1px solid var(--rule)' }}
    >
      <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
        <Kicker>Most played</Kicker>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-muted)',
            letterSpacing: '0.12em',
          }}
        >
          {tracks.length === 1 ? '1 top track' : `${tracks.length} top tracks`}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>
        {columns.map((column, ci) => (
          <div key={ci} style={{ borderTop: '2px solid var(--ink)' }}>
            {column.map((track, i) => (
              <ArtistTrackRow
                key={track.uri}
                track={track}
                isFirstInColumn={i === 0}
                isPlaying={currentTrackUri != null && track.uri === currentTrackUri}
                isMenuOpen={openMenuUri === track.uri}
                onToggleMenu={() => onToggleMenu(track.uri)}
                groups={buildGroups(track)}
              />
            ))}
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <div
          style={{
            marginTop: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--ink-muted)',
            letterSpacing: '0.1em',
          }}
        >
          +{hiddenCount} more tracks
        </div>
      )}
    </section>
  )
}
