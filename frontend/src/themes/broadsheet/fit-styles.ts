import type { CSSProperties } from 'react'

/**
 * The shown/hidden style pair for any column that decides what fits by
 * measuring its own content (Home's `SportsColumn`, the by-sport
 * `LeagueColumn`'s `FittedExtras`). Shared so the two can't drift apart —
 * `flow-root` matters for the measurement itself, not just the look.
 */

/** `flow-root` so each block's `offsetHeight` includes its children's
 *  margins (a child's own top margin would otherwise collapse through the
 *  wrapper and go uncounted, and the shown block would then read shorter
 *  than it actually renders). */
export const shownFitStyle: CSSProperties = { display: 'flow-root' }

/** Laid out at the column's width but out of flow and invisible, so it can
 *  still be measured — and so it can come back the moment there's room for
 *  it, without remounting. */
export const hiddenFitStyle: CSSProperties = {
  ...shownFitStyle,
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  visibility: 'hidden',
  pointerEvents: 'none',
}
