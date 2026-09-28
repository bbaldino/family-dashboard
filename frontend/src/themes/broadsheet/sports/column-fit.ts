/**
 * How many of a column's optional extras (form, leaders) to show: the longest
 * leading run whose heights fit whole in `available`. Unlike Home's
 * `fitSummaryCount`, nothing is forced — an extra that doesn't fit simply
 * isn't shown, since it's optional by definition — and there is no overflow
 * strip to reserve room for. Order is priority, so a later, smaller block
 * never jumps an earlier one that didn't fit.
 */
export function fitLeadingCount(heights: number[], available: number): number {
  let used = 0
  let count = 0
  for (const h of heights) {
    if (used + h > available) break
    used += h
    count++
  }
  return count
}
