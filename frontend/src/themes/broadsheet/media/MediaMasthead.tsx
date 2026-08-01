import { useMusic, usePlayers, normalizePlayer } from '@/data/music'
import type { Player, QueueState } from '@/data/music'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { INK2 } from './colors'
import { RoomPill } from './RoomPill'

/** The screen title's own treatment — 26px italic serif, mock `media.jsx:89`
 *  — deliberately not the masthead's shared 72px numeral style
 *  (`masthead-styles.ts`'s `mastheadNumeralStyle`), and not added to that
 *  shared file either: unlike the kicker/numeral treatments, this one isn't
 *  shared with Home's or the Datebook's masthead. */
const screenTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 26,
  fontWeight: 400,
  color: INK2,
}

/** How many room pills the masthead's right cell ever renders. The mock
 *  shows three (mock `media.jsx:100-102`); a real household could plausibly
 *  have a few more players than that, but the masthead's three cells share
 *  one bottom-aligned baseline (`MastheadFrame`'s `align-items: end` — see
 *  `Masthead.tsx`'s own comment on why that matters), and letting this
 *  cell's pill row wrap to a second line would grow it taller and pull that
 *  shared baseline out of alignment. Capping keeps it to one line; the rest
 *  are simply not shown; a "+N" indicator would be one more thing fighting
 *  for space in an already-tight kicker-height cell. */
const MAX_ROOM_PILLS = 6

function isActiveRoom(player: Player, activeQueue: QueueState | null): boolean {
  if (!activeQueue) return false
  return player.playerId === activeQueue.queueId || player.displayName === activeQueue.displayName
}

/**
 * The Listening Room's masthead — the same three-column `MastheadFrame` as
 * Home's and the Datebook's. Mock: `media.jsx:86-105`.
 *
 * `usePlayers({ isOpen: true, ... })`: this hook was written for grid's
 * player-picker overlay, where `isOpen` gates the poll to while the picker
 * is open. Here the Rooms pills are always on screen, so the room list is
 * always wanted — `isOpen: true` for as long as this component (and so this
 * whole screen) is mounted.
 *
 * Every hook here can boot with no data on a cold cache: no active queue
 * (nothing playing anywhere) and no players list (the poll hasn't resolved,
 * or Music Assistant is unreachable — the common case on this machine, see
 * the design brief). Both get a written fallback rather than a blank cell.
 */
export function MediaMasthead() {
  const { state } = useMusic()
  const { data: rawPlayers } = usePlayers({ isOpen: true, pollingPaused: false })
  const activeQueue = state.activeQueue

  const players = (rawPlayers ?? []).map(normalizePlayer).slice(0, MAX_ROOM_PILLS)
  const roomName = activeQueue?.displayName ?? null

  return (
    <MastheadFrame
      left={
        <>
          <div style={mastheadKickerStyle}>Section IV</div>
          <div style={screenTitleStyle}>The Listening Room</div>
        </>
      }
      center={
        <>
          <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>{roomName ? 'Now playing in' : 'Now playing'}</div>
          <h1 className="m-0" style={mastheadNumeralStyle}>
            {roomName ? `the ${roomName}` : 'Quiet'}
          </h1>
        </>
      }
      right={
        <>
          <div style={{ ...mastheadKickerStyle, textAlign: 'right' }}>Rooms</div>
          {players.length > 0 ? (
            <div
              className="flex justify-end uppercase"
              style={{ gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em' }}
            >
              {players.map((player) => (
                <RoomPill key={player.playerId} label={player.displayName} active={isActiveRoom(player, activeQueue)} />
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>—</div>
          )}
        </>
      }
    />
  )
}
