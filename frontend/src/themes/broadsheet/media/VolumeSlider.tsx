import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { MeterBar } from './MeterBar'

/** How long a finger rests on the bar before the zoom opens. */
export const HOLD_MS = 350

/** How far a finger can wander before the press counts as a swipe — enough
 *  to absorb the wobble of a finger resting on glass. */
const SWIPE_PX = 8

/** What the − and + buttons move the volume by. */
const STEP = 2

/** The zoom track's width on the canvas: 8px a point, against the inline
 *  bar's under 2. Also the fallback where layout reports no width. */
const ZOOM_TRACK_PX = 800

const clamp = (level: number) => Math.min(100, Math.max(0, level))

type Press =
  | { mode: 'pending'; startX: number; lastX: number }
  | { mode: 'swipe' }
  | { mode: 'zoom'; anchorX: number; anchorLevel: number }

/**
 * The volume control shared by `NowSpinning`'s and `CentreSpreadCredits`' VOL
 * rows: − and + buttons either side of a bar.
 *
 * The bar is a 3px rule inside a 40px hit target, 90-163px long once the
 * buttons take their share — under 2px a point of volume, so a fingertip
 * covers twenty of them. Hence three gestures (2026-11-03):
 *  - a tap sets the level where it lands, and a swipe follows the finger —
 *    quick and coarse, as the bar always was;
 *  - a press held still for `HOLD_MS` opens a zoom over the page instead, and
 *    the same finger then moves the level by its travel along the zoom's
 *    800px track, from where the level was rather than jumping to the finger.
 *    Lifting closes it;
 *  - the buttons step by 2, for the small change a finger can't make.
 *
 * Nothing is sent on pointerdown, since the press might yet become a hold.
 * Levels are deduped within a press so a drag doesn't fire on every pixel.
 * `setPointerCapture` keeps the bar receiving the moves after the finger
 * leaves it, which the zoom relies on: the finger stays on the small bar's
 * capture while the eye follows the big track.
 */
export function VolumeSlider({
  volume,
  onChange,
}: {
  volume: number
  onChange: (level: number) => void
}) {
  const press = useRef<Press | null>(null)
  const holdTimer = useRef<number | null>(null)
  const lastSent = useRef<number | null>(null)
  const zoomTrackRef = useRef<HTMLDivElement>(null)
  const [zoomLevel, setZoomLevel] = useState<number | null>(null)

  const clearHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  useEffect(() => clearHold, [])

  const send = (level: number) => {
    if (level === lastSent.current) return
    lastSent.current = level
    onChange(level)
  }

  const levelAt = (target: Element, clientX: number): number => {
    const rect = target.getBoundingClientRect()
    const fraction = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    return Math.round(clamp(fraction * 100))
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    clearHold()
    lastSent.current = null
    press.current = { mode: 'pending', startX: event.clientX, lastX: event.clientX }
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      const current = press.current
      if (current?.mode !== 'pending') return
      press.current = { mode: 'zoom', anchorX: current.lastX, anchorLevel: clamp(volume) }
      lastSent.current = Math.round(clamp(volume))
      setZoomLevel(clamp(volume))
    }, HOLD_MS)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = press.current
    if (!current || event.buttons !== 1) return
    if (current.mode === 'pending') {
      current.lastX = event.clientX
      if (Math.abs(event.clientX - current.startX) <= SWIPE_PX) return
      clearHold()
      press.current = { mode: 'swipe' }
    }
    if (press.current?.mode === 'swipe') {
      send(levelAt(event.currentTarget, event.clientX))
    } else if (current.mode === 'zoom') {
      const trackWidth = zoomTrackRef.current?.getBoundingClientRect().width || ZOOM_TRACK_PX
      const level = clamp(
        current.anchorLevel + ((event.clientX - current.anchorX) / trackWidth) * 100,
      )
      setZoomLevel(level)
      send(Math.round(level))
    }
  }

  const endPress = (event: ReactPointerEvent<HTMLDivElement>, tapped: boolean) => {
    clearHold()
    if (tapped && press.current?.mode === 'pending') {
      send(levelAt(event.currentTarget, event.clientX))
    }
    press.current = null
    setZoomLevel(null)
  }

  return (
    <div className="flex items-center" style={{ flex: 1, gap: 6 }}>
      <StepButton label="Volume down" onClick={() => onChange(clamp(volume - STEP))}>
        −
      </StepButton>
      <div
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={volume}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => endPress(event, true)}
        onPointerCancel={(event) => endPress(event, false)}
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          height: 40,
          cursor: 'pointer',
          touchAction: 'none',
        }}
      >
        <MeterBar percent={volume} fill="var(--ink)" />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: `${clamp(volume)}%`,
            width: 12,
            height: 12,
            marginLeft: -6,
            borderRadius: '50%',
            background: 'var(--rust)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <StepButton label="Volume up" onClick={() => onChange(clamp(volume + STEP))}>
        +
      </StepButton>
      {zoomLevel !== null && <VolumeZoom level={zoomLevel} trackRef={zoomTrackRef} />}
    </div>
  )
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        flex: 'none',
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '1.5px solid var(--ink)',
        background: 'transparent',
        color: 'var(--ink)',
        fontFamily: 'var(--font-mono)',
        fontSize: 16,
        lineHeight: 1,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

/**
 * The zoom a held press opens: the same level on a track 3-5x longer, with
 * the number large. Display only — the finger stays captured by the small bar
 * underneath, and lifting it closes this — so it ignores pointers entirely.
 */
function VolumeZoom({
  level,
  trackRef,
}: {
  level: number
  trackRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 50, background: 'rgba(25,21,18,0.38)', pointerEvents: 'none' }}
      />
      <div
        role="dialog"
        aria-label="Fine volume"
        style={{
          position: 'fixed',
          zIndex: 51,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: ZOOM_TRACK_PX + 120,
          background: 'var(--paper)',
          borderTop: '4px solid var(--ink)',
          boxShadow: '0 18px 50px rgba(25,21,18,0.35)',
          padding: '26px 60px 30px',
          pointerEvents: 'none',
        }}
      >
        <div className="flex justify-between items-baseline">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: 'var(--rust)',
            }}
          >
            VOLUME
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              color: 'var(--ink-muted)',
            }}
          >
            SLIDE TO ADJUST · LIFT TO SET
          </span>
        </div>
        <div
          ref={trackRef}
          data-testid="volume-zoom-track"
          style={{ position: 'relative', height: 64, display: 'flex', alignItems: 'center' }}
        >
          <div style={{ width: '100%', height: 8, background: 'var(--rule-faint)' }}>
            <div style={{ width: `${level}%`, height: '100%', background: 'var(--ink)' }} />
          </div>
          <span
            style={{
              position: 'absolute',
              left: `${level}%`,
              width: 40,
              height: 40,
              marginLeft: -20,
              borderRadius: '50%',
              background: 'var(--rust)',
              border: '3px solid var(--paper)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          />
        </div>
        <div
          className="flex justify-between"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}
        >
          {[0, 25, 50, 75, 100].map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div
          style={{
            textAlign: 'center',
            marginTop: 6,
            fontFamily: 'var(--font-display)',
            fontSize: 60,
            fontWeight: 600,
            lineHeight: 1,
            color: 'var(--ink)',
          }}
        >
          {Math.round(level)}
        </div>
      </div>
    </>
  )
}
