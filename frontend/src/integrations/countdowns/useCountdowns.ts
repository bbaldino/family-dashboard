import { useQuery } from '@tanstack/react-query'
import type { PollResult } from '@/integrations/types'
import { useIntegrationConfig } from '@/platform'
import { countdownsIntegration } from './config'
// Use the google-calendar integration's API to fetch events
import { googleCalendarIntegration, type CalendarEvent } from '@/integrations/google-calendar'
import { parseLocalDate } from '@/utils/date'

export interface CountdownItem {
  id: string
  name: string
  date: Date
  daysUntil: number
}

export type CountdownsData = PollResult<CountdownItem[]>

async function fetchCountdowns(calendarId: string, horizonDays: number): Promise<CountdownItem[]> {
  const now = new Date()
  const start = now.toISOString()
  const end = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000).toISOString()

  const events = await googleCalendarIntegration.api.get<CalendarEvent[]>(
    `/events?calendar=${encodeURIComponent(calendarId)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return events
    .map((event) => {
      const dateStr = event.start.dateTime ?? event.start.date ?? ''
      const eventDate =
        event.start.date && !event.start.dateTime ? parseLocalDate(dateStr) : new Date(dateStr)
      eventDate.setHours(0, 0, 0, 0)

      const diffMs = eventDate.getTime() - today.getTime()
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      return {
        id: event.id,
        name: event.summary ?? '(No title)',
        date: eventDate,
        daysUntil,
      }
    })
    .filter((item) => item.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

/**
 * Adapts react-query's result back to `PollResult` — the shared
 * return-shape contract this hook's three consumers (`HouseholdColumn`,
 * `Calendar`, the grid `CountdownsWidget` and its widget-meta) still depend
 * on. In particular `data` stays `null` (not react-query's `undefined`)
 * until a fetch has actually succeeded — see `useLunchMenu` for the fuller
 * account of why that distinction matters to callers.
 */
export function useCountdowns(): CountdownsData {
  const config = useIntegrationConfig(countdownsIntegration)

  const calendarId = config?.calendar_id
  const horizonDays = parseInt(config?.horizon_days ?? '90', 10) || 90

  const query = useQuery({
    // `horizonDays` belongs in the key as much as the calendar id does: it
    // is an argument to the fetch (it sets the window's end), so leaving it
    // out meant editing "Days ahead" in admin changed nothing until the
    // hourly poll happened to come round — on a kiosk that never reloads,
    // up to an hour of showing the old window.
    queryKey: ['countdowns', calendarId ?? 'unconfigured', horizonDays],
    queryFn: () => fetchCountdowns(calendarId!, horizonDays),
    refetchInterval: 60 * 60 * 1000, // hourly
    enabled: !!calendarId,
  })

  return {
    data: query.data ?? null,
    error: query.error ? query.error.message : null,
    isLoading: query.isLoading,
    refetch: async () => {
      await query.refetch()
    },
  }
}
