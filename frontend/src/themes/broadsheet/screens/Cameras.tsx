import { useMemo, useRef } from 'react'
import { useIntegrationConfig } from '@/platform'
import {
  doorbellIntegration,
  useDoorbellTheme,
  buildDoorbellCss,
  BROADSHEET_LAYOUT,
} from '@/integrations/doorbell'
import { resolveBroadsheetDoorbellVars } from '@/themes/broadsheet/ui/broadsheet-vars'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { useNow } from '@/themes/broadsheet/home/useNow'

/** The right cell's clock — mono, mock `doorbell.jsx:69` (13px, 700 weight,
 *  0.18em tracking) for the time itself. That treatment drew the "Recording"
 *  status pill in the mock; the design brief cuts recording status entirely
 *  (nothing in this codebase reports whether the camera is actually
 *  recording), so this reuses the same type size and weight for the one
 *  thing this cell can honestly show instead — the time. */
const clockTimeStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  letterSpacing: '0.18em',
  fontWeight: 700,
  color: 'var(--ink)',
} as const

const CLOCK_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})
const CLOCK_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

/** The written line shown in place of the feed when there's nothing to
 *  point an iframe at — grid's equivalent (`CamerasBoard.tsx`) is a plain
 *  centred sentence, not an empty framed box, and the design brief is
 *  explicit that this screen should do the same rather than framing a dark
 *  rectangle with nothing behind it. */
const emptyStateStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 18,
  color: 'var(--ink-muted)',
  textAlign: 'center' as const,
  maxWidth: 560,
  margin: 0,
  lineHeight: 1.5,
}

/**
 * The Watch Room: broadsheet's cameras screen — a masthead over one framed
 * camera feed. Mock: `docs/superpowers/designs/broadsheet/doorbell.jsx`.
 *
 * The mock shows considerably more than the data supports — camera tabs
 * (config models exactly one `camera_url`), quick spoken replies and
 * two-way audio (no TTS or audio-out path exists), stream stats, and a
 * "Recording" status pill (not modelled anywhere). All of that is left out
 * entirely rather than built disabled or stubbed — see the design brief's
 * "Scope, decided" section. What's left is exactly what grid's
 * `CamerasBoard` already does: one configured URL in an iframe, just with
 * this theme's framing and masthead instead of grid's bare `<div>`.
 *
 * The centre names the page, per the suite's masthead rule. It previously
 * read "Keeping Watch" / "The Front Step" — chosen over the mock's "At the
 * Door" because this screen can't promise anyone is actually there — but with
 * one camera configured that name was as fixed as a page title. The left ear
 * that would carry live data here ("last motion", per camera) has no source:
 * see the comment on `left` below.
 *
 * Unlike `useWebRtcStream` (`src/integrations/doorbell/useWebRtcStream.ts`), this
 * doesn't hand-roll a WebRTC peer connection — the configured URL is
 * already a complete WebRTC *page* (go2rtc's own player), so an iframe is
 * the whole client, exactly matching grid's approach.
 */
export function Cameras() {
  const now = useNow()
  const config = useIntegrationConfig(doorbellIntegration)

  // `useIntegrationConfig` returns null both while the first fetch is still
  // in flight and when it fails outright — the same schema default grid
  // falls back to on a fetch failure (`CamerasBoard.tsx`'s `.catch`) covers
  // both: the brief window before the real config arrives resolves to the
  // household's actual default URL rather than flashing the "not
  // configured" message first. A *blanked* `camera_url` is different: that
  // only ever comes from a successful fetch (the field parses to `''`, a
  // defined value zod's `.default()` does not override), so it falls
  // through to the written line below instead.
  const defaultCameraUrl = doorbellIntegration.schema.parse({}).camera_url
  const cameraUrl = config ? config.camera_url || null : defaultCameraUrl

  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Broadsheet's palette lives in CSS on `.broadsheet-root`, so it's read back
  // off the document rather than restated in JS.
  const css = useMemo(
    () =>
      buildDoorbellCss({
        vars: resolveBroadsheetDoorbellVars(),
        origin: window.location.origin,
      }),
    // The resolver reads the live document rather than anything in scope, so
    // there is nothing here for the linter to see. The dependency is the point:
    // re-read the palette each time this remounts, in case the theme changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cameraUrl],
  )

  const { revealed } = useDoorbellTheme({
    iframeRef,
    cameraUrl: cameraUrl ?? '',
    css,
    layoutCss: BROADSHEET_LAYOUT,
  })

  return (
    <div
      data-testid="broadsheet-cameras"
      className="broadsheet-root w-[1600px] h-full flex flex-col"
    >
      <MastheadFrame
        // Left ear is deliberately empty for now. The suite's masthead rule
        // says both ears carry live data and no ear is a second name, which
        // retired "Section V / The Watch Room" — but the design's replacement
        // is a per-camera "last motion" list, and this screen has no camera
        // list to build one from: it embeds a single doorbell page by URL
        // (`doorbell.camera_url`). Left blank rather than filled with another
        // label, until there is real data to put here.
        left={null}
        center={
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>
              {CLOCK_DATE_FORMAT.format(now).toUpperCase()}
            </div>
            {/* The centre names the page. It used to name the *camera* ("The
                Front Step") above a kicker describing the page — with one
                camera configured, that was as fixed as a page name and told
                you nothing the nav tab didn't. */}
            <h1 className="m-0" style={mastheadNumeralStyle}>
              Cameras
            </h1>
          </>
        }
        right={
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'right' }}>Now</div>
            {/* Time only. The date moved to the centre kicker with this
                screen's masthead rework, and printing it in both places is
                the duplication that rework exists to remove. */}
            <div style={{ ...clockTimeStyle, textAlign: 'right' }}>
              {CLOCK_TIME_FORMAT.format(now)}
            </div>
          </>
        }
      />

      <div className="flex-1 min-h-0 flex flex-col" style={{ padding: '16px 56px' }}>
        {cameraUrl ? (
          <div
            data-testid="cameras-feed-frame"
            style={{
              flex: 1,
              minHeight: 0,
              position: 'relative',
              border: '8px solid var(--ink)',
              // The same tone the doorbell page's stage fill uses
              // (`layouts.ts` reads it as `--doorbell-border`). Showing
              // through while the frame is hidden, it makes the pre-theme beat
              // the colour of what follows rather than a flash before it.
              background: 'var(--rule-faint)',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            {/* Hidden until the first payload goes out. `postMessage` can't
             *  beat first paint, so an immediately-visible frame shows the
             *  doorbell page's own grey defaults for a beat before the theme
             *  lands — against this frame's near-black ground that reads as a
             *  flash. The ink backing behind shows through meanwhile, and
             *  `useDoorbellTheme` reveals on a deadline regardless, so a page
             *  that never handshakes still gets seen. */}
            {/* Keyed on the URL so a change replaces the element rather than
             *  editing its `src`. Config resolves after first paint, so this
             *  frame mounts on the schema default and only then switches to
             *  the household's real URL — and an in-place `src` change does
             *  not reliably re-navigate a frame that is already loading. It
             *  was observed sticking on the default's origin, streaming the
             *  wrong doorbell entirely. Replacing the element also restarts
             *  the theming handshake, which is what we want: the new page
             *  posts its own `doorbell:ready`. */}
            <iframe
              key={cameraUrl}
              ref={iframeRef}
              src={cameraUrl}
              title="Front step camera"
              className="w-full h-full border-0"
              style={{ visibility: revealed ? 'visible' : 'hidden' }}
              allow="autoplay; camera; microphone"
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <p style={emptyStateStyle}>
              No picture from the front step. Add a camera URL in Settings → Doorbell Camera.
            </p>
          </div>
        )}
      </div>

      {/* Reserves the 64px the footer occupies (`BroadsheetLayout`) — same
       *  spacer every other broadsheet screen ends with. */}
      <div style={{ flexShrink: 0, height: 64 }} />
    </div>
  )
}
