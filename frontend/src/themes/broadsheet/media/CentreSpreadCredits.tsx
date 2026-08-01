import type { MouseEvent } from 'react'
import { usePlayers, normalizePlayer } from '@/data/music'
import type { Player, QueueState, TrackInfo } from '@/data/music'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { RoomPill } from './RoomPill'
import { sourceLabel } from './labels'

/** No value for this row — a missing `year`/`album`/`source` isn't dropped
 *  the way the mock's Label row is (see this module's own header comment):
 *  these four rows always render, so a missing value gets a dash rather
 *  than making the row disappear and shifting the ones below it. */
const EMPTY = '—'

function isActiveRoom(player: Player, activeQueue: QueueState): boolean {
  return player.playerId === activeQueue.queueId || player.displayName === activeQueue.displayName
}

const dtStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-muted)',
}

const ddStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 15,
  fontWeight: 500,
  margin: 0,
  lineHeight: 1.25,
}

/**
 * The left margin: a four-row credits `<dl>`, then the room list and volume
 * pinned to the column's bottom edge (mock `nowplaying.jsx:80-122`).
 *
 * **Four rows, not five.** The mock's fifth row is Label. `TrackInfo.label`
 * is real but `null` on essentially every track MA reports (it only
 * populates via a separate album lookup this project chose not to make —
 * see the design brief). A credits list that's five rows for one song and
 * four for the next reads as broken, so this ignores the field entirely
 * rather than rendering it only when it happens to be present.
 *
 * Room pills reuse `RoomPill` — the same component `MediaMasthead` renders
 * for the Media screen's own "Rooms" row, per the design brief's "Room
 * pills: display-only, matching the Media screen". Unlike that masthead
 * row, this column has no shared baseline to protect (`MastheadFrame`'s
 * `align-items: end` doesn't reach this far down the page), so the pills
 * wrap onto as many lines as the household's player count needs instead of
 * silently capping at a fixed count.
 */
export function CentreSpreadCredits({
  track,
  activeQueue,
  onSetVolume,
}: {
  track: TrackInfo
  activeQueue: QueueState
  onSetVolume: (queueId: string, level: number) => void
}) {
  const { data: rawPlayers } = usePlayers({ isOpen: true, pollingPaused: false })
  const players = (rawPlayers ?? []).map(normalizePlayer)
  const volume = activeQueue.volumeLevel ?? 0

  const rows: [string, string][] = [
    ['Artist', track.artist],
    ['Album', track.album ?? EMPTY],
    ['Released', track.year ? String(track.year) : EMPTY],
    ['Source', sourceLabel(track.source) ?? EMPTY],
  ]

  const handleVolumeClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const fraction = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0
    const level = Math.round(Math.min(1, Math.max(0, fraction)) * 100)
    onSetVolume(activeQueue.queueId, level)
  }

  return (
    <aside className="min-h-0 overflow-hidden flex flex-col" style={{ padding: '18px 24px 18px 56px' }}>
      <Kicker color="var(--ink-muted)">Credits</Kicker>
      <dl className="m-0" style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
        {rows.map(([label, value], i) => (
          <div
            key={label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              padding: '7px 0',
              borderTop: i === 0 ? '1px solid var(--ink)' : '1px dotted var(--rule)',
            }}
          >
            <dt style={dtStyle}>{label}</dt>
            <dd className="truncate" style={ddStyle}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--rule)' }}>
        <Kicker color="var(--ink-muted)">Playing in</Kicker>
        {players.length > 0 ? (
          <div
            className="flex flex-wrap uppercase"
            style={{ gap: 5, marginTop: 6, marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em' }}
          >
            {players.map((player) => (
              <RoomPill key={player.playerId} label={player.displayName} active={isActiveRoom(player, activeQueue)} />
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 6, marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>{EMPTY}</div>
        )}
        <div className="flex items-center" style={{ gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', letterSpacing: '0.18em' }}>VOL</span>
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink)', letterSpacing: '0.06em' }}>{volume}</span>
        </div>
      </div>
    </aside>
  )
}
