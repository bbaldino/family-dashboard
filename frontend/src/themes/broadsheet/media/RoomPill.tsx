/**
 * One room name, pill-shaped — filled ink with paper text when it's the
 * active room, outlined and muted otherwise. Shared between `MediaMasthead`
 * (the horizontal "Rooms" row in the masthead's right cell) and the Centre
 * Spread's "Playing in" block (the left margin's vertical room list) — both
 * are the same display-only room list the design brief describes
 * ("Room pills: display-only, matching the Media screen"), so this is the
 * one definition, not two that could drift.
 *
 * Split into its own module rather than living alongside `MediaMasthead`:
 * `MediaMasthead.tsx` needs no other export than the screen itself, and
 * `masthead-styles.ts`'s own header comment gives the same reasoning for
 * why a shared component keeps its own file.
 */
export function RoomPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={
        active
          ? { padding: '4px 10px', background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600 }
          : { padding: '4px 10px', border: '1px solid var(--rule)', color: 'var(--ink-muted)' }
      }
    >
      {label}
    </span>
  )
}
