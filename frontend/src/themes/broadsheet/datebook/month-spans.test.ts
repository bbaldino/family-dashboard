import { describe, expect, it } from 'vitest'
import { buildSpanSegments } from './month-spans'
import { getMonthGridWeeks } from './month-grid-dates'
import type { EventSpan } from '@/integrations/calendar'
import type { CalendarEvent } from '@/providers/google-calendar'

// May 2026: the mock's own example month. Its grid opens on Sun 26 Apr, so
// cell 0 is 26 Apr and 1 May lands in the first row.
const WEEKS = getMonthGridWeeks(2026, 4)

const span = (id: string, startKey: string, endKey: string, summary = id): EventSpan => ({
  event: { id, summary } as CalendarEvent,
  startKey,
  endKey,
})

describe('buildSpanSegments', () => {
  it('lays a span contained in one week as a single segment', () => {
    const { segments } = buildSpanSegments([span('concert', '2026-05-26', '2026-05-28')], WEEKS)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({
      id: 'concert',
      cols: 3,
      opensSpan: true,
      closesSpan: true,
      lane: 0,
    })
  })

  /**
   * The shape the whole feature exists for. 9–10 May crosses a Saturday, so it
   * becomes two segments: the first closes at the week's edge without claiming
   * to end, the second opens at the next week's edge without claiming to start.
   */
  it('cuts a span at the week boundary into two segments', () => {
    const { segments } = buildSpanSegments([span('ted', '2026-05-09', '2026-05-10')], WEEKS)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({ opensSpan: true, closesSpan: false, col: 6, cols: 1 })
    expect(segments[1]).toMatchObject({ opensSpan: false, closesSpan: true, col: 0, cols: 1 })
    expect(segments[1].row).toBe(segments[0].row + 1)
  })

  it('gives every segment of a crossing span the same event id', () => {
    const { segments } = buildSpanSegments([span('trip', '2026-05-15', '2026-05-18')], WEEKS)
    expect(segments.length).toBeGreaterThan(1)
    expect(new Set(segments.map((s) => s.id))).toEqual(new Set(['trip']))
  })

  it('stacks overlapping spans into separate lanes', () => {
    const { segments, lanesByRow } = buildSpanSegments(
      [span('a', '2026-05-04', '2026-05-07'), span('b', '2026-05-06', '2026-05-08')],
      WEEKS,
    )
    const a = segments.find((s) => s.id === 'a')!
    const b = segments.find((s) => s.id === 'b')!
    expect(a.lane).toBe(0)
    expect(b.lane).toBe(1)
    expect(lanesByRow[a.row]).toBe(2)
  })

  it('reuses lane 0 for spans in the same row that do not overlap', () => {
    const { segments, lanesByRow } = buildSpanSegments(
      [span('a', '2026-05-04', '2026-05-05'), span('b', '2026-05-07', '2026-05-08')],
      WEEKS,
    )
    expect(segments.every((s) => s.lane === 0)).toBe(true)
    expect(lanesByRow[segments[0].row]).toBe(1)
  })

  /**
   * A trip that began last month still crosses days this grid shows. Clipping
   * it to the first cell is right; letting it report `opensSpan` is not — it
   * would draw a start rule and claim to begin on a day it did not.
   */
  it('clips a span starting before the grid and marks it as carrying in', () => {
    const { segments } = buildSpanSegments([span('early', '2026-04-01', '2026-04-28')], WEEKS)
    expect(segments.length).toBeGreaterThan(0)
    expect(segments[0]).toMatchObject({ row: 0, col: 0, opensSpan: false })
    expect(segments[segments.length - 1].closesSpan).toBe(true)
  })

  it('clips a span running past the grid and marks it as carrying on', () => {
    const { segments } = buildSpanSegments([span('late', '2026-06-01', '2026-07-15')], WEEKS)
    expect(segments.length).toBeGreaterThan(0)
    expect(segments[0].opensSpan).toBe(true)
    expect(segments[segments.length - 1].closesSpan).toBe(false)
  })

  it('drops a span that never touches the grid rather than clamping it', () => {
    const { segments, lanesByRow } = buildSpanSegments(
      [span('far', '2027-01-04', '2027-01-08')],
      WEEKS,
    )
    expect(segments).toEqual([])
    expect(lanesByRow.every((n) => n === 0)).toBe(true)
  })

  it('reserves lanes only on the rows that have banners', () => {
    const { lanesByRow } = buildSpanSegments([span('concert', '2026-05-26', '2026-05-28')], WEEKS)
    expect(lanesByRow).toHaveLength(WEEKS.length)
    expect(lanesByRow.filter((n) => n > 0)).toHaveLength(1)
  })

  it('returns an empty layout when there are no spans', () => {
    const { segments, lanesByRow } = buildSpanSegments([], WEEKS)
    expect(segments).toEqual([])
    expect(lanesByRow).toEqual(WEEKS.map(() => 0))
  })
})
