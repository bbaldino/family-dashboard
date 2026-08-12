import type { EventSpan } from '@/integrations/calendar'
import { toLocalDateStr } from '@/utils/date'

/**
 * One row's worth of a multi-day event — the piece of a span that fits inside
 * a single week.
 *
 * A span crossing a week boundary becomes two segments, each keeping its own
 * end shape: the first closes flush against the week's right edge and carries
 * a `›`, the second opens flush on the left with a `‹`. That is what makes a
 * trip read as one continuous thing rather than two unrelated banners.
 */
export interface SpanSegment {
  /** The event's id. Not unique across segments — a span crossing a week
   *  boundary yields two segments with the same id, which is the point. */
  id: string
  title: string
  /** Week row index into the grid this segment belongs to. */
  row: number
  /** Column 0–6 within that row where the segment starts. */
  col: number
  /** How many columns it covers, at least 1. */
  cols: number
  /** Whether this segment carries the event's real first day, as opposed to
   *  continuing from the previous week or from before the grid begins. */
  opensSpan: boolean
  /** Whether this segment carries the event's real last day. */
  closesSpan: boolean
  /** Which stacked banner row this sits in, 0 being closest to the dates. */
  lane: number
}

/**
 * Vertical pitch between stacked banners, and the height of one. The 2px of
 * slack between them is what keeps two stacked banners from reading as a
 * single block.
 *
 * The mock's own values are 17 and 15 (`calendar.jsx:196`), and at 15 the bar
 * is too short for the 11.5px title it carries: measured in the browser, the
 * font's box is 11px and the ink of an accented capital rises 10px above the
 * baseline against a 10px ceiling, so `É` rendered as a bare `E` — the accent
 * clipped away entirely, changing the word rather than merely trimming it.
 * Two more pixels here, with the matching line-height in `SpanBanner`, puts
 * the ceiling at 10.55px and gives it room.
 */
export const LANE_H = 19
export const BANNER_H = 17

/**
 * Distance from a day cell's top to where its chips begin — the space the
 * date numeral occupies. Banners are positioned against this, and the chips
 * beneath are pushed down by `lanes * LANE_H` from the same origin, so the
 * two stay in step.
 *
 * It has to be one constant rather than each cell's real measurement, because
 * the banner layer spans whole rows and cannot know which cell it is over.
 * Measured against `DayCell`'s own box (4px padding, a 22px today badge, 3px
 * margin) rather than taken from the mock on faith.
 */
export const CHIP_TOP = 29

export interface SpanLayout {
  segments: SpanSegment[]
  /** Lanes reserved per week row. Every cell in a row reserves the same
   *  number so the day chips beneath stay on one line across the week —
   *  otherwise a Tuesday with a banner over it would sit lower than its
   *  neighbours. */
  lanesByRow: number[]
}

/**
 * Lay multi-day events out over the month grid as banners.
 *
 * The grid is treated as a flat list of cells, seven per row, exactly as the
 * mock does (`calendar.jsx`) — but the row count comes from `weeks` rather
 * than the mock's hardcoded six, since not every month needs six rows (see
 * `month-grid-dates.ts`).
 *
 * **Spans reaching outside the grid are clipped, not dropped.** A trip
 * beginning in the previous month still crosses days this grid shows, and its
 * first visible segment reports `opensSpan: false` so it renders as carrying
 * in rather than starting here.
 */
export function buildSpanSegments(spans: EventSpan[], weeks: Date[][]): SpanLayout {
  const indexByKey = new Map<string, number>()
  weeks.forEach((week, row) => {
    week.forEach((date, col) => indexByKey.set(toLocalDateStr(date), row * 7 + col))
  })

  const lastIndex = weeks.length * 7 - 1
  const segments: SpanSegment[] = []

  for (const span of spans) {
    const rawStart = indexByKey.get(span.startKey)
    const rawEnd = indexByKey.get(span.endKey)

    // A span can begin before the grid or end after it, in which case that end
    // has no cell. Clamping to the grid is only correct when the span actually
    // overlaps it, so a span entirely outside is skipped rather than clamped
    // into a phantom banner on the first or last row.
    const start = rawStart ?? (rawEnd === undefined ? undefined : 0)
    const end = rawEnd ?? (rawStart === undefined ? undefined : lastIndex)
    if (start === undefined || end === undefined || start > end) continue

    for (let cursor = start; cursor <= end;) {
      const row = Math.floor(cursor / 7)
      const segmentEnd = Math.min(end, row * 7 + 6)
      segments.push({
        id: span.event.id,
        title: span.event.summary ?? '',
        row,
        col: cursor - row * 7,
        cols: segmentEnd - cursor + 1,
        // `rawStart !== undefined` is what distinguishes a real first day from
        // one clipped at the grid's edge — without it, a trip running in from
        // last month would draw a start rule and claim to begin on the 1st.
        opensSpan: cursor === start && rawStart !== undefined,
        closesSpan: segmentEnd === end && rawEnd !== undefined,
        lane: 0,
      })
      cursor = segmentEnd + 1
    }
  }

  // Greedy lane packing per row: take the lowest lane with no overlap. Spans
  // arrive chronologically (see `spansFromByDate`), so this is deterministic.
  const byRow = new Map<number, SpanSegment[]>()
  for (const segment of segments) {
    const inRow = byRow.get(segment.row) ?? []
    let lane = 0
    while (
      inRow.some(
        (other) =>
          other.lane === lane &&
          segment.col < other.col + other.cols &&
          other.col < segment.col + segment.cols,
      )
    ) {
      lane++
    }
    segment.lane = lane
    inRow.push(segment)
    byRow.set(segment.row, inRow)
  }

  const lanesByRow = Array.from({ length: weeks.length }, () => 0)
  for (const segment of segments) {
    lanesByRow[segment.row] = Math.max(lanesByRow[segment.row], segment.lane + 1)
  }

  return { segments, lanesByRow }
}
