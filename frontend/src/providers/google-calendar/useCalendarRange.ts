import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { integrationQueryKey, useAllConfig } from '@/platform'
import { parseLocalDate } from '@/utils/date'
import { readCalendarIdsOrDefault } from './calendarIds'
import { googleCalendarProvider } from './config'
import { calendarEventsPath, fetchCalendarEvents } from './events'
import type { CalendarEvent, CalendarRange, CalendarSourceEntry } from './types'
import { useCalendarWindow } from './useCalendarWindow'

export interface CalendarRangeOptions {
  /**
   * `false` stops the sync **and** any expansion fetch, for a consumer that
   * already has its events some other way — a scenario fixture, in practice,
   * where a live request would defeat the point of running offline. It has to
   * cover both sources: the month grid can be pointed at a month outside the
   * window, and a fixture that silenced only the window would still put that
   * month's fetch on the wire.
   */
  enabled?: boolean
}

/**
 * How long an expansion fetch counts as fresh.
 *
 * Matched to the window's sync interval so that "how stale can what I am
 * looking at be" has one answer regardless of which side of the window it
 * came from. It also has to be non-zero for a different reason: react-query
 * treats data as stale immediately by default, so paging back to a month
 * would re-request it on arrival and the expansion would cache nothing.
 */
const EXPANSION_STALE_MS = 5 * 60 * 1000

/** First-of-month dates for every month `[start, end)` touches. */
function monthsSpanned(start: Date, end: Date): Date[] {
  if (end.getTime() <= start.getTime()) return []
  const months: Date[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor.getTime() < end.getTime()) {
    months.push(new Date(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

/** The exclusive end of the month starting at `monthStart`. */
function monthEnd(monthStart: Date): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
}

/**
 * An event's span in milliseconds, end **exclusive**.
 *
 * All-day events carry local date strings and must be parsed as local
 * midnight — `new Date('2026-03-30')` is UTC midnight, which is the day
 * before in every negative-offset zone, so a Monday event would filter as
 * Sunday's.
 */
function eventBoundsMs(event: CalendarEvent): { start: number; end: number } {
  const startsAt = event.start.dateTime
    ? new Date(event.start.dateTime).getTime()
    : parseLocalDate(event.start.date ?? '').getTime()
  const endsAt = event.end.dateTime
    ? new Date(event.end.dateTime).getTime()
    : event.end.date
      ? parseLocalDate(event.end.date).getTime()
      : startsAt
  // A zero-length event still occupies its instant. Google writes a one-day
  // all-day event as an exclusive next-day end, but not every producer does,
  // and `end === start` would otherwise overlap nothing at all.
  return { start: startsAt, end: Math.max(endsAt, startsAt + 1) }
}

/** Google's own `timeMin`/`timeMax` semantics: overlap, not containment. */
function overlaps(event: CalendarEvent, fromMs: number, toMs: number): boolean {
  const bounds = eventBoundsMs(event)
  return bounds.start < toMs && bounds.end > fromMs
}

/**
 * One event per id, first occurrence winning.
 *
 * A multi-day event that crosses the window's edge comes back from both the
 * window sync and the expansion fetch either side of it, because both
 * overlap it. Two copies of one event would render as two rows.
 */
function dedupeById(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>()
  const unique: CalendarEvent[] = []
  for (const event of events) {
    if (seen.has(event.id)) continue
    seen.add(event.id)
    unique.push(event)
  }
  return unique
}

/**
 * Every configured calendar's events in `[start, end)`, from the synced
 * window where it reaches and a fetch where it does not.
 *
 * **Inside the window, this is pure filtering — no request at all.** That is
 * the common case and the point of the window: the week strip's seven days,
 * the assignments row's week, the month grid's current month and its
 * neighbours are all already in memory, and asking upstream for them again
 * is 11–16 round trips a dashboard load that buy nothing.
 *
 * **Outside it, the fetch is expanded to whole months**, not the exact range
 * asked for. Both out-of-window callers page: `AssignmentsTab` a week at a
 * time with no clamp, the month grid a month at a time with year rollover.
 * An exact-range fetch would make every page a new cache entry overlapping
 * the last by most of its days, so paging back and forth would re-request
 * continually. A month is the natural unit for the grid, contains any week a
 * page lands on, and — with `EXPANSION_STALE_MS` — means the second visit is
 * free.
 *
 * **A range may straddle the window's edge**, and that is the case worth
 * being careful about: `AssignmentsTab`'s `prevWeek` has no clamp, so five
 * clicks back from today reaches a week that begins before the window and
 * ends inside it. Filtering such a week out of the window alone would drop
 * its first days and render perfectly plausibly — a grid with two columns
 * quietly empty. So containment is decided per month, and only the months
 * the window does not hold are fetched.
 *
 * The window's bounds are month-aligned, which is what makes a month either
 * wholly inside it or wholly outside — never partly. `dedupeById` covers the
 * one place that would otherwise show through anyway: an event spanning the
 * boundary is returned by both sides.
 *
 * Takes the stored calendar-ids string rather than reading config itself,
 * for the reason `useCalendarWindow` documents: which key holds them is the
 * consumer's business, and a provider must not import an integration to find
 * out.
 */
export function useCalendarRange(
  savedCalendarIds: string | undefined | null,
  start: Date,
  end: Date,
  options: CalendarRangeOptions = {},
): CalendarRange {
  const { enabled = true } = options
  const { isPending: configPending } = useAllConfig()
  const synced = useCalendarWindow(savedCalendarIds, { enabled })
  const calendarIds = useMemo(() => readCalendarIdsOrDefault(savedCalendarIds), [savedCalendarIds])

  const startMs = start.getTime()
  const endMs = end.getTime()
  const windowStartMs = synced.start.getTime()
  const windowEndMs = synced.end.getTime()

  const months = useMemo(() => monthsSpanned(new Date(startMs), new Date(endMs)), [startMs, endMs])
  const outsideMonths = useMemo(
    () =>
      months.filter(
        (month) => !(month.getTime() >= windowStartMs && monthEnd(month).getTime() <= windowEndMs),
      ),
    [months, windowStartMs, windowEndMs],
  )

  /** One query per calendar per month the window does not already hold. */
  const expansions = useMemo(
    () =>
      calendarIds.flatMap((calendarId) =>
        outsideMonths.map((month) => ({
          calendarId,
          startStr: month.toISOString(),
          endStr: monthEnd(month).toISOString(),
        })),
      ),
    [calendarIds, outsideMonths],
  )

  const results = useQueries({
    queries: expansions.map(({ calendarId, startStr, endStr }) => ({
      // Keyed on the request it makes, exactly as the window keys its own, so
      // two callers wanting the same month share one cache entry.
      queryKey: integrationQueryKey(googleCalendarProvider.id, {
        url: calendarEventsPath(calendarId, startStr, endStr),
      }),
      queryFn: () => fetchCalendarEvents(calendarId, startStr, endStr),
      staleTime: EXPANSION_STALE_MS,
      enabled: enabled && !configPending,
      // No `refetchInterval`: an out-of-window month is somewhere a person
      // deliberately paged to, not the live view. The window keeps polling.
    })),
  })

  const usesWindow = months.length > outsideMonths.length
  const perCalendar = outsideMonths.length

  const calendars: CalendarSourceEntry[] = calendarIds.map((calendarId, i) => {
    const windowEntry = usesWindow ? synced.calendars[i] : undefined
    const expanded = results.slice(i * perCalendar, (i + 1) * perCalendar)

    const contributed = [
      ...(windowEntry?.events ?? []),
      ...expanded.flatMap((result) => result.data ?? []),
    ]
    const expansionError = expanded.find((result) => result.error)?.error as Error | undefined

    return {
      calendarId,
      events: dedupeById(contributed.filter((event) => overlaps(event, startMs, endMs))),
      // Either source failing is this calendar's failure, and which calendar
      // it was is the thing that must survive.
      error: windowEntry?.error ?? expansionError ?? null,
      isLoading:
        configPending ||
        (windowEntry?.isLoading ?? false) ||
        expanded.some((result) => result.isLoading),
    }
  })

  const allFailed = calendars.length > 0 && calendars.every((c) => c.error !== null)

  return {
    events: calendars.flatMap((c) => c.events),
    calendars,
    isLoading: calendars.some((c) => c.isLoading),
    error: allFailed ? calendars[0].error : null,
    refetch: async () => {
      await Promise.all([
        ...(usesWindow ? [synced.refetch()] : []),
        ...results.map((result) => result.refetch()),
      ])
    },
  }
}
