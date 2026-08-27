import type { ReactNode } from 'react'

/**
 * The masthead's three-column frame — shared verbatim between Home's
 * masthead (`src/themes/broadsheet/home/Masthead.tsx`) and the Datebook's
 * (`src/themes/broadsheet/datebook/DatebookMasthead.tsx`): a `0.85fr 1.5fr
 * 0.85fr` grid, bottom-aligned, `padding: 22px 56px 18px`, closed by a
 * `3px double` ink rule. What differs between the two screens is entirely
 * their cell *contents* (clock/date/weather vs. nav/month/tally), so only
 * the frame lives here — its two shared type treatments (the kicker label,
 * the 72px italic-serif numeral) are in the sibling `masthead-styles.ts`.
 *
 * There is deliberately no slot for content below the grid. Home used to
 * have one — a `footer` carrying the day's high/low — and it was the whole
 * reason its masthead ran taller than the design: a full-width row buying
 * vertical space at the top of the screen for two small numbers. That line
 * moved to `WeatherStrip`. A masthead is three cells on one baseline; a
 * screen wanting a fourth thing wants it somewhere else.
 *
 * `padding` defaults to the `16px 56px 12px` every current consumer
 * (Home, the Datebook, Media) shares verbatim. The Centre Spread's mock
 * (`nowplaying.jsx:51`) specifies a tighter `20px 56px 14px` instead — its
 * masthead carries a 62px title plus a three-column body underneath, so a
 * few px back from the standard rhythm is this screen's own call, not a
 * drift to paper over. An overridable prop keeps that one screen's choice
 * from becoming every screen's.
 */
export function MastheadFrame({
  left,
  center,
  right,
  padding = '16px 20px 12px',
}: {
  left: ReactNode
  center: ReactNode
  right: ReactNode
  padding?: string
}) {
  return (
    <div style={{ padding, borderBottom: '3px double var(--ink)' }}>
      <div
        className="grid items-end"
        style={{ gridTemplateColumns: '0.85fr 1.5fr 0.85fr', gap: 24 }}
      >
        {/* `minWidth: 0` on every cell, and it is load-bearing rather than
            defensive. A grid item defaults to `min-width: auto`, meaning it
            refuses to shrink below its own content — so a long centre title
            ignored the `1.5fr` entirely and grew the column to fit. Measured
            with a 62-character track name: the columns resolved to
            `86px / 1474px / 71px` instead of roughly `382 / 675 / 382`. The
            side cells were crushed until their text wrapped to five and six
            lines, which took the masthead from 113px to 306px tall and
            pushed the Close button off the screen. The centre title's own
            `truncate` never fired, because the column had grown to fit it. */}
        <div style={{ minWidth: 0 }}>{left}</div>
        <div style={{ textAlign: 'center', minWidth: 0 }}>{center}</div>
        <div style={{ textAlign: 'right', minWidth: 0 }}>{right}</div>
      </div>
    </div>
  )
}
