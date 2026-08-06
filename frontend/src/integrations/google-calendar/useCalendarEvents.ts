import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAllConfig, useIntegrationConfig } from '@/platform'
import { googleCalendarIntegration, parseCalendarIds } from './config'
import { fetchEventsForCalendars } from './events'
import type { CalendarEvent } from './types'

/**
 * Every event in `[start, end)` across the configured calendars, flat and
 * unbucketed.
 *
 * Deliberately stops at the flatten: `AssignmentsTab` buckets by day-of-week
 * relative to its selected Monday, the week strip buckets by date, and the
 * month grid expands multi-day events — all of which are presentation and
 * belong to the caller. What the caller must *not* have to know is which
 * calendars are configured, or that a request per calendar is what answers
 * that.
 *
 * `useAllConfig` is read alongside `useIntegrationConfig` (same query, no
 * extra request) only for its pending flag: config reads as `null` both while
 * it loads and when it is absent, so without the gate the first render would
 * fire a wasted request against `primary` and then a second, corrective one
 * against the real ids — visible as the row filling in, blanking, and filling
 * in again.
 */
export function useCalendarEvents(start: Date, end: Date) {
  const { isPending: configPending } = useAllConfig()
  const config = useIntegrationConfig(googleCalendarIntegration)
  const savedIds = config?.calendar_ids
  const calendarIds = useMemo(() => parseCalendarIds(savedIds), [savedIds])

  const startStr = start.toISOString()
  const endStr = end.toISOString()

  return useQuery<CalendarEvent[]>({
    queryKey: ['google-calendar', 'events', startStr, endStr, calendarIds],
    queryFn: () => fetchEventsForCalendars(calendarIds, startStr, endStr),
    enabled: !configPending,
  })
}
