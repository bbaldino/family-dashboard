import { useMusic } from '@/integrations/music'

/**
 * Acknowledges a play the instant it's tapped, for the beat before the first
 * sound. Tapping a track asks Music Assistant to seed a radio station, fall
 * back to a plain play when it can't, then log the pick — a round-trip that
 * can run to a noticeable pause, during which nothing else moves and the tap
 * reads as ignored. This is the same missing-feedback gap `ActionErrorNotice`
 * closes, for the slow path rather than the failed one.
 *
 * Shares the error notice's slot and voice — one line above the footer, in
 * the paper's own type — but is not dismissable: it clears itself when `play`
 * settles (`MusicProvider` owns that), so there's nothing for a tap to do.
 * `playPending` and `actionError` are mutually exclusive by construction —
 * `play` clears the error as it sets the cue — so the two never fight for
 * this one slot.
 */
export function PlayPendingNotice() {
  const { playPending } = useMusic()
  if (!playPending) return null

  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        // On top of the footer, not over it — same reasoning as the error
        // notice: the footer's nav and now-playing line stay readable.
        bottom: 64,
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        padding: '10px 56px',
        background: 'var(--ink)',
        color: 'var(--paper)',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.2em',
          fontWeight: 700,
          // Green for "go", set against the error notice's rust alarm — this
          // is a benign in-progress state, not a failure. Lifted toward the
          // paper so it carries on the dark bar from across the kitchen; raw
          // --forest is too dark on --ink to read at a distance.
          color: 'color-mix(in srgb, var(--forest), var(--paper) 42%)',
        }}
      >
        CUEING
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15 }}>
        {playPending.label}…
      </span>
    </div>
  )
}
