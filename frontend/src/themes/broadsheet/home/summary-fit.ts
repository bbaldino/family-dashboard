/**
 * How many of the column's summaries to show, given each one's measured
 * height (in relevance order, lead first), the column's height, and the
 * "Also today" strip's height.
 *
 * - The lead always shows, even when it alone overflows — its tail clips,
 *   as a lone summary always has.
 * - Each following summary shows only if it fits whole, keeping room for the
 *   strip whenever anything would still be left over after it. The last one
 *   may use the strip's space, since nothing is left to list.
 * - It stops at the first that doesn't fit: order is relevance, so a smaller
 *   summary further down never jumps a bigger one ahead of it.
 *
 * Pure, and in its own module, so the arithmetic is tested directly rather
 * than through a component jsdom can't lay out.
 */
export function fitSummaryCount(heights: number[], available: number, stripHeight: number): number {
  if (heights.length === 0) return 0

  let used = heights[0]
  let count = 1
  for (let i = 1; i < heights.length; i++) {
    const leftOver = heights.length - (i + 1)
    const needed = heights[i] + (leftOver > 0 ? stripHeight : 0)
    if (used + needed > available) break
    used += heights[i]
    count++
  }
  return count
}
