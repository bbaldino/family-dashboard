import { describe, it, expect } from 'vitest'
import { bucketSegments, windowEndOf, BLOCKS_24H } from './uptime'
import type { UptimeSegment } from './types'

/** The mock draws 24 hours as 48 half-hour blocks. The API gives arbitrary
 *  spans instead, so they have to be resampled — and the resampling is where a
 *  brief outage either shows up or silently disappears. */
describe('bucketSegments', () => {
  const NOW = 1_800_000_000
  const DAY = 86_400
  const seg = (status: UptimeSegment['status'], start: number, end: number): UptimeSegment => ({
    status,
    start,
    end,
  })

  it('renders a clean day as 48 ok blocks', () => {
    const blocks = bucketSegments([seg('ok', NOW - DAY, NOW)], NOW, DAY)

    expect(blocks).toHaveLength(BLOCKS_24H)
    expect(new Set(blocks)).toEqual(new Set(['ok']))
  })

  it('marks gaps with no data as unknown rather than guessing', () => {
    const blocks = bucketSegments([seg('ok', NOW - DAY / 2, NOW)], NOW, DAY)

    expect(blocks[0]).toBe('unknown')
    expect(blocks[BLOCKS_24H - 1]).toBe('ok')
  })

  it('puts the newest data at the end', () => {
    const blocks = bucketSegments(
      [seg('critical', NOW - DAY, NOW - DAY / 2), seg('ok', NOW - DAY / 2, NOW)],
      NOW,
      DAY,
    )

    expect(blocks[0]).toBe('critical')
    expect(blocks[BLOCKS_24H - 1]).toBe('ok')
  })

  /** The whole point of the bar is catching the bad half-hour. A short outage
   *  inside a block must win it — averaging it away would draw a clean day
   *  over a real fault. */
  it('lets the worst status in a block win it', () => {
    const blocks = bucketSegments(
      [
        seg('ok', NOW - DAY, NOW - 600),
        seg('critical', NOW - 600, NOW - 300),
        seg('ok', NOW - 300, NOW),
      ],
      NOW,
      DAY,
    )

    expect(blocks[BLOCKS_24H - 1]).toBe('critical')
  })

  it('survives an empty report', () => {
    const blocks = bucketSegments([], NOW, DAY)

    expect(blocks).toHaveLength(BLOCKS_24H)
    expect(new Set(blocks)).toEqual(new Set(['unknown']))
  })

  /** Anchoring the bar to the browser's clock instead would draw phantom
   *  "unknown" blocks on any tablet whose time drifts ahead of the server. */
  it('takes the window end from the newest segment, not the clock', () => {
    expect(
      windowEndOf([seg('ok', NOW - DAY, NOW - 100), seg('ok', NOW - 100, NOW - 50)]),
    ).toBe(NOW - 50)
  })

  it('has no window end when there is nothing to draw', () => {
    expect(windowEndOf([])).toBeNull()
  })
})
