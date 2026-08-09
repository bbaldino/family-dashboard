import type { QueueState } from '@/integrations/music'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { INK2 } from './colors'
import { playbackPhrase } from './playback-phrase'

/** The screen title's own treatment, left cell — same 24px italic serif as
 *  the mock (`nowplaying.jsx:54`), close to but not `MediaMasthead`'s 26px
 *  `screenTitleStyle` (a different screen, a different exact value; see
 *  that file's own comment on why its title isn't the shared 72px numeral
 *  either). */
const leftTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 24,
  fontWeight: 400,
  color: INK2,
}

/** The centre title — 62px italic serif, deliberately not the masthead's
 *  shared 72px numeral (`masthead-styles.ts`'s `mastheadNumeralStyle`): the
 *  design brief calls this value out by name as the one place in the theme
 *  that isn't 72. A track title also needs to survive being much longer
 *  than a numeral ever is, so this clips rather than wrapping or
 *  overflowing the centre cell. */
const centerTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontWeight: 400,
  fontSize: 62,
  letterSpacing: '-0.03em',
  lineHeight: 0.9,
  color: 'var(--ink)',
}

const closeButtonStyle = {
  all: 'unset' as const,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 14px',
  border: '1px solid var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.22em',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  color: 'var(--ink)',
}

/**
 * The Centre Spread's own masthead — the same `MastheadFrame` as every
 * other broadsheet screen, with this screen's own cell contents: room on
 * the left, track title centred, a `Close` button on the right in place of
 * the nav-adjacent content the other screens' right cells carry.
 *
 * `trackNumber`: MA's real position field, but there's no total track count
 * in the payload (see the design brief's "What the data supports"), so the
 * kicker renders `Track {n}` with no "of {m}" clause, and omits the clause
 * entirely — falling back to the bare "Side A" flourish — when `trackNumber`
 * itself is absent. "Side A" has no backing data (`disc_number` is 1 for
 * essentially everything MA reports) but stays as a fixed vinyl-conceit
 * flourish, the same kind of decorative, not-data-driven label this screen
 * already uses for "PLATE I" (`CentreSpreadPlate.tsx`) and the masthead's
 * own "Section IV" on the Media screen proper — none of those claim to be
 * measurements, so neither does this one.
 */
export function CentreSpreadMasthead({
  room,
  playbackState,
  trackTitle,
  trackNumber,
  onClose,
}: {
  /** This panel's own room — the anchor and anything grouped into it — not
   *  the queue owner's name. See `music-context.ts`'s `anchorRoomLabel`. */
  room: string | null
  /** What that room is doing, so the left cell can say so honestly rather
   *  than claiming playback over a paused queue. */
  playbackState: QueueState['state'] | null
  trackTitle: string
  trackNumber: number | null
  onClose: () => void
}) {
  return (
    <MastheadFrame
      padding="20px 56px 14px"
      left={
        <>
          <div style={mastheadKickerStyle}>The Centre Spread</div>
          <div style={leftTitleStyle}>
            {room ? `${playbackPhrase(playbackState)} the ${room}` : 'Now playing'}
          </div>
        </>
      }
      center={
        <>
          <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>
            {trackNumber ? `Side A · Track ${trackNumber}` : 'Side A'}
          </div>
          <h1 className="m-0 truncate" style={centerTitleStyle}>
            {trackTitle}
          </h1>
        </>
      }
      right={
        <button type="button" onClick={onClose} style={closeButtonStyle}>
          Close ✕
        </button>
      }
    />
  )
}
