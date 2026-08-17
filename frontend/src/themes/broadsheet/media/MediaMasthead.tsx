import { useRoomPills } from '@/integrations/music'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { useNow } from '@/themes/broadsheet/home/useNow'
import { roomStateWord } from './room-state-word'

/** How many rooms the ear ever lists. The masthead's three cells share one
 *  bottom-aligned baseline (`MastheadFrame`'s `align-items: end`), so this
 *  cell growing taller than its siblings pulls that baseline out of true —
 *  the same reason the old pill row was capped. Four rows is the mock's
 *  three plus one, and roughly where the cell stops matching the 72px
 *  numeral opposite it. */
const MAX_ROOMS = 4

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

/**
 * Media's masthead — the shared three-column `MastheadFrame`, following the
 * suite's masthead rule: the centre names the page, and no ear is a second
 * name.
 *
 * **The centre names the page.** It used to carry the anchored room — "Now
 * playing in / the Kitchen and Deck" — which the left ear now covers more
 * completely, since it lists every room rather than only the anchor's group.
 * The room label logic itself is untouched and still drives the Centre
 * Spread, where naming the room is the whole point of the screen.
 *
 * **The left ear is the room picker**, and a control rather than a readout:
 * directing audio to a room is this screen's primary job. It was
 * "Section IV / The Listening Room", a name for a page the nav tab already
 * labels. The rows are `useRoomPills`'s join/leave list — the anchor first,
 * always joined and never tappable, then every room it can group with.
 *
 * **The right ear is empty.** The design puts library counts there (tracks,
 * albums, playlists) and no route reports them: music exposes `/search`,
 * `/recent`, `/top-tracks`, `/artist` and `/album`, none of which is a total.
 * Left blank rather than filled with a number we would have to invent.
 *
 * Boots with no data on a cold cache: no configured anchor, no players yet,
 * or an anchor missing from the players list all collapse `useRoomPills` to
 * an empty list, which gets a written fallback rather than a blank cell.
 */
export function MediaMasthead() {
  const { pills, toggle } = useRoomPills()
  const now = useNow()

  const visible = pills.slice(0, MAX_ROOMS)

  return (
    <MastheadFrame
      left={
        <>
          <div style={mastheadKickerStyle}>Rooms</div>
          {visible.length > 0 ? (
            <div className="flex flex-col" style={{ gap: 2 }}>
              {visible.map((pill) => {
                const selectable = !pill.isAnchor
                return (
                  <div
                    key={pill.player.playerId}
                    role={selectable ? 'button' : undefined}
                    tabIndex={selectable ? 0 : undefined}
                    aria-pressed={selectable ? pill.joined : undefined}
                    onClick={selectable ? () => toggle(pill.player.playerId) : undefined}
                    className="flex items-baseline"
                    style={{
                      gap: 8,
                      padding: '3px 8px 3px 6px',
                      cursor: selectable ? 'pointer' : 'default',
                      userSelect: 'none',
                      opacity: pill.pending ? 0.55 : 1,
                      background: pill.joined ? 'var(--ink)' : 'transparent',
                      borderLeft: `2px solid ${pill.joined ? 'var(--rust)' : 'var(--rule-faint)'}`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 14,
                        fontWeight: 600,
                        minWidth: 62,
                        color: pill.joined ? 'var(--paper)' : 'var(--ink)',
                      }}
                    >
                      {pill.player.displayName}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        letterSpacing: '0.06em',
                        color: pill.joined
                          ? 'color-mix(in srgb, var(--paper) 75%, var(--ink))'
                          : 'var(--ink-muted)',
                      }}
                    >
                      {roomStateWord(pill.player)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}
            >
              No rooms
            </div>
          )}
        </>
      }
      center={
        <>
          <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>
            {DATE_FORMAT.format(now)}
          </div>
          <h1 className="m-0" style={mastheadNumeralStyle}>
            Media
          </h1>
        </>
      }
      right={null}
    />
  )
}
