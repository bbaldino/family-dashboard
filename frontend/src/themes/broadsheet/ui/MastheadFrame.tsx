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
 * `footer` renders after the grid but still inside the padded, ruled
 * container — Home uses it for the weather cell's high/low line, which
 * must sit outside the `align-items: end` grid (a line added to just one
 * cell would throw off the shared baseline the grid otherwise guarantees;
 * see `Masthead.tsx`'s own comment on this).
 *
 * `padding` defaults to the `22px 56px 18px` every current consumer
 * (Home, the Datebook, Media) shares verbatim. The Centre Spread's mock
 * (`nowplaying.jsx:51`) specifies a tighter `20px 56px 14px` instead — its
 * masthead carries a 62px title plus a three-column body underneath, so a
 * few px back from the standard rhythm is this screen's own call, not a
 * drift to paper over. An overridable prop keeps that one screen's choice
 * from becoming every screen's, the same way `footer` already lets Home
 * add content the others don't need.
 */
export function MastheadFrame({
  left,
  center,
  right,
  footer,
  padding = '22px 56px 18px',
}: {
  left: ReactNode
  center: ReactNode
  right: ReactNode
  footer?: ReactNode
  padding?: string
}) {
  return (
    <div style={{ padding, borderBottom: '3px double var(--ink)' }}>
      <div
        className="grid items-end"
        style={{ gridTemplateColumns: '0.85fr 1.5fr 0.85fr', gap: 24 }}
      >
        <div>{left}</div>
        <div style={{ textAlign: 'center' }}>{center}</div>
        <div style={{ textAlign: 'right' }}>{right}</div>
      </div>
      {footer}
    </div>
  )
}
