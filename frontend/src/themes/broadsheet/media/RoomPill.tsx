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
 *
 * `pending` is a separate prop from `onToggle`, not expressed by withholding
 * the handler while a mutation for this room is in flight: a caller that did
 * that got a `<button>` silently swapped for a `<span>` styled identically
 * to the idle state — no visible feedback at all that the tap registered.
 * A real (if brief, per `useGroupMutations.ts`'s confirmation-polling
 * comment) pending window needs a real appearance: this stays a `<button>`,
 * `disabled` so it can't be tapped again mid-flight, dimmed via `opacity`
 * alone — padding, border, and font stay exactly what `pillStyle` already
 * sets for the active/inactive case, so the pill's box never reflows (see
 * this file's own comment above on the height-jitter fix that would undo).
 */
export function RoomPill({
  label,
  active,
  pending = false,
  onToggle,
}: {
  label: string
  active: boolean
  /** A group/ungroup call for this room is in flight. */
  pending?: boolean
  onToggle?: () => void
}) {
  // Both states carry the same 1px border — transparent when filled — so a
  // pill keeps its exact height as it toggles. Without it the filled state is
  // 2px shorter than the outlined one, which reads as a visible wobble now
  // that tapping a pill flips it between the two, and leaves wrapped rows of
  // pills sitting at mismatched heights.
  const pillStyle = active
    ? {
        padding: '4px 10px',
        border: '1px solid transparent',
        background: 'var(--ink)',
        color: 'var(--paper)',
        fontWeight: 600,
      }
    : { padding: '4px 10px', border: '1px solid var(--rule)', color: 'var(--ink-muted)' }

  if (!onToggle) {
    return <span style={pillStyle}>{label}</span>
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={active}
      style={{
        all: 'unset',
        ...pillStyle,
        cursor: pending ? 'default' : 'pointer',
        opacity: pending ? 0.55 : 1,
      }}
    >
      {label}
    </button>
  )
}
