import { useRoomPills } from '@/integrations/music'
import { mastheadKickerStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { roomStateWord } from './room-state-word'

/** How many rooms the ear ever lists. The masthead's three cells share one
 *  bottom-aligned baseline (`MastheadFrame`'s `align-items: end`), so this
 *  cell growing taller than its siblings pulls that baseline out of true —
 *  the same reason the pill row this replaced was capped. Four rows is the
 *  mock's three plus one, and roughly where the cell stops matching the
 *  numeral opposite it. */
const MAX_ROOMS = 4

/**
 * The masthead's room ear: every room, what it is doing, and a tap to group
 * it with the anchor.
 *
 * Shared by Media and the Centre Spread because the design gives both screens
 * the same ear, deliberately — the two agree that rooms are selectable, and
 * one copy is one place to keep that true. It is a control, not a readout:
 * directing audio to a room is the primary job of both screens.
 *
 * Rows come from `useRoomPills` — the anchor first, always joined and never
 * tappable (there is nothing to join this panel's own room to), then every
 * room it can group with.
 *
 * Each room shows a state word rather than the track the design shows in the
 * active row: `/players` carries a player's state but not its queue, so a
 * title per room would mean a `/queue/{id}` call for every speaker in the
 * house on every render. See `roomStateWord`.
 */
export function RoomEar() {
  const { pills, toggle } = useRoomPills()
  const visible = pills.slice(0, MAX_ROOMS)

  return (
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>
          No rooms
        </div>
      )}
    </>
  )
}
