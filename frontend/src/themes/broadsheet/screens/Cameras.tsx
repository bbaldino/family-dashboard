import { useIntegrationConfig } from '@/data/use-integration-config'
import { doorbellIntegration } from '@/data/doorbell'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { useNow } from '@/themes/broadsheet/home/useNow'

/** The masthead's small screen-title treatment — 26px italic serif, mock
 *  `doorbell.jsx:57` — matches `MediaMasthead.tsx`'s identical `screenTitleStyle`
 *  exactly, but not imported from there: that constant isn't shared outside
 *  Media's own masthead (see that file's own comment on why), and this
 *  screen has nothing else in common with Media worth coupling the two
 *  files over one style object. */
const screenTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 26,
  fontWeight: 400,
  // Mock `C.ink2` (#2e2620) has no broadsheet token — same `color-mix`
  // approximation `media/colors.ts`'s `INK2` uses, duplicated here for the
  // same reason `screenTitleStyle` itself isn't imported.
  color: 'color-mix(in srgb, var(--paper) 12%, var(--ink) 88%)',
}

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

/** The date line beneath the clock — mono, mock `doorbell.jsx:71` (10px,
 *  0.12em tracking, muted). Seconds are dropped: `useNow` ticks every 30s
 *  (a wall clock, not a stopwatch — see that hook's own comment), so a
 *  seconds digit here would sit frozen between ticks and read as a stalled
 *  clock rather than a live one. */
const clockDateStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  color: 'var(--ink-muted)',
  marginTop: 4,
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
 * The centre cell's wording is a deliberate departure from the mock's "Live
 * · front step" / "At the Door": that phrasing reads as someone currently
 * standing at the door, which this screen can't promise — it's just an
 * always-available window onto the front step, not an event notification.
 * "Keeping Watch" / "The Front Step" is true whether or not anyone's there.
 *
 * Unlike `useWebRtcStream` (`src/data/doorbell/useWebRtcStream.ts`), this
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

  return (
    <div data-testid="broadsheet-cameras" className="broadsheet-root w-[1600px] h-[900px] flex flex-col">
      <MastheadFrame
        left={
          <>
            <div style={mastheadKickerStyle}>Section V</div>
            <div style={screenTitleStyle}>The Watch Room</div>
          </>
        }
        center={
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>Keeping Watch</div>
            <h1 className="m-0" style={mastheadNumeralStyle}>
              The Front Step
            </h1>
          </>
        }
        right={
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'right' }}>Now</div>
            <div style={{ ...clockTimeStyle, textAlign: 'right' }}>{CLOCK_TIME_FORMAT.format(now)}</div>
            <div style={{ ...clockDateStyle, textAlign: 'right' }}>{CLOCK_DATE_FORMAT.format(now).toUpperCase()}</div>
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
              background: '#0a0805',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <iframe
              src={cameraUrl}
              title="Front step camera"
              className="w-full h-full border-0"
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
