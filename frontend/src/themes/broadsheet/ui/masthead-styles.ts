import type { CSSProperties } from 'react'

/**
 * Type treatments `MastheadFrame.tsx` shares between Home's masthead and
 * the Datebook's — kept in their own module (rather than alongside
 * `MastheadFrame`) because a `.tsx` file that exports both a component and
 * plain constants breaks React Fast Refresh (`react-refresh/only-export-components`).
 */

/** The masthead's mono-uppercase section label — 10px, 0.28em tracking.
 *  Hand-rolled rather than the shared `Kicker` atom because the masthead
 *  uses different spacing/weight than `Kicker`'s default (see Home's
 *  `Masthead.tsx` — the follow-up brief re-specified these values
 *  exactly). */
export const mastheadKickerStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
  marginBottom: 4,
}

/** The masthead's one shared centrepiece treatment: 72px italic serif. */
export const mastheadNumeralStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 72,
  letterSpacing: '-0.03em',
  lineHeight: 0.9,
  color: 'var(--ink)',
}
