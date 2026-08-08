import { useMemo, useState } from 'react'
import type { PollResult } from '@/integrations/types'
import { useIntegrationConfig } from '@/platform'
import { activeScenario } from '@/lib/scenario'
import { useCalendarRange, type CalendarEvent } from '@/providers/google-calendar'
import { calendarIntegration } from './config'
import { monthFixtureFor } from './fixtures'
import { eventLocalDateStr, parseLocalDate, toLocalDateStr } from '@/utils/date'

export interface MonthEvents {
  /** Map of "YYYY-MM-DD" → sorted events for that day */
  byDate: Record<string, CalendarEvent[]>
}

/**
 * The dates the grid actually displays: the Sunday on or before the 1st,
 * through the Saturday that closes the month's last week, **end exclusive**.
 *
 * Wider than the month on both sides, which is the whole reason the range
 * resolver expands an out-of-window fetch to whole months — asking for
 * exactly this would make every page a new cache entry overlapping the last
 * by most of its days. `themes/broadsheet/datebook/month-grid-dates.ts`
 * mirrors this computation to decide how many week rows to render, so the two
 * must agree: a row it draws that this does not cover would be blank rather
 * than empty, with real events silently missing.
 */
function monthGridBounds(year: number, month: number): { start: Date; end: Date } {
  const firstOfMonth = new Date(year, month, 1)
  const start = new Date(firstOfMonth)
  start.setDate(start.getDate() - start.getDay())

  const lastOfMonth = new Date(year, month + 1, 0)
  const end = new Date(lastOfMonth)
  end.setDate(end.getDate() + (6 - end.getDay()) + 1)

  return { start, end }
}

/**
 * Events bucketed under every local date they occupy.
 *
 * **A multi-day event is walked across each of its days** rather than filed
 * under the day it starts, because the grid is a map of days: a trip that
 * appeared only on its first cell would read as a one-day trip. Google's
 * all-day end date is exclusive, so 05-10 → 05-13 fills the 10th, 11th and
 * 12th and stops.
 *
 * Each day is then sorted all-day events first, then timed ones in order —
 * the grid's day cells cap at a few visible pills, so which events get cut is
 * decided here.
 */
function bucketByDate(events: CalendarEvent[]): MonthEvents {
  const byDate: Record<string, CalendarEvent[]> = {}

  for (const event of events) {
    const dateKey = eventLocalDateStr(event)
    if (!dateKey) continue
    const endKey = eventLocalDateStr({ start: event.end })

    if (dateKey === endKey) {
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(event)
    } else {
      // Multi-day event: add to each day
      const cursor = parseLocalDate(dateKey)
      const end = parseLocalDate(endKey)
      while (cursor < end) {
        const key = toLocalDateStr(cursor)
        if (!byDate[key]) byDate[key] = []
        byDate[key].push(event)
        cursor.setDate(cursor.getDate() + 1)
      }
    }
  }

  for (const dayEvents of Object.values(byDate)) {
    dayEvents.sort((a, b) => {
      const aAllDay = !a.start.dateTime
      const bAllDay = !b.start.dateTime
      if (aAllDay && !bAllDay) return -1
      if (!aAllDay && bAllDay) return 1
      const aTime = a.start.dateTime ?? a.start.date ?? ''
      const bTime = b.start.dateTime ?? b.start.date ?? ''
      return aTime.localeCompare(bTime)
    })
  }

  return { byDate }
}

/** A cheap content key for a month: what it shows, not which arrays hold it. */
function monthSignature(events: MonthEvents): string {
  return Object.entries(events.byDate)
    .map(([date, dayEvents]) => `${date}:${dayEvents.map((e) => e.id).join(',')}`)
    .join('|')
}

/**
 * One month's events, bucketed by local date, for the month grid.
 *
 * Reads through the provider's range resolver rather than fetching: the grid's
 * displayed range — leading and trailing days from the adjacent months
 * included — goes to `useCalendarRange`, which answers from the synced window
 * when it reaches and fetches only when it does not. **Today's month and its
 * neighbours therefore cost nothing**, which is the common case and most of
 * the requests this saves; paging far out is the case that still fetches, and
 * the resolver expands that to whole months so paging back is free.
 *
 * This is the one consumer that can ask for *anything* — both themes page
 * months with year rollover and neither clamps — so unlike the week strip it
 * genuinely reaches outside the window, and the resolver is what makes that
 * safe rather than a hole in the grid.
 *
 * The calendar ids come from *this* integration's config and are handed down,
 * for the reason the provider documents: countdowns keeps a different calendar
 * under its own key, so a provider must not assume which one it is reading.
 * Passing them through also keeps the grid reactive to a config change with no
 * remount — the tablet is a kiosk that never reloads, so "on the next reload"
 * means "never".
 *
 * A scenario fixture disables the resolver rather than merely ignoring it —
 * both its sources, since a month grid can be pointed outside the window — so
 * this hook asks for nothing. The window itself is shared, though: a scenario
 * that defines a month fixture but no week fixture still syncs it through the
 * week strip. See `CalendarWindowOptions.enabled`.
 *
 * The result is adapted to `PollResult`: `data` is `null`, not react-query's
 * `undefined`, until events have actually arrived, which `Calendar.tsx`
 * documents relying on.
 */
export function useMonthCalendar(year: number, month: number): PollResult<MonthEvents> {
  const config = useIntegrationConfig(calendarIntegration)
  const fixture = monthFixtureFor(activeScenario, year, month)
  const { start, end } = useMemo(() => monthGridBounds(year, month), [year, month])
  const range = useCalendarRange(config?.calendar_ids, start, end, { enabled: !fixture })

  const monthEvents = useMemo(() => fixture ?? bucketByDate(range.events), [fixture, range.events])

  // The last month we could actually build, so that neither a config change
  // re-syncing the window nor a page to a month that has to be fetched empties
  // the grid while it lands. The window deliberately carries no previous data
  // of its own (its observers are positional over a runtime-length list), so
  // this is where that job now lives. Kept against a content signature rather
  // than array identity: the resolver hands back a fresh array every render,
  // and storing on identity alone would be a render loop.
  const [kept, setKept] = useState<{ signature: string; events: MonthEvents } | null>(null)
  const signature = range.isLoading ? null : monthSignature(monthEvents)

  // React's documented way to adjust state from what rendered, rather than an
  // effect: it settles before the browser sees anything, so the grid never
  // paints a blank frame between two months.
  if (signature !== null && signature !== kept?.signature) {
    setKept({ signature, events: monthEvents })
  }

  const data = range.isLoading ? (kept?.events ?? null) : monthEvents

  return {
    data,
    error: range.error ? range.error.message : null,
    isLoading: data === null && range.isLoading,
    refetch: range.refetch,
  }
}
