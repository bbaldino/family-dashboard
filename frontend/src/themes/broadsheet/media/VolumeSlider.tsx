import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * The volume bar shared by `NowSpinning`'s and `CentreSpreadCredits`' VOL
 * rows — previously each screen drew its own `role="slider"` div whose
 * clickable area was the visible 3px rule itself. Measured live: `clientHeight: 3`
 * (3.6 rendered at canvas scale), which is the mock's line weight, not a
 * usable target — on a wall tablet, most taps miss it, and a miss reads as
 * "the control is broken" rather than "I missed" (design brief).
 *
 * The fix is the usual one for a hairline control: an invisible ~40px-tall
 * hit target wraps a still-hairline 3px rule, vertically centred inside it
 * (`alignItems: 'center'`) so the visible line doesn't move. The hit
 * target's own width always equals the rule's — no horizontal padding — so
 * a click/tap position maps to a volume percentage exactly the way it did
 * before; only the vertical target grew.
 *
 * Also adds dragging: a wall tablet is touch-first, and sliding a finger
 * along the bar is the more natural gesture than only being able to tap a
 * position. `onPointerDown` starts a drag (and sets the level immediately,
 * so a plain tap still works exactly as before), `onPointerMove` continues
 * it while the pointer is held down; `setPointerCapture` keeps the drag
 * tracking even once the pointer strays outside the (still fairly small)
 * bar. Levels are deduped during a drag so gliding across the bar doesn't
 * fire an update on every pixel — only when the rounded percentage
 * actually changes — but a fresh `pointerdown` always fires regardless of
 * the last level sent, the same as the old plain click did, so an external
 * volume change (SSE) doesn't get masked by a stale "already sent this"
 * memory of a previous drag.
 */
export function VolumeSlider({ volume, onChange }: { volume: number; onChange: (level: number) => void }) {
  const lastDragLevel = useRef<number | null>(null)

  const levelFromClientX = (target: Element, clientX: number): number => {
    const rect = target.getBoundingClientRect()
    const fraction = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    return Math.round(Math.min(1, Math.max(0, fraction)) * 100)
  }

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    onChange(levelFromClientX(event.currentTarget, event.clientX))
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const level = levelFromClientX(event.currentTarget, event.clientX)
    lastDragLevel.current = level
    onChange(level)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) return
    const level = levelFromClientX(event.currentTarget, event.clientX)
    if (level === lastDragLevel.current) return
    lastDragLevel.current = level
    onChange(level)
  }

  return (
    <div
      role="slider"
      aria-label="Volume"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={volume}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      style={{ flex: 1, display: 'flex', alignItems: 'center', height: 40, cursor: 'pointer', touchAction: 'none' }}
    >
      <div style={{ width: '100%', height: 3, background: 'var(--rule)', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${volume}%`, background: 'var(--ink)' }} />
      </div>
    </div>
  )
}
