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

/**
 * How many In brief items to show: the longest leading run of `heights`
 * (each item's own height — a dek-carrying one is just taller) that fits in
 * `available`, counting the "+N more" line's `more` height whenever the run
 * leaves any of the column's `total` items unshown. Unlike the extras, the
 * brief is never all-or-nothing: whatever fits whole is shown, and the rest
 * is named. Returns 0 when not even one item fits.
 */
export function fitBriefCount(
  heights: number[],
  available: number,
  more: number,
  total: number,
): number {
  let used = heights.reduce((a, h) => a + h, 0)
  for (let n = heights.length; n > 0; n--) {
    if (used + (n < total ? more : 0) <= available) return n
    used -= heights[n - 1]
  }
  return 0
}
