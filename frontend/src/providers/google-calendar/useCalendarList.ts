import { useQuery } from '@tanstack/react-query'
import { googleCalendarProvider } from './config'
import type { CalendarListEntry } from './types'

/**
 * The Google account's calendar list, for the admin picker that decides
 * which calendars feed the dashboard. Fetched on demand, not on mount:
 * `GoogleCalendarSettings` triggers it from a "Fetch Calendars" button, so an
 * admin page load never spends a call against the household's Google API
 * quota on its own. `enabled: false` only suppresses the automatic run —
 * the caller drives it by calling the returned `refetch`.
 *
 * It belongs to the provider rather than to any consumer: "which calendars
 * does this account have" is a property of the connection, and every consumer
 * that offers a picker asks the same question.
 */
export function useCalendarList() {
  return useQuery({
    queryKey: ['google-calendar', 'calendars'],
    queryFn: () => googleCalendarProvider.api.get<CalendarListEntry[]>('/calendars'),
    enabled: false,
  })
}
