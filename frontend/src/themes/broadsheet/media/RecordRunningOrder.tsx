import type { ArtistTrack } from '@/data/music'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { AlbumTrackRow } from './AlbumTrackRow'
import type { TrackActionsMenuGroup } from './TrackActionsMenu'
import { sumDurationSeconds, formatRuntimeMinutes } from './album-runtime'
import { MAX_RECORD_TRACKS } from './record-capacity'

/**
 * The Record's right column — the running order, two newspaper columns
 * (mock `music-pages.jsx:154-166`). The header line's `{n} tracks ·
 * {runtime}` always describes the *whole* album — `tracks` arrives
 * uncapped, and the total is summed here before `MAX_RECORD_TRACKS` trims
 * what actually renders, the same separation `CentreSpreadRunningOrder`
 * draws between "how many there are" and "how many fit".
 */
export function RecordRunningOrder({
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
  const totalRuntime = sumDurationSeconds(tracks)
  const visible = tracks.slice(0, MAX_RECORD_TRACKS)
  const hiddenCount = tracks.length - visible.length
  const half = Math.ceil(visible.length / 2)
  const columns = [visible.slice(0, half), visible.slice(half)]

  return (
    <section style={{ padding: '20px 56px 20px 28px', position: 'relative' }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
        <Kicker>The running order</Kicker>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-muted)',
            letterSpacing: '0.12em',
          }}
        >
          {tracks.length === 1 ? '1 track' : `${tracks.length} tracks`} ·{' '}
          {formatRuntimeMinutes(totalRuntime)}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {columns.map((column, ci) => (
          <div key={ci} style={{ borderTop: '2px solid var(--ink)' }}>
            {column.map((track, i) => {
              const index = ci === 0 ? i : half + i
              return (
                <AlbumTrackRow
                  key={track.uri}
                  track={track}
                  index={index}
                  isPlaying={currentTrackUri != null && track.uri === currentTrackUri}
                  isMenuOpen={openMenuUri === track.uri}
                  onToggleMenu={() => onToggleMenu(track.uri)}
                  groups={buildGroups(track)}
                />
              )
            })}
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
