/** Sub-pixel slack: layout can land a bottom edge a fraction past the room's
 *  edge (fractional scaling, font metrics) when it visibly fits. */
const EDGE_TOLERANCE = 0.5

/**
 * How many of Coming up's countdowns to show: the leading run whose bottom
 * edges (viewport px) land inside the room's bottom edge `limit`. Measured by
 * bottom edge rather than summed heights because the list is a two-up grid —
 * both entries of a row share one bottom, so a row is kept or dropped whole and
 * never shown half-cut. Order is soonest-first, so a later countdown never
 * shows when an earlier one didn't fit.
 */
export function fitWholeItems(bottoms: number[], limit: number): number {
  let count = 0
  for (const bottom of bottoms) {
    if (bottom > limit + EDGE_TOLERANCE) break
    count++
  }
  return count
}
