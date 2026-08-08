import { useIntegrationConfig } from '@/platform'
import { useCalendarRange, type CalendarEvent } from '@/providers/google-calendar'
import { calendarIntegration } from './config'

export interface CalendarEventsResult {
  /** `undefined` until the events have actually resolved, as before. */
  data: CalendarEvent[] | undefined
  isLoading: boolean
  /** Only when *every* calendar failed; one broken share is not an error. */
  isError: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Every event in `[start, end)` across the configured calendars, flat and
 * unbucketed.
 *
 * Deliberately stops at the flatten: `AssignmentsTab` buckets by day-of-week
 * relative to its selected Monday, the week strip buckets by date, and the
 * month grid expands multi-day events — all of which are presentation and
 * belong to the caller. What the caller must *not* have to know is which
 * calendars are configured, or where the events came from.
 *
 * It no longer fetches. The provider's range resolver answers from the synced
 * window when the range is inside it — which the week `AssignmentsTab` opens
 * on always is — and fetches only for a week paged outside it. That is the
 * whole saving: the tab's calendar row now costs nothing on top of the sync
 * the dashboard is already doing.
 *
 * The calendar ids come from *this* integration's config key. Countdowns
 * keeps a different calendar under its own key, which is why the provider
 * takes the ids rather than reading them.
 */
export function useCalendarEvents(start: Date, end: Date): CalendarEventsResult {
  const config = useIntegrationConfig(calendarIntegration)
  const range = useCalendarRange(config?.calendar_ids, start, end)

  return {
    // Withheld while the range is still resolving so a caller cannot mistake
    // "not here yet" for "nothing that week"; `AssignmentsTab` renders a dash
    // per empty day and the two look identical on screen.
    data: range.isLoading ? undefined : range.events,
    isLoading: range.isLoading,
    isError: range.error !== null,
    error: range.error,
    refetch: range.refetch,
  }
}
