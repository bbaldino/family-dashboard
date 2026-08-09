import { useMusic, useRoomPills } from '@/integrations/music'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { mastheadTitleSize } from '@/themes/broadsheet/ui/masthead-title-size'
import { INK2 } from './colors'
import { RoomPill } from './RoomPill'
import { playbackPhrase } from './playback-phrase'

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

/**
 * The Listening Room's masthead — the same three-column `MastheadFrame` as
 * Home's and the Datebook's. Mock: `media.jsx:86-105`.
 *
 * The Rooms row is `useRoomPills`'s join/leave list (see that hook's own
 * header comment): the anchor pill first, always active and not tappable,
 * then every room it can group with, filled when joined. It's a different
 * concept from the centre cell below — which names the anchor's *group*,
 * i.e. only the rooms actually grouped into this panel's own room — so a
 * room can be offered here as joinable without appearing there.
 *
 * Every hook here can boot with no data on a cold cache: no active queue
 * (nothing playing anywhere) and no configured anchor / no players yet /
 * an anchor not present in the players list (all `useRoomPills` collapses
 * to an empty pill list). Both get a written fallback rather than a blank
 * cell.
 */
export function MediaMasthead() {
  const { state, anchorRoomLabel } = useMusic()
  const { pills, toggle } = useRoomPills()
  const activeQueue = state.activeQueue

  const visiblePills = pills.slice(0, MAX_ROOM_PILLS)
  // This panel's own room — the anchor, plus whatever is grouped into it —
  // not the queue owner's name, which under grouping is a different room
  // (see `music-context.ts`'s `anchorRoomLabel`). The queue owner is the
  // fallback for a household with no anchor configured, where "whatever is
  // playing" is all there is to name.
  const roomName = anchorRoomLabel ?? activeQueue?.displayName ?? null

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
          <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>
            {roomName ? playbackPhrase(activeQueue?.state ?? null) : 'Now playing'}
          </div>
          {/* Sized to fit rather than fixed at 72px, and `truncate`d as the
              backstop. A room label is now a group — "the Kitchen and
              Bedroom" — and at the design size that wrapped to a second
              line, which added 79px to this masthead's height. */}
          <h1
            className="m-0 truncate"
            style={{
              ...mastheadNumeralStyle,
              fontSize: mastheadTitleSize(
                roomName ? `the ${roomName}` : 'Quiet',
                mastheadNumeralStyle.fontSize as number,
              ),
            }}
          >
            {roomName ? `the ${roomName}` : 'Quiet'}
          </h1>
        </>
      }
      right={
        <>
          <div style={{ ...mastheadKickerStyle, textAlign: 'right' }}>Rooms</div>
          {visiblePills.length > 0 ? (
            <div
              className="flex justify-end uppercase"
              style={{
                gap: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.14em',
              }}
            >
              {visiblePills.map((pill) => (
                <RoomPill
                  key={pill.player.playerId}
                  label={pill.player.displayName}
                  active={pill.joined}
                  pending={pill.pending}
                  onToggle={pill.isAnchor ? undefined : () => toggle(pill.player.playerId)}
                />
              ))}
            </div>
          ) : (
            <div
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}
            >
              —
            </div>
          )}
        </>
      }
    />
  )
}
