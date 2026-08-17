import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { RoomEar } from './RoomEar'
import { mastheadTitleSize } from '@/themes/broadsheet/ui/masthead-title-size'

/** The centre title's design size — 62px italic serif, deliberately not the
 *  masthead's shared 72px numeral (`masthead-styles.ts`'s
 *  `mastheadNumeralStyle`): the design brief calls this value out by name as
 *  the one place in the theme that isn't 72.
 *
 *  It is the size a *short* title is set at, and the ceiling. A track name
 *  is whatever the data hands us, so longer ones step down from here — see
 *  `mastheadTitleSize`. `truncate` remains on the element as the backstop. */
const CENTER_TITLE_SIZE = 62

const centerTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontWeight: 400,
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
  trackTitle,
  trackNumber,
  onClose,
}: {
  trackTitle: string
  trackNumber: number | null
  onClose: () => void
}) {
  return (
    <MastheadFrame
      padding="14px 56px 10px"
      // The room picker, the same ear Media carries — so the two screens
      // agree that rooms are selectable. It was "The Centre Spread" over a
      // playback phrase naming this panel's room: a second name for the page,
      // above something the ear now says per room. The room label itself is
      // still used by `CentreSpread`'s own credits margin.
      left={<RoomEar />}
      center={
        <>
          <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>
            {trackNumber ? `Side A · Track ${trackNumber}` : 'Side A'}
          </div>
          <h1
            className="m-0 truncate"
            style={{
              ...centerTitleStyle,
              fontSize: mastheadTitleSize(trackTitle, CENTER_TITLE_SIZE),
            }}
          >
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
