import { describe, expect, it } from 'vitest'
import { fitSummaryCount } from './summary-fit'

describe('fitSummaryCount', () => {
  it('shows nothing when there are no summaries', () => {
    expect(fitSummaryCount([], 800, 40)).toBe(0)
  })

  it('always shows the lead, even when it alone overflows', () => {
    expect(fitSummaryCount([900], 800, 40)).toBe(1)
    expect(fitSummaryCount([900, 100], 800, 40)).toBe(1)
  })

  it('shows every summary when they all fit, with no room kept for a strip', () => {
    // 300 + 250 + 250 = 800 exactly: nothing is left over, so no strip.
    expect(fitSummaryCount([300, 250, 250], 800, 40)).toBe(3)
  })

  it('keeps room for the strip whenever a summary will be left over', () => {
    // 300 + 250 = 550 fits, and a third can't follow, so the strip needs 40:
    // 590 ≤ 600 → two shown.
    expect(fitSummaryCount([300, 250, 400], 600, 40)).toBe(2)
    // 20px less room: 550 + 40 > 580, so the second gives its place to the
    // strip too.
    expect(fitSummaryCount([300, 250, 400], 580, 40)).toBe(1)
  })

  it('lets the last summary use the space the strip would have needed', () => {
    // 300 + 250 + 45 = 595 ≤ 600 with nothing left over — no strip to reserve.
    expect(fitSummaryCount([300, 250, 45], 600, 40)).toBe(3)
  })

  // Order is relevance: a smaller, less relevant summary never jumps a
  // bigger, more relevant one that didn't fit.
  it('stops at the first summary that does not fit rather than skipping ahead', () => {
    expect(fitSummaryCount([300, 500, 60], 700, 40)).toBe(1)
  })
})
