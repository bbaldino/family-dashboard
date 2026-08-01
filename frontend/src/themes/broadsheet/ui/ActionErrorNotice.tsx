import { useEffect } from 'react'
import { useMusic } from '@/data/music'

/** How long a failure stays up before clearing itself. Long enough to read
 *  from across a kitchen, short enough that a stale complaint doesn't sit on
 *  a wall display all evening. */
const DISMISS_AFTER_MS = 8000

/**
 * Surfaces a failed transport action — the thing whose absence made a broken
 * tap indistinguishable from an ignored one. `MusicProvider` used to let these
 * rejections escape as unhandled promise rejections, so a track Music
 * Assistant returned 500 for on every attempt simply looked dead, and finding
 * out why meant reading server logs.
 *
 * Deliberately not a general toast system: this theme has no notification
 * furniture and doesn't need any: one line, in the paper's own voice, that
 * clears itself. Tapping it dismisses early.
 *
 * `key`ed on the error's timestamp by its host so a second identical failure
 * re-mounts and restarts the timer, rather than silently reusing a notice
 * that is already half-expired.
 */
export function ActionErrorNotice() {
  const { actionError, dismissError } = useMusic()

  useEffect(() => {
    if (!actionError) return
    const id = setTimeout(dismissError, DISMISS_AFTER_MS)
    return () => clearTimeout(id)
  }, [actionError, dismissError])

  if (!actionError) return null

  return (
    <button
      type="button"
      onClick={dismissError}
      aria-live="polite"
      style={{
        all: 'unset',
        cursor: 'pointer',
        position: 'absolute',
        left: 0,
        right: 0,
        // Sits directly on top of the 64px `Footer` rather than over it — the
        // footer carries the nav and the now-playing line, and covering either
        // to report a failure trades one problem for another.
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
          color: 'var(--rust)',
        }}
      >
        STOP PRESS
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15 }}>
        {actionError.message}.
      </span>
    </button>
  )
}
