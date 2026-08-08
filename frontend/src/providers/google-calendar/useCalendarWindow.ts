import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { integrationQueryKey, useAllConfig } from '@/platform'
import { readCalendarIdsOrDefault } from './calendarIds'
import { googleCalendarProvider } from './config'
import { calendarEventsPath, fetchCalendarEvents } from './events'
import type { CalendarRange, CalendarSourceEntry } from './types'

/**
 * Matches what the week strip polled at before this existed, so the freshest
 * consumer's freshness does not regress now that they all share one sync.
 */
const SYNC_INTERVAL_MS = 5 * 60 * 1000

/**
 * The window, in whole months either side of the current one.
 *
 * The asymmetry is deliberate. **Backward** only has to cover reading into
 * recent history — the month grid paged back a month or two, and
 * `AssignmentsTab` looking at a week just gone; a month is enough for both.
 * **Forward** has to cover everything the dashboard shows ahead, which is
 * every consumer's whole range, so it gets the bulk of the window.
 *
 * Six months is affordable because the volume is known: measured against the
 * real calendars on 2026-08-07, five calendars hold 487 events a year, so
 * this window is roughly 240 events across all of them. Payload size never
 * enters the decision.
 */
const MONTHS_BACK = 1
const MONTHS_FORWARD = 5

/** The synced window: a `CalendarRange` that also says what it spans. */
export interface CalendarWindow extends CalendarRange {
  /** Start of the synced window, inclusive. */
  start: Date
  /** End of the synced window, **exclusive**. */
  end: Date
}

export interface CalendarWindowOptions {
  /**
   * `false` stops the sync without unmounting it, for a consumer that already
   * has its events some other way — a scenario fixture, in practice, where a
   * live request would defeat the point of running offline.
   */
  enabled?: boolean
}

/**
 * Month-aligned bounds around the month `now` falls in.
 *
 * Aligned to months rather than to `now` for two reasons: the bounds go in
 * the query keys, so they must be stable across renders or every render is a
 * new cache entry; and a consumer asking "is this month inside the window?"
 * gets an exact answer rather than one that depends on the day of the month.
 * The cost is that the far edge drifts by up to a month — the guarantee is
 * *at least* `MONTHS_BACK` back and `MONTHS_FORWARD` forward, never less.
 */
function calendarWindowBounds(now: Date): { start: Date; end: Date } {
  const year = now.getFullYear()
  const month = now.getMonth()
  return {
    start: new Date(year, month - MONTHS_BACK, 1),
    end: new Date(year, month + MONTHS_FORWARD + 1, 1),
  }
}

/**
 * One broad window of events, synced once per configured calendar, for every
 * consumer to filter locally.
 *
 * Each consumer used to fetch its own range per calendar — the week strip
 * seven days, the month grid its grid, the chore assignments row its week —
 * which is 11–16 upstream requests on a dashboard load with five calendars
 * configured, and react-query cannot collapse them because the range is in
 * the key: two ranges are two cache entries even when one strictly contains
 * the other. One window covering all of them is five requests, and every
 * in-window read afterwards is local filtering.
 *
 * **One query per calendar, not one query over all of them.** That is what
 * lets a failure be reported as *that calendar's* failure: this uses the
 * *throwing* `fetchCalendarEvents` and lets react-query hold each query's
 * error separately, which surfaces in `calendars` per id rather than folding
 * every calendar into one shared result where a failure could hide behind a
 * quiet one — on 2026-08-07, telling an unreadable calendar apart from an
 * empty one took a manual 12-month probe against the backend before this
 * existed.
 *
 * Takes the stored calendar-ids string rather than reading config itself:
 * which key holds them is the consumer's business (countdowns keeps a
 * different calendar under `countdowns.calendar_id`), and a provider must not
 * import an integration to find out. The `'primary'` fallback is applied here
 * because this is a fetch path — see `readCalendarIdsOrDefault`.
 *
 * `useAllConfig`'s pending flag gates the sync for the reason the existing
 * calendar hooks document: config reads as absent both while it loads and
 * when it is genuinely unset, so an ungated first render would sync
 * `['primary']` and then correct itself.
 *
 * No `placeholderData: keepPreviousData` here, unlike the week strip. These
 * observers are positional over a runtime-length list, so when the configured
 * ids change, observer *i* can end up on a different calendar — and previous
 * data carried across that would file one calendar's events under another's
 * id, which is precisely the confusion the per-calendar split exists to
 * prevent. A consumer that must not blank keeps its own previous value.
 */
export function useCalendarWindow(
  savedCalendarIds: string | undefined | null,
  options: CalendarWindowOptions = {},
): CalendarWindow {
  const { enabled = true } = options
  const { isPending: configPending } = useAllConfig()
  const calendarIds = useMemo(() => readCalendarIdsOrDefault(savedCalendarIds), [savedCalendarIds])

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  // Recomputed only when the month turns over, so the ISO strings below —
  // and therefore the query keys — hold still in between.
  const { start, end } = useMemo(
    () => calendarWindowBounds(new Date(year, month, 1)),
    [year, month],
  )
  const startStr = start.toISOString()
  const endStr = end.toISOString()

  const results = useQueries({
    queries: calendarIds.map((calendarId) => ({
      // Keyed through the platform's helper on the request this actually
      // makes, so a `useIntegrationQuery` asking for the same thing lands on
      // the same cache entry instead of fetching it a second time.
      queryKey: integrationQueryKey(googleCalendarProvider.id, {
        url: calendarEventsPath(calendarId, startStr, endStr),
      }),
      queryFn: () => fetchCalendarEvents(calendarId, startStr, endStr),
      refetchInterval: SYNC_INTERVAL_MS,
      enabled: enabled && !configPending,
    })),
  })

  const calendars: CalendarSourceEntry[] = calendarIds.map((calendarId, i) => ({
    calendarId,
    events: results[i]?.data ?? [],
    error: (results[i]?.error as Error | null) ?? null,
    isLoading: configPending || (results[i]?.isLoading ?? true),
  }))

  const allFailed = calendars.length > 0 && calendars.every((c) => c.error !== null)

  return {
    events: calendars.flatMap((c) => c.events),
    calendars,
    start,
    end,
    isLoading: calendars.some((c) => c.isLoading),
    error: allFailed ? calendars[0].error : null,
    refetch: async () => {
      await Promise.all(results.map((r) => r.refetch()))
    },
  }
}
