/**
 * One room name, pill-shaped — filled ink with paper text when it's active
 * (the anchor itself, or a room currently grouped with it), outlined and
 * muted otherwise. Shared between `MediaMasthead` (the horizontal "Rooms"
 * row in the masthead's right cell) and the Centre Spread's "Playing in"
 * block (the left margin's vertical room list) — both render the same
 * `useRoomPills` join/leave list, so this is the one definition, not two
 * that could drift (see the room-grouping brief's explicit call-out that a
 * difference between the two screens would be a bug).
 *
 * Split into its own module rather than living alongside `MediaMasthead`:
 * `MediaMasthead.tsx` needs no other export than the screen itself, and
 * `masthead-styles.ts`'s own header comment gives the same reasoning for
 * why a shared component keeps its own file.
 *
 * A pill is a join/leave toggle against the anchor, not a room selector —
 * tapping it groups or ungroups that room with the anchor (see
 * `useRoomPills.ts`). `onToggle` is omitted for the anchor's own pill: it's
 * always active and — per the design brief's explicit decision — never
 * tappable, so it renders as a plain `<span>` with no pointer affordance
 * rather than an inert button.
 */
export function RoomPill({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle?: () => void
}) {
  const pillStyle = active
    ? { padding: '4px 10px', background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600 }
    : { padding: '4px 10px', border: '1px solid var(--rule)', color: 'var(--ink-muted)' }

  if (!onToggle) {
    return <span style={pillStyle}>{label}</span>
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      style={{ all: 'unset', cursor: 'pointer', ...pillStyle }}
    >
      {label}
    </button>
  )
}
