import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDoorbellTheme, buildDoorbellCss, BROADSHEET_RING_LAYOUT } from '@/data/doorbell'
import { resolveBroadsheetDoorbellVars } from '@/themes/broadsheet/ui/broadsheet-vars'
import { ROUTE_PATHS } from '@/shell/routes'

interface DoorbellRingModalProps {
  isOpen: boolean
  cameraUrl: string | null
  onClose: () => void
}

const kickerStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.28em',
  textTransform: 'uppercase' as const,
  color: 'var(--rust)',
}

/** Mock `doorbell-alert.jsx:59` — 60px italic serif, tight and negative-tracked.
 *  The possessive is the mock's: "Someone's at the door." reads as the house
 *  telling you something, which is what a stop-press slip is. */
const headlineStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontWeight: 400,
  fontSize: 60,
  letterSpacing: '-0.03em',
  lineHeight: 0.9,
  margin: 0,
  color: 'var(--ink)',
}

const dismissStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink)',
  background: 'transparent',
  border: '1px solid var(--ink)',
  borderRadius: 0,
  padding: '7px 14px',
  marginBottom: 6,
  cursor: 'pointer',
}

const footNoteStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.16em',
  color: 'var(--ink-muted)',
}

/** "RANG 4s AGO" — the mock's foot note, and one of the few things on this slip
 *  we can state truthfully, since we know when the ring fired. Switches to
 *  minutes past 60s: "RANG 214s AGO" is not how anyone reads a clock. */
function useRangAgo(since: number | null): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (since === null) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [since])

  if (since === null) return ''
  const seconds = Math.max(0, Math.round((now - since) / 1000))
  if (seconds < 60) return `↳ RANG ${seconds}s AGO`
  return `↳ RANG ${Math.round(seconds / 60)}m AGO`
}

/**
 * Broadsheet's doorbell ring overlay — "Stop Press", per the mock
 * `docs/superpowers/designs/broadsheet/doorbell-alert.jsx`.
 *
 * A late-edition slip laid over the page: the dashboard keeps rendering
 * underneath behind a dim wash, and the slip sits on top, rotated a fraction of
 * a degree with an inked torn edge along its top. The mock is explicit that
 * this is *not* full-bleed — the house stays visible behind it, which is what
 * makes it read as an interruption to the paper rather than as a new page.
 *
 * Two departures from the mock, both for want of data rather than taste. Its
 * caption ("A delivery, by the look of it — parcel in both arms, van at the
 * kerb") is written commentary on the scene and nothing here can see the scene,
 * so the caption is left out entirely rather than filled with something
 * plausible. And the mock's feed is a drawn landscape where the real camera is
 * portrait, so the feed's ground follows the Watch Room's light tone rather
 * than the mock's near-black, which at this aspect would be mostly bars.
 */
export function DoorbellRingModal({ isOpen, cameraUrl, onClose }: DoorbellRingModalProps) {
  const dismissBtnRef = useRef<HTMLButtonElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const navigate = useNavigate()

  const [rangAt, setRangAt] = useState<number | null>(null)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    setRangAt(isOpen ? Date.now() : null)
    if (!isOpen) setIsLive(false)
  }, [isOpen])

  const rangAgo = useRangAgo(isOpen ? rangAt : null)

  // The mock's LIVE pulse. The doorbell page posts `doorbell:video-playing`
  // when its first frame renders, so this is a real signal rather than an
  // assumption that an iframe with a src in it is showing anything.
  useEffect(() => {
    if (!isOpen || !cameraUrl) return
    let origin: string | null = null
    try {
      origin = new URL(cameraUrl, window.location.href).origin
    } catch {
      origin = null
    }
    const onMessage = (event: MessageEvent) => {
      if (origin && event.origin !== origin) return
      if (event.data?.type === 'doorbell:video-playing') setIsLive(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isOpen, cameraUrl])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const prevFocus = document.activeElement as HTMLElement | null
    dismissBtnRef.current?.focus()
    return () => {
      prevFocus?.focus?.()
    }
  }, [isOpen])

  const css = useMemo(
    () =>
      buildDoorbellCss({
        vars: resolveBroadsheetDoorbellVars(),
        origin: window.location.origin,
      }),
    // The resolver reads the live document rather than anything in scope, so
    // there is nothing here for the linter to see. The dependency is the point:
    // re-read the palette each time this opens, in case the theme changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen],
  )

  // A fresh iframe mounts on every ring, so the handshake — and the
  // hidden-until-themed beat — runs again each time. `useDoorbellTheme` answers
  // every `doorbell:ready` rather than only the first for exactly this reason.
  const { revealed } = useDoorbellTheme({
    iframeRef,
    cameraUrl: cameraUrl ?? '',
    css,
    layoutCss: BROADSHEET_RING_LAYOUT,
  })

  if (!isOpen) return null

  return (
    <div className="broadsheet-root fixed inset-0 z-50">
      {/* A wash, not a blackout: the mock keeps the dashboard legible
       *  underneath so the slip reads as something laid on the page. */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(25,21,18,0.42)' }}
        onClick={onClose}
      />

      <div
        data-testid="doorbell-ring-slip"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doorbell-ring-title"
        style={{
          position: 'absolute',
          top: '8.2%',
          left: '14%',
          width: '72%',
          height: '83.5%',
          background: 'var(--paper)',
          border: '1px solid var(--ink)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.42), 0 2px 0 rgba(255,255,255,0.4) inset',
          // The mock's fraction of a degree. Enough to read as a physical slip
          // set down on the page; not enough to look like a mistake.
          transform: 'rotate(-0.35deg)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div style={{ height: 5, background: 'var(--ink)', flex: '0 0 auto' }} />

        <div
          style={{
            padding: '16px 40px 12px',
            borderBottom: '3px double var(--ink)',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'end',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 6 }}>
            <span className="doorbell-ring-pulse" />
            <span style={kickerStyle}>Stop press</span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ ...kickerStyle, color: 'var(--ink-muted)', marginBottom: 3 }}>
              Front door · just now
            </div>
            <h1 id="doorbell-ring-title" style={headlineStyle}>
              Someone&rsquo;s at the door.
            </h1>
          </div>

          <button ref={dismissBtnRef} onClick={onClose} style={dismissStyle}>
            Dismiss ✕
          </button>
        </div>

        {/* One region, not the mock's two columns: the replies rail lives
         *  *inside* the doorbell page, so the iframe spans the whole body and
         *  `BROADSHEET_RING_LAYOUT` draws the split — including the ink frame
         *  around the feed, which from out here would have to enclose the rail
         *  too. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '18px 40px 14px',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {cameraUrl ? (
              <iframe
                key={cameraUrl}
                ref={iframeRef}
                src={cameraUrl}
                title="Front step camera"
                className="w-full h-full border-0"
                style={{ visibility: revealed ? 'visible' : 'hidden' }}
                allow="autoplay; camera; microphone"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ border: '7px solid var(--ink)', background: 'var(--rule-faint)' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    fontSize: 16,
                    color: 'var(--ink-muted)',
                    textAlign: 'center',
                    maxWidth: 420,
                  }}
                >
                  No picture from the front step. Add a camera URL in Settings → Doorbell Camera.
                </p>
              </div>
            )}

            {isLive && (
              <div
                style={{
                  position: 'absolute',
                  top: 19,
                  left: 21,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  pointerEvents: 'none',
                }}
              >
                <span className="doorbell-ring-pulse" />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    color: '#fff',
                    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                  }}
                >
                  LIVE
                </span>
              </div>
            )}
          </div>

          {/* The slip's foot note — about the ring rather than the camera, so
           *  it belongs to us rather than to the embedded page. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 9,
            }}
          >
            <span style={footNoteStyle}>{rangAgo}</span>
            <button
              onClick={() => {
                onClose()
                navigate(`/${ROUTE_PATHS.cameras}`)
              }}
              style={{
                ...footNoteStyle,
                color: 'var(--ink)',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--rule-faint)',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              OPEN FULL CAMERA →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
